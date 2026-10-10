import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { calculateTax, sumTaxLines } from '@/lib/tax-rates';
import { createAuditEntry } from '@/core/audit/audit.service';
import {
  lockInventoryRecord,
  updateInventoryQuantity,
  insertInventoryTransaction,
} from '@/modules/catalogue/inventory/inventory.queries';
import { findCartByUserId, findCartItemsFull, deleteAllCartItems, deleteCart } from '@/modules/cart/cart.queries';
import { findMethodById } from '@/modules/shipping-methods/shipping-method.queries';
import { verifyPreviewToken } from '@/modules/checkout/checkout.service';
import {
  ensureSequenceRow,
  lockAndGetSequence,
  incrementSequence,
  formatOrderNumber,
  insertOrder,
  insertOrderItem,
  insertOrderStatusHistory,
  findOrderById,
  findOrderDetailForPatient,
  findOrderDetailForAdmin,
  listOrdersByPatient,
  listOrdersForAdmin,
  updateOrderStatus,
  updateOrderNotes as doUpdateOrderNotes,
} from './order.queries';
import type {
  OrderStatus,
  OrderDetail,
  AdminOrderDetail,
  OrderSummary,
  PlaceOrderResult,
} from './order.types';
import { VALID_TRANSITIONS as TRANSITIONS } from './order.types';
import type { PlaceOrderInput } from '@/modules/checkout/checkout.types';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';

// ── validateStatusTransition ──────────────────────────────────────────────

export function validateStatusTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition order from '${current}' to '${next}'`,
      422,
    );
  }
}

// ── placeOrder ────────────────────────────────────────────────────────────
// Full transactional order placement with SELECT FOR UPDATE on sequences and stock.

export async function placeOrder(
  input: PlaceOrderInput,
  auth: AuthContext,
): Promise<PlaceOrderResult> {
  const facilityId = auth.facilityId;
  if (!facilityId) throw new AppError('FORBIDDEN', 'No facility context', 403);

  // 1. Verify preview token (confirm user saw accurate totals)
  const claims = verifyPreviewToken(input.previewToken);
  if (claims.sub !== auth.userId || claims.facilityId !== facilityId) {
    throw new AppError('PREVIEW_TOKEN_INVALID', 'Preview token does not match current session', 422);
  }

  return withTenantContext(facilityId, async (tx) => {
    // 2. Find cart
    const cart = await findCartByUserId(facilityId, auth.userId, tx);
    if (!cart) throw new AppError('CART_EMPTY', 'Your cart is empty', 422);

    const liveItems = await findCartItemsFull(cart.id, tx);
    if (liveItems.length === 0) throw new AppError('CART_EMPTY', 'Your cart is empty', 422);

    // 3. Validate shipping method
    const method = await findMethodById(claims.shippingMethodId, tx);
    if (!method || !method.isActive) {
      throw new AppError('SHIPPING_METHOD_NOT_FOUND', 'Shipping method not found', 404);
    }

    // 4. Prepare sequence
    await ensureSequenceRow(facilityId, tx);

    // 5. Lock sequence row (SELECT FOR UPDATE — collision-free order number)
    const seqVal = await lockAndGetSequence(facilityId, tx);

    // 6. Lock all inventory records SELECT FOR UPDATE and re-validate stock
    const inventoryLocks: Array<{
      record: { id: string; quantity: number; facilityId: string; productId: string; variantId: string | null };
      item: (typeof liveItems)[0];
    }> = [];

    const outOfStockItems: string[] = [];
    for (const item of liveItems) {
      const record = await lockInventoryRecord(item.productId, item.variantId, tx);
      if (!item.isActive || record.quantity < item.quantity) {
        outOfStockItems.push(item.productId);
      }
      inventoryLocks.push({ record, item });
    }

    if (outOfStockItems.length > 0) {
      throw new AppError('INSUFFICIENT_STOCK', 'One or more items are out of stock', 422);
    }

    // 7. Re-compute totals from scratch (never trust preview token amounts)
    const subtotal = liveItems
      .reduce((sum, item) => sum + parseFloat(item.currentPrice) * item.quantity, 0)
      .toFixed(2);

    const taxLines = calculateTax(subtotal, input.shippingAddress.province);
    const taxTotal = sumTaxLines(taxLines);
    const shippingCost = method.flatRate;
    const total = (
      parseFloat(subtotal) + parseFloat(taxTotal) + parseFloat(shippingCost)
    ).toFixed(2);

    // 8. Generate order number
    const orderNumber = formatOrderNumber(seqVal);

    // 9. INSERT order
    const { id: orderId } = await insertOrder(
      {
        facilityId,
        patientId: auth.userId,
        orderNumber,
        status: 'pending',
        shippingAddress: input.shippingAddress as unknown as Record<string, unknown>,
        shippingMethodId: method.id,
        shippingMethodSnapshot: {
          id: method.id,
          name: method.name,
          flatRate: method.flatRate,
          estimatedDaysMin: method.estimatedDaysMin,
          estimatedDaysMax: method.estimatedDaysMax,
        },
        subtotal,
        taxBreakdown: taxLines,
        taxTotal,
        shippingCost,
        total,
        notes: input.notes ?? null,
      },
      tx,
    );

    // 10. INSERT order_items (snapshots)
    for (const item of liveItems) {
      const lineTotal = (parseFloat(item.currentPrice) * item.quantity).toFixed(2);
      await insertOrderItem(
        {
          orderId,
          facilityId,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productNameSnapshot,
          variantLabel: item.variantLabelSnapshot,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.currentPrice,
          lineTotal,
        },
        tx,
      );
    }

    // 11. INSERT initial order_status_history
    await insertOrderStatusHistory(
      {
        orderId,
        facilityId,
        previousStatus: null,
        newStatus: 'pending',
        changedById: null,
        note: null,
      },
      tx,
    );

    // 12. Decrement stock + insert inventory_transactions
    for (const { record, item } of inventoryLocks) {
      const newQty = record.quantity - item.quantity;
      await updateInventoryQuantity(record.id, newQty, tx);
      await insertInventoryTransaction(
        {
          facilityId,
          inventoryRecordId: record.id,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: -item.quantity,
          resultingBalance: newQty,
          reason: 'SALE',
          note: `Order ${orderNumber}`,
          actorId: auth.userId,
        },
        tx,
      );
    }

    // 13. Increment sequence AFTER successful order
    await incrementSequence(facilityId, tx);

    // 14. Clear cart
    await deleteAllCartItems(cart.id, tx);
    await deleteCart(cart.id, tx);

    // 15. Audit
    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'order.placed',
        resourceType: 'order',
        resourceId: orderId,
        metadata: { orderNumber, total },
      },
      tx,
    );

    const today = new Date();
    const minDate = new Date(today.getTime() + method.estimatedDaysMin * 86400000);
    const maxDate = new Date(today.getTime() + method.estimatedDaysMax * 86400000);

    return {
      orderId,
      orderNumber,
      status: 'pending',
      breakdown: { subtotal, taxBreakdown: taxLines, taxTotal, shippingCost, total },
      estimatedDelivery: {
        min: minDate.toISOString().split('T')[0],
        max: maxDate.toISOString().split('T')[0],
      },
    };
  });
}

// ── Patient order operations ──────────────────────────────────────────────

export async function listPatientOrders(
  auth: AuthContext,
  opts: { status?: OrderStatus; page: number; limit: number },
): Promise<{ rows: OrderSummary[]; total: number; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const result = await listOrdersByPatient(facilityId, auth.userId, opts, tx);
    return {
      ...result,
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / opts.limit),
      },
    };
  });
}

export async function getPatientOrderDetail(
  auth: AuthContext,
  orderId: string,
): Promise<Omit<OrderDetail, 'notes'>> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const order = await findOrderDetailForPatient(facilityId, orderId, auth.userId, tx);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found', 404);
    // Explicitly omit notes — must never reach patient
    const { ...orderWithoutNotes } = order as OrderDetail & { notes?: unknown };
    delete (orderWithoutNotes as Record<string, unknown>).notes;
    return orderWithoutNotes;
  });
}

export async function cancelPatientOrder(
  auth: AuthContext,
  orderId: string,
): Promise<void> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const order = await findOrderDetailForPatient(facilityId, orderId, auth.userId, tx);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found', 404);

    validateStatusTransition(order.status, 'cancelled');

    // Insert status history
    await insertOrderStatusHistory(
      { orderId, facilityId, previousStatus: order.status, newStatus: 'cancelled', changedById: auth.userId, note: 'Cancelled by patient' },
      tx,
    );

    // Restore stock
    for (const item of order.items) {
      if (!item.productId) continue;
      const record = await lockInventoryRecord(item.productId, item.variantId, tx);
      const newQty = record.quantity + item.quantity;
      await updateInventoryQuantity(record.id, newQty, tx);
      await insertInventoryTransaction(
        {
          facilityId,
          inventoryRecordId: record.id,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: item.quantity,
          resultingBalance: newQty,
          reason: 'RETURN',
          note: `Patient cancelled order ${order.orderNumber}`,
          actorId: auth.userId,
        },
        tx,
      );
    }

    await updateOrderStatus(orderId, 'cancelled', tx);
    await createAuditEntry(
      { facilityId, actorId: auth.userId, actorType: 'user', action: 'order.cancelled_by_patient', resourceType: 'order', resourceId: orderId },
      tx,
    );
  });
}

// ── Admin order operations ────────────────────────────────────────────────

export async function listAdminOrders(
  auth: AuthContext,
  opts: {
    status?: OrderStatus;
    patientId?: string;
    orderNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort?: 'createdAt:asc' | 'createdAt:desc' | 'total:asc' | 'total:desc';
  },
): Promise<{ rows: (OrderSummary & { patientName: string })[]; total: number; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const result = await listOrdersForAdmin(facilityId, opts, tx);
    return {
      ...result,
      pagination: {
        page: opts.page,
        limit: opts.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / opts.limit),
      },
    };
  });
}

export async function getAdminOrderDetail(
  auth: AuthContext,
  orderId: string,
): Promise<AdminOrderDetail> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const order = await findOrderDetailForAdmin(facilityId, orderId, tx);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found', 404);
    return order;
  });
}

export async function advanceOrderStatus(
  auth: AuthContext,
  orderId: string,
  newStatus: OrderStatus,
  note?: string,
): Promise<void> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const order = await findOrderById(orderId, tx);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found', 404);

    validateStatusTransition(order.status as OrderStatus, newStatus);

    // If cancelling, restore stock
    if (newStatus === 'cancelled') {
      const fullOrder = await findOrderDetailForAdmin(facilityId, orderId, tx);
      if (fullOrder) {
        for (const item of fullOrder.items) {
          if (!item.productId) continue;
          const record = await lockInventoryRecord(item.productId, item.variantId, tx);
          const newQty = record.quantity + item.quantity;
          await updateInventoryQuantity(record.id, newQty, tx);
          await insertInventoryTransaction(
            {
              facilityId,
              inventoryRecordId: record.id,
              productId: item.productId,
              variantId: item.variantId,
              quantityDelta: item.quantity,
              resultingBalance: newQty,
              reason: 'RETURN',
              note: `Admin cancelled order ${fullOrder.orderNumber}`,
              actorId: auth.userId,
            },
            tx,
          );
        }
      }
    }

    await insertOrderStatusHistory(
      { orderId, facilityId, previousStatus: order.status as OrderStatus, newStatus, changedById: auth.userId, note: note ?? null },
      tx,
    );
    await updateOrderStatus(orderId, newStatus, tx);
    await createAuditEntry(
      { facilityId, actorId: auth.userId, actorType: 'user', action: 'order.status_changed', resourceType: 'order', resourceId: orderId, metadata: { from: order.status, to: newStatus } },
      tx,
    );
  });
}

export async function adminCancelOrder(
  auth: AuthContext,
  orderId: string,
  note?: string,
): Promise<void> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const order = await findOrderById(orderId, tx);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found', 404);

    const cancellable: OrderStatus[] = ['pending', 'confirmed'];
    if (!cancellable.includes(order.status as OrderStatus)) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `Order in '${order.status}' status cannot be cancelled by admin`,
        422,
      );
    }

    const fullOrder = await findOrderDetailForAdmin(facilityId, orderId, tx);
    if (fullOrder) {
      for (const item of fullOrder.items) {
        if (!item.productId) continue;
        const record = await lockInventoryRecord(item.productId, item.variantId, tx);
        const newQty = record.quantity + item.quantity;
        await updateInventoryQuantity(record.id, newQty, tx);
        await insertInventoryTransaction(
          {
            facilityId,
            inventoryRecordId: record.id,
            productId: item.productId,
            variantId: item.variantId,
            quantityDelta: item.quantity,
            resultingBalance: newQty,
            reason: 'RETURN',
            note: `Admin cancelled order ${fullOrder.orderNumber}`,
            actorId: auth.userId,
          },
          tx,
        );
      }
    }

    await insertOrderStatusHistory(
      { orderId, facilityId, previousStatus: order.status as OrderStatus, newStatus: 'cancelled', changedById: auth.userId, note: note ?? null },
      tx,
    );
    await updateOrderStatus(orderId, 'cancelled', tx);
    await createAuditEntry(
      { facilityId, actorId: auth.userId, actorType: 'user', action: 'order.cancelled_by_admin', resourceType: 'order', resourceId: orderId },
      tx,
    );
  });
}

export async function updateAdminOrderNotes(
  auth: AuthContext,
  orderId: string,
  notes: string,
): Promise<void> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const order = await findOrderById(orderId, tx);
    if (!order) throw new AppError('ORDER_NOT_FOUND', 'Order not found', 404);
    await doUpdateOrderNotes(orderId, notes, tx);
  });
}

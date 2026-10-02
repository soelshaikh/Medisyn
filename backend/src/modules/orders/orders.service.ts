import { OrderModel, type IShippingAddress, type OrderStatus, type IBatchAllocation } from "./orders.schema";
import { CartModel } from "@/modules/cart/cart.schema";
import { ProductModel } from "@/modules/products/products.schema";
import { UserModel } from "@/modules/users/users.schema";
import { deductStock, restoreStock } from "@/modules/inventory/inventory.service";
import { InventoryModel } from "@/modules/inventory/inventory.schema";
import { deductBatchStock, restoreBatchStock } from "@/modules/inventory/batch.service";
import { validateCoupon, incrementUsage } from "@/modules/coupons/coupons.service";
import { calculateTax } from "@/modules/tax/tax.service";
import { AppError } from "@/common/middleware/error.middleware";
import { guardTransition } from "@/common/transitions/transition-guards";
import { EmailTriggerService } from "@/modules/email/email-trigger.service";
import { createNotification } from "@/modules/notifications/notifications.service";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";
import { createFromOrder } from "@/modules/invoices/invoice.service";
import { logger } from "@/common/utils/logger";

async function generateOrderNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await OrderModel.countDocuments();
  const seq   = String(count + 1).padStart(6, "0");
  return `ORD-${year}-${seq}`;
}

export interface CheckoutInput {
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  paymentMethod:   "pickup" | "delivery";
  notes?:          string;
  userId?:         string;
  sessionId?:      string;
  guestInfo?:      { email: string; fullName: string; phone: string };
}

export async function checkout(input: CheckoutInput) {
  const { userId, sessionId, shippingAddress, billingAddress, paymentMethod, notes, guestInfo } = input;
  const resolvedBillingAddress = billingAddress ?? shippingAddress;

  const cart = await CartModel.findOne(userId ? { userId } : { sessionId });
  if (!cart || cart.items.length === 0) throw new AppError("Cart is empty", 400);

  const productIds = cart.items.map((i) => i.productId);
  const products   = await ProductModel.find({ _id: { $in: productIds }, status: "active" });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const items = cart.items.map((cartItem) => {
    const product = productMap.get(String(cartItem.productId));
    if (!product) throw new AppError(`Product ${cartItem.name} is no longer available`, 400);
    const primaryImage = product.images?.find((img) => img.isPrimary) ?? product.images?.[0];
    return {
      productId: cartItem.productId,
      name:      product.name,
      sku:       product.sku,
      slug:      product.slug,
      imageUrl:  primaryImage?.url ?? "",
      price:     product.price,
      quantity:  cartItem.quantity,
      lineTotal: product.price * cartItem.quantity,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  let discountAmount = 0;
  let couponCode: string | null = null;
  if (cart.appliedCouponCode) {
    const cartProductIds = items.map((i) => String(i.productId));
    const result = await validateCoupon(cart.appliedCouponCode, subtotal, userId, cartProductIds);
    if (result.valid) {
      discountAmount = result.discountCents ?? 0;
      couponCode     = cart.appliedCouponCode;
    }
  }

  const taxableAmount = subtotal - discountAmount;
  const tax           = calculateTax(taxableAmount, shippingAddress.province);
  const total         = taxableAmount + tax.total;

  /* Deduct aggregate stock (existing behaviour, always runs) */
  await deductStock(items.map((i) => ({ productId: String(i.productId), quantity: i.quantity })));

  /* Batch allocation — runs per item only when batch tracking is enabled */
  const orderNumber = await generateOrderNumber();
  const batchAllocations: IBatchAllocation[] = [];

  for (const item of items) {
    const pid = String(item.productId);
    const inv  = await InventoryModel.findOne({ productId: pid }).lean();
    if (inv?.batchTrackingEnabled) {
      try {
        const allocs = await deductBatchStock(pid, item.name, item.quantity, orderNumber, orderNumber);
        batchAllocations.push(...allocs as unknown as IBatchAllocation[]);
      } catch (batchErr) {
        /* Batch allocation failed — log and continue without batch tracking for this item.
           Aggregate stock is already deducted above; admin can resolve manually. */
        logger.warn("[Orders] batch allocation failed for product", { pid, batchErr });
      }
    }
  }

  const order = await OrderModel.create({
    orderNumber,
    userId:     userId ?? null,
    guestInfo:  userId ? null : guestInfo,
    items,
    batchAllocations,
    shippingAddress,
    billingAddress: resolvedBillingAddress,
    subtotal,
    taxBreakdown:  tax.breakdown,
    taxTotal:      tax.total,
    discountAmount,
    couponCode,
    total,
    paymentMethod,
    notes:         notes ?? "",
    status:        "pending",
    statusHistory: [{ status: "pending", changedAt: new Date(), changedBy: null, note: "Order placed" }],
  });

  if (couponCode) await incrementUsage(couponCode);

  await CartModel.findByIdAndDelete(cart._id);

  const email     = userId ? undefined : guestInfo?.email;
  const fullName  = userId ? undefined : guestInfo?.fullName;
  const totalStr  = `$${(total / 100).toFixed(2)} CAD`;

  if (email && fullName) {
    void EmailTriggerService.fire("orders", null, "pending", {
      customer: { email, fullName },
      refId:    orderNumber,
      status:   "pending",
      extra:    { total: totalStr },
    });
  }

  await logAction({
    userId:     userId ?? null,
    userEmail:  userId ? undefined : guestInfo?.email,
    actorName:  userId ? undefined : (guestInfo?.fullName ?? "guest"),
    action:     "order.create",
    resource:   "order",
    resourceId: String(order._id),
    before:     null,
    after:      { orderNumber, total, status: "pending", itemCount: items.length },
  });

  return order;
}

export async function listUserOrders(userId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    OrderModel.countDocuments({ userId }),
    OrderModel.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getOrder(id: string, userId?: string) {
  const query: Record<string, unknown> = { _id: id };
  if (userId) query.userId = userId;
  const order = await OrderModel.findOne(query)
    .populate("userId", "email fullName phone")
    .lean();
  if (!order) throw new AppError("Order not found", 404);
  return order;
}

export async function listAdminOrders(filters: {
  status?: string; search?: string; page?: number; limit?: number;
  dateFrom?: Date; dateTo?: Date;
} = {}) {
  const { status, search, page = 1, limit = 25, dateFrom, dateTo } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) (query.createdAt as Record<string, Date>).$gte = dateFrom;
    if (dateTo)   (query.createdAt as Record<string, Date>).$lte = dateTo;
  }
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "guestInfo.email": { $regex: search, $options: "i" } },
    ];
  }
  const [total, data] = await Promise.all([
    OrderModel.countDocuments(query),
    OrderModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note: string,
  changedBy: string,
  actor?: AuditActor,
  actorPermissions?: Set<string>,
) {
  const order = await OrderModel.findById(id);
  if (!order) throw new AppError("Order not found", 404);

  if (actorPermissions) {
    guardTransition("orders", order.status, status, actorPermissions);
  }

  const oldStatus = order.status;

  order.status = status;
  order.statusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: changedBy as unknown as import("mongoose").Types.ObjectId,
    note,
  });

  const saved = await order.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     `order.status.${status}`,
    resource:   "order",
    resourceId: id,
    before:     { status: oldStatus },
    after:      { status },
    details:    { note },
    ipAddress:  actor?.ip,
  });

  /* Fire-and-forget: email (config-driven) + notification */
  void _orderStatusSideEffects(saved, oldStatus, status);

  /* Auto-generate invoice when order reaches delivered */
  if (status === "delivered") {
    createFromOrder(String(saved._id)).catch((err) =>
      logger.error("[Invoices] auto-create failed", err),
    );
  }

  return saved;
}

async function _orderStatusSideEffects(
  order: Awaited<ReturnType<typeof OrderModel.prototype.save>>,
  oldStatus: string,
  status: OrderStatus,
) {
  try {
    let recipientEmail: string | undefined;
    let recipientName:  string | undefined;

    if (order.userId) {
      const user = await UserModel.findById(order.userId).select("email fullName").lean();
      if (user) { recipientEmail = user.email; recipientName = user.fullName; }
    } else if (order.guestInfo) {
      recipientEmail = order.guestInfo.email;
      recipientName  = order.guestInfo.fullName;
    }

    if (recipientEmail && recipientName) {
      void EmailTriggerService.fire("orders", oldStatus, status, {
        customer: { email: recipientEmail, fullName: recipientName },
        refId:    order.orderNumber,
        status,
      });
    }

    if (order.userId) {
      createNotification({
        userId:   String(order.userId),
        type:     "order_update",
        title:    "Order Update",
        message:  `Order #${order.orderNumber} is now ${status.replace(/_/g, " ")}`,
        metadata: { orderId: String(order._id), orderNumber: order.orderNumber, status },
      }).catch((e) => logger.error("[Notification] order status", e));
    }
  } catch (err) {
    logger.error("[Orders] post-status side effects failed", err);
  }
}

const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "confirmed"];

export async function cancelMyOrder(
  id: string,
  userId: string,
  reason: string,
) {
  const order = await OrderModel.findOne({ _id: id, userId });
  if (!order) throw new AppError("Order not found", 404);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new AppError(
      `Orders with status "${order.status}" cannot be cancelled. Contact support for help.`,
      409,
    );
  }

  const prevStatus = order.status;
  order.status = "cancelled";
  order.statusHistory.push({
    status:    "cancelled",
    changedAt: new Date(),
    changedBy: userId as unknown as import("mongoose").Types.ObjectId,
    note:      reason || "Cancelled by customer",
  });
  await order.save();

  /* Restore aggregate inventory */
  const stockItems = order.items.map((i) => ({
    productId: String(i.productId),
    quantity:  i.quantity,
  }));
  void restoreStock(stockItems).catch((e) => logger.error("[Orders] restoreStock failed", e));

  /* Restore batch stock if allocations exist */
  if (order.batchAllocations?.length) {
    const batchAllocs = order.batchAllocations.map((a) => ({
      productId:   String(a.productId),
      productName: a.productName,
      batchId:     String(a.batchId),
      batchNumber: a.batchNumber,
      expiryDate:  a.expiryDate,
      allocatedQty: a.allocatedQty,
    }));
    void restoreBatchStock(batchAllocs, String(order._id), order.orderNumber)
      .catch((e) => logger.error("[Orders] restoreBatchStock failed", e));
  }

  /* Notify */
  void _orderStatusSideEffects(order as never, prevStatus, "cancelled");

  return order;
}

export async function trackOrder(orderNumber: string, email: string) {
  const order = await OrderModel.findOne({ orderNumber })
    .populate("userId", "email")
    .lean();

  if (!order) throw new AppError("Order not found", 404);

  /* Verify the email matches either the guest email or the account email */
  const normalised = email.trim().toLowerCase();
  const guestEmail = order.guestInfo?.email?.toLowerCase();
  const userEmail  = (order.userId && typeof order.userId === "object" && "email" in order.userId)
    ? (order.userId as { email: string }).email.toLowerCase()
    : null;

  if (normalised !== guestEmail && normalised !== userEmail) {
    throw new AppError("Order not found", 404); // intentionally vague — don't reveal existence
  }

  /* Return a safe public subset — no internal notes, no full address */
  return {
    orderNumber:   order.orderNumber,
    status:        order.status,
    createdAt:     order.createdAt,
    paymentMethod: order.paymentMethod,
    subtotal:      order.subtotal,
    taxTotal:      order.taxTotal,
    discountAmount: order.discountAmount,
    couponCode:    order.couponCode,
    total:         order.total,
    items: order.items.map((i) => ({
      name:      i.name,
      sku:       i.sku,
      quantity:  i.quantity,
      lineTotal: i.lineTotal,
    })),
    shippingTo: {
      city:     order.shippingAddress.city,
      province: order.shippingAddress.province,
    },
    statusHistory: order.statusHistory.map((h) => ({
      status:    h.status,
      changedAt: h.changedAt,
      note:      h.note,
    })),
  };
}

/**
 * Admin overrides the batch allocations for an order.
 * Old batch quantities are restored, new FEFO allocation is applied.
 * Only allowed on non-delivered, non-cancelled orders.
 */
export async function overrideBatchAllocations(
  orderId: string,
  newAllocations: Array<{ batchId: string; batchNumber: string; productId: string; productName: string; expiryDate: Date; allocatedQty: number }>,
  actor: AuditActor,
) {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new AppError("Order not found", 404);
  if (["delivered", "cancelled"].includes(order.status)) {
    throw new AppError("Cannot modify batch allocations on a completed or cancelled order", 409);
  }

  /* Restore existing batch allocations */
  if (order.batchAllocations?.length) {
    const existing = order.batchAllocations.map((a) => ({
      productId:   String(a.productId),
      productName: a.productName,
      batchId:     String(a.batchId),
      batchNumber: a.batchNumber,
      expiryDate:  a.expiryDate,
      allocatedQty: a.allocatedQty,
    }));
    await restoreBatchStock(existing, orderId, order.orderNumber);
  }

  /* Apply new batch allocations by deducting per-batch directly */
  const { ProductBatchModel } = await import("@/modules/inventory/productBatch.schema");
  const { InventoryMovementModel } = await import("@/modules/inventory/inventoryMovement.schema");
  const { InventoryModel: InvModel } = await import("@/modules/inventory/inventory.schema");

  for (const alloc of newAllocations) {
    const batch = await ProductBatchModel.findById(alloc.batchId);
    if (!batch) throw new AppError(`Batch ${alloc.batchNumber} not found`, 404);
    if (batch.currentQty < alloc.allocatedQty) {
      throw new AppError(`Insufficient stock in batch ${alloc.batchNumber}: available ${batch.currentQty}`, 409);
    }

    const qtyBefore = batch.currentQty;
    const qtyAfter  = qtyBefore - alloc.allocatedQty;
    batch.currentQty = qtyAfter;
    if (batch.currentQty === 0) batch.status = "depleted";
    await batch.save();

    await InventoryMovementModel.create({
      productId:    alloc.productId,
      batchId:      batch._id,
      batchNumber:  batch.batchNumber,
      movementType: "order_fulfilled",
      qty:          -alloc.allocatedQty,
      qtyBefore,
      qtyAfter,
      orderId,
      orderNumber:  order.orderNumber,
      performedBy:  actor.id,
      notes:        "Admin batch override",
    });

    /* Sync aggregate */
    const result = await ProductBatchModel.aggregate<{ total: number }>([
      { $match: { productId: batch.productId, status: "active" } },
      { $group: { _id: null, total: { $sum: "$currentQty" } } },
    ]);
    await InvModel.findOneAndUpdate({ productId: batch.productId }, { quantity: result[0]?.total ?? 0 });
  }

  order.batchAllocations = newAllocations as unknown as IBatchAllocation[];
  await order.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     "order.batch_allocations.override",
    resource:   "order",
    resourceId: orderId,
    details:    { allocationCount: newAllocations.length },
    ipAddress:  actor.ip,
  });

  return order;
}

export async function addAdminNote(id: string, note: string, actor?: AuditActor) {
  const order = await OrderModel.findById(id);
  if (!order) throw new AppError("Order not found", 404);

  const oldNotes = order.adminNotes ?? "";
  order.adminNotes = oldNotes
    ? `${oldNotes}\n\n${new Date().toISOString()}: ${note}`
    : `${new Date().toISOString()}: ${note}`;
  const saved = await order.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "order.note.added",
    resource:   "order",
    resourceId: id,
    details:    { note },
    ipAddress:  actor?.ip,
  });

  return saved;
}

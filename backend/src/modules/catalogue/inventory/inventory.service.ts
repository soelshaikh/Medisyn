import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import { getVariantById } from '../products/product.queries';
import {
  lockInventoryRecord,
  updateInventoryQuantity,
  insertInventoryTransaction,
  getInventoryForProduct,
  getLowStockProducts,
  getInventoryHistory,
} from './inventory.queries';
import type {
  AdjustInput,
  InventoryTransactionRow,
  InventoryForProductRow,
  LowStockRow,
  InventoryHistoryRow,
} from './inventory.types';

// ── adjustInventory ───────────────────────────────────────────────────────

export async function adjustInventory(
  facilityId: string,
  actorId: string,
  productId: string,
  input: AdjustInput,
): Promise<InventoryTransactionRow> {
  return withTenantContext(facilityId, async (tx) => {
    // Validate variant belongs to product if provided
    if (input.variantId) {
      const variant = await getVariantById(input.variantId, tx);
      if (!variant || variant.productId !== productId) {
        throw new AppError('VARIANT_NOT_FOUND', 'Variant not found on this product', 404);
      }
    }

    // Lock the inventory record (SELECT FOR UPDATE — prevents concurrent adjustments)
    const record = await lockInventoryRecord(productId, input.variantId ?? null, tx);

    const newQuantity = record.quantity + input.quantityDelta;

    // Guard: block negative balance unless allowNegative=true
    if (newQuantity < 0 && !record.allowNegative) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        `Insufficient stock: current=${record.quantity}, delta=${input.quantityDelta}`,
        409,
      );
    }

    await updateInventoryQuantity(record.id, newQuantity, tx);

    const transaction = await insertInventoryTransaction(
      {
        facilityId,
        inventoryRecordId: record.id,
        productId,
        variantId: input.variantId ?? null,
        quantityDelta: input.quantityDelta,
        resultingBalance: newQuantity,
        reason: input.reason,
        note: input.note ?? null,
        actorId,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'inventory.adjusted',
        resourceType: 'inventory_record',
        resourceId: record.id,
        metadata: {
          productId,
          variantId: input.variantId ?? null,
          delta: input.quantityDelta,
          newBalance: newQuantity,
          reason: input.reason,
        },
      },
      tx,
    );

    return transaction;
  });
}

// ── getInventoryStatus ────────────────────────────────────────────────────

export async function getInventoryStatus(
  facilityId: string,
  productId: string,
): Promise<InventoryForProductRow[]> {
  return withTenantContext(facilityId, async (tx) => {
    return getInventoryForProduct(productId, tx);
  });
}

// ── getLowStock ───────────────────────────────────────────────────────────

export async function getLowStock(
  facilityId: string,
  page: number,
  limit: number,
): Promise<{ rows: LowStockRow[]; total: number }> {
  return withTenantContext(facilityId, async (tx) => {
    return getLowStockProducts(page, limit, tx);
  });
}

// ── getHistory ────────────────────────────────────────────────────────────

export async function getHistory(
  facilityId: string,
  productId: string,
  variantId: string | undefined,
  page: number,
  limit: number,
): Promise<{ rows: InventoryHistoryRow[]; total: number }> {
  return withTenantContext(facilityId, async (tx) => {
    return getInventoryHistory(productId, variantId, page, limit, tx);
  });
}

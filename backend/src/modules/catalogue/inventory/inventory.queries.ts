import { eq, sql } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import {
  inventoryRecords,
  inventoryTransactions,
  products,
  productVariants,
} from '@/db/schema/catalogue';
import { users } from '@/db/schema/core';
import { AppError } from '@/lib/errors';
import type {
  InventoryRecordRow,
  InventoryTransactionRow,
  InventoryHistoryRow,
  LowStockRow,
  InventoryForProductRow,
} from './inventory.types';

// ── lockInventoryRecord ───────────────────────────────────────────────────
// SELECT FOR UPDATE — acquires a row-level lock for the duration of the transaction.
// Prevents concurrent adjustments from creating race conditions on the quantity.

export async function lockInventoryRecord(
  productId: string,
  variantId: string | null,
  tx: TenantTransaction,
): Promise<InventoryRecordRow> {
  const rows = await tx.execute(sql`
    SELECT id, facility_id, product_id, variant_id, quantity, allow_negative, updated_at
    FROM inventory_records
    WHERE product_id = ${productId}
      AND variant_id IS NOT DISTINCT FROM ${variantId}
    FOR UPDATE
  `);

  if ((rows as unknown[]).length === 0) {
    throw new AppError('INVENTORY_RECORD_NOT_FOUND', 'Inventory record not found', 404);
  }

  const raw = (rows as Record<string, unknown>[])[0];
  return {
    id: raw.id as string,
    facilityId: raw.facility_id as string,
    productId: raw.product_id as string,
    variantId: (raw.variant_id as string | null) ?? null,
    quantity: raw.quantity as number,
    allowNegative: raw.allow_negative as boolean,
    updatedAt: raw.updated_at as Date,
  };
}

// ── updateInventoryQuantity ───────────────────────────────────────────────

export async function updateInventoryQuantity(
  id: string,
  newQuantity: number,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(inventoryRecords)
    .set({ quantity: newQuantity, updatedAt: new Date() })
    .where(eq(inventoryRecords.id, id));
}

// ── insertInventoryTransaction ────────────────────────────────────────────

export async function insertInventoryTransaction(
  data: {
    facilityId: string;
    inventoryRecordId: string;
    productId: string;
    variantId: string | null;
    quantityDelta: number;
    resultingBalance: number;
    reason: string;
    note: string | null;
    actorId: string | null;
  },
  tx: TenantTransaction,
): Promise<InventoryTransactionRow> {
  const [row] = await tx
    .insert(inventoryTransactions)
    .values(data)
    .returning({
      id: inventoryTransactions.id,
      facilityId: inventoryTransactions.facilityId,
      inventoryRecordId: inventoryTransactions.inventoryRecordId,
      productId: inventoryTransactions.productId,
      variantId: inventoryTransactions.variantId,
      quantityDelta: inventoryTransactions.quantityDelta,
      resultingBalance: inventoryTransactions.resultingBalance,
      reason: inventoryTransactions.reason,
      note: inventoryTransactions.note,
      actorId: inventoryTransactions.actorId,
      createdAt: inventoryTransactions.createdAt,
    });
  return row as InventoryTransactionRow;
}

// ── getInventoryForProduct ────────────────────────────────────────────────
// Returns one row per inventory_record for the product (product-level + variant-level).

export async function getInventoryForProduct(
  productId: string,
  tx: TenantTransaction,
): Promise<InventoryForProductRow[]> {
  const rows = await tx
    .select({
      id: inventoryRecords.id,
      variantId: inventoryRecords.variantId,
      dimensionValue: productVariants.dimensionValue,
      quantity: inventoryRecords.quantity,
      allowNegative: inventoryRecords.allowNegative,
    })
    .from(inventoryRecords)
    .leftJoin(productVariants, eq(productVariants.id, inventoryRecords.variantId))
    .where(eq(inventoryRecords.productId, productId));

  return rows as InventoryForProductRow[];
}

// ── getLowStockProducts ───────────────────────────────────────────────────

export async function getLowStockProducts(
  page: number,
  limit: number,
  tx: TenantTransaction,
): Promise<{ rows: LowStockRow[]; total: number }> {
  const offset = (page - 1) * limit;

  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(inventoryRecords)
    .innerJoin(products, eq(products.id, inventoryRecords.productId))
    .where(
      sql`${products.isActive} = true AND ${inventoryRecords.quantity} <= ${products.lowStockThreshold}`,
    );

  if (count === 0) return { rows: [], total: 0 };

  const rows = await tx
    .select({
      productId: inventoryRecords.productId,
      productName: products.name,
      variantId: inventoryRecords.variantId,
      variantDimensionValue: productVariants.dimensionValue,
      quantity: inventoryRecords.quantity,
      lowStockThreshold: products.lowStockThreshold,
    })
    .from(inventoryRecords)
    .innerJoin(products, eq(products.id, inventoryRecords.productId))
    .leftJoin(productVariants, eq(productVariants.id, inventoryRecords.variantId))
    .where(
      sql`${products.isActive} = true AND ${inventoryRecords.quantity} <= ${products.lowStockThreshold}`,
    )
    .limit(limit)
    .offset(offset);

  return { rows: rows as LowStockRow[], total: count };
}

// ── getInventoryHistory ───────────────────────────────────────────────────

export async function getInventoryHistory(
  productId: string,
  variantId: string | null | undefined,
  page: number,
  limit: number,
  tx: TenantTransaction,
): Promise<{ rows: InventoryHistoryRow[]; total: number }> {
  const offset = (page - 1) * limit;

  // Build condition: filter by productId; optionally by variantId
  const condition =
    variantId !== undefined
      ? sql`${inventoryTransactions.productId} = ${productId} AND ${inventoryTransactions.variantId} IS NOT DISTINCT FROM ${variantId}`
      : eq(inventoryTransactions.productId, productId);

  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(inventoryTransactions)
    .where(condition);

  if (count === 0) return { rows: [], total: 0 };

  const rows = await tx
    .select({
      id: inventoryTransactions.id,
      facilityId: inventoryTransactions.facilityId,
      inventoryRecordId: inventoryTransactions.inventoryRecordId,
      productId: inventoryTransactions.productId,
      variantId: inventoryTransactions.variantId,
      quantityDelta: inventoryTransactions.quantityDelta,
      resultingBalance: inventoryTransactions.resultingBalance,
      reason: inventoryTransactions.reason,
      note: inventoryTransactions.note,
      actorId: inventoryTransactions.actorId,
      createdAt: inventoryTransactions.createdAt,
      actorName: sql<string | null>`
        CASE WHEN ${users.id} IS NOT NULL
          THEN CONCAT(${users.firstName}, ' ', ${users.lastName})
          ELSE NULL
        END
      `,
    })
    .from(inventoryTransactions)
    .leftJoin(users, eq(users.id, inventoryTransactions.actorId))
    .where(condition)
    .orderBy(sql`${inventoryTransactions.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return { rows: rows as InventoryHistoryRow[], total: count };
}

import { eq, and, sql } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { shippingMethods } from '@/db/schema/commerce';
import type { ShippingMethod } from './shipping-method.types';

// ── listActiveMethods ─────────────────────────────────────────────────────

export async function listActiveMethods(
  facilityId: string,
  tx: TenantTransaction,
): Promise<ShippingMethod[]> {
  const rows = await tx
    .select()
    .from(shippingMethods)
    .where(and(eq(shippingMethods.facilityId, facilityId), eq(shippingMethods.isActive, true)))
    .orderBy(shippingMethods.displayOrder, shippingMethods.flatRate);
  return rows as ShippingMethod[];
}

// ── listAllMethods ────────────────────────────────────────────────────────

export async function listAllMethods(
  facilityId: string,
  tx: TenantTransaction,
): Promise<ShippingMethod[]> {
  const rows = await tx
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.facilityId, facilityId))
    .orderBy(shippingMethods.displayOrder, shippingMethods.flatRate);
  return rows as ShippingMethod[];
}

// ── findMethodById ────────────────────────────────────────────────────────

export async function findMethodById(
  id: string,
  tx: TenantTransaction,
): Promise<ShippingMethod | undefined> {
  const [row] = await tx
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.id, id))
    .limit(1);
  return row as ShippingMethod | undefined;
}

// ── checkNameExists ───────────────────────────────────────────────────────

export async function checkNameExists(
  facilityId: string,
  name: string,
  excludeId: string | undefined,
  tx: TenantTransaction,
): Promise<boolean> {
  const condition = excludeId
    ? sql`${shippingMethods.facilityId} = ${facilityId} AND LOWER(${shippingMethods.name}) = LOWER(${name}) AND ${shippingMethods.id} != ${excludeId}`
    : sql`${shippingMethods.facilityId} = ${facilityId} AND LOWER(${shippingMethods.name}) = LOWER(${name})`;

  const [row] = await tx
    .select({ id: shippingMethods.id })
    .from(shippingMethods)
    .where(condition)
    .limit(1);
  return row !== undefined;
}

// ── insertMethod ──────────────────────────────────────────────────────────

export async function insertMethod(
  data: {
    facilityId: string;
    name: string;
    description?: string;
    flatRate: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    displayOrder: number;
  },
  tx: TenantTransaction,
): Promise<ShippingMethod> {
  const [row] = await tx.insert(shippingMethods).values(data).returning();
  return row as ShippingMethod;
}

// ── updateMethod ──────────────────────────────────────────────────────────

export async function updateMethod(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    flatRate: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    displayOrder: number;
  }>,
  tx: TenantTransaction,
): Promise<ShippingMethod> {
  const [row] = await tx
    .update(shippingMethods)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(shippingMethods.id, id))
    .returning();
  return row as ShippingMethod;
}

// ── setMethodInactive ─────────────────────────────────────────────────────

export async function setMethodInactive(id: string, tx: TenantTransaction): Promise<void> {
  await tx
    .update(shippingMethods)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(shippingMethods.id, id));
}

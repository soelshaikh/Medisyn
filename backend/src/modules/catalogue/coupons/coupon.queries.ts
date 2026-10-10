import { eq, sql, and, ilike } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { coupons } from '@/db/schema/catalogue';
import type { CreateCouponInput, UpdateCouponInput, CouponRow } from './coupon.types';

// ── Helpers ───────────────────────────────────────────────────────────────

function mapRow(row: typeof coupons.$inferSelect): CouponRow {
  return {
    id: row.id,
    facilityId: row.facilityId,
    code: row.code,
    type: row.type as CouponRow['type'],
    discountValue: row.discountValue,
    maxDiscountAmount: row.maxDiscountAmount ?? null,
    minOrderTotal: row.minOrderTotal ?? null,
    totalUsageLimit: row.totalUsageLimit ?? null,
    perCustomerUsageLimit: row.perCustomerUsageLimit ?? null,
    totalRedemptionCount: row.totalRedemptionCount,
    applicableProductIds: (row.applicableProductIds as string[] | null) ?? null,
    applicableCategoryIds: (row.applicableCategoryIds as string[] | null) ?? null,
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    isActive: row.isActive,
    internalNotes: row.internalNotes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Lookups ───────────────────────────────────────────────────────────────

export async function findCouponById(
  id: string,
  tx: TenantTransaction,
): Promise<CouponRow | undefined> {
  const [row] = await tx.select().from(coupons).where(eq(coupons.id, id)).limit(1);
  return row ? mapRow(row) : undefined;
}

export async function findCouponByCode(
  code: string,
  tx: TenantTransaction,
): Promise<CouponRow | undefined> {
  const upper = code.toUpperCase();
  const [row] = await tx.select().from(coupons).where(eq(coupons.code, upper)).limit(1);
  return row ? mapRow(row) : undefined;
}

export async function checkCodeExists(
  code: string,
  tx: TenantTransaction,
): Promise<boolean> {
  const upper = code.toUpperCase();
  const [row] = await tx
    .select({ id: coupons.id })
    .from(coupons)
    .where(eq(coupons.code, upper))
    .limit(1);
  return !!row;
}

// ── Insert & Update ───────────────────────────────────────────────────────

export async function insertCoupon(
  facilityId: string,
  userId: string,
  data: CreateCouponInput & { code: string },
  tx: TenantTransaction,
): Promise<CouponRow> {
  const [row] = await tx
    .insert(coupons)
    .values({
      facilityId,
      code: data.code,
      type: data.type,
      discountValue: data.discountValue,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      minOrderTotal: data.minOrderTotal ?? null,
      totalUsageLimit: data.totalUsageLimit ?? null,
      perCustomerUsageLimit: data.perCustomerUsageLimit ?? null,
      applicableProductIds: (data.applicableProductIds ?? null) as string[] | null,
      applicableCategoryIds: (data.applicableCategoryIds ?? null) as string[] | null,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      isActive: data.isActive,
      internalNotes: data.internalNotes ?? null,
      createdById: userId,
      updatedById: userId,
    })
    .returning();
  return mapRow(row);
}

export async function updateCouponById(
  id: string,
  userId: string,
  data: Partial<UpdateCouponInput>,
  tx: TenantTransaction,
): Promise<CouponRow> {
  const [row] = await tx
    .update(coupons)
    .set({ ...data, updatedById: userId, updatedAt: new Date() })
    .where(eq(coupons.id, id))
    .returning();
  return mapRow(row);
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listCoupons(
  filters: { active?: boolean; search?: string; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: CouponRow[]; total: number }> {
  const { page, limit } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filters.active !== undefined) {
    conditions.push(eq(coupons.isActive, filters.active));
  }
  if (filters.search) {
    conditions.push(ilike(coupons.code, `%${filters.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(coupons)
    .where(whereClause);

  if (count === 0) return { rows: [], total: 0 };

  const rows = await tx
    .select()
    .from(coupons)
    .where(whereClause)
    .orderBy(sql`${coupons.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return { rows: rows.map(mapRow), total: count };
}

import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import {
  insertCoupon,
  findCouponById,
  findCouponByCode,
  checkCodeExists,
  updateCouponById,
  listCoupons,
} from './coupon.queries';
import type { CreateCouponInput, UpdateCouponInput, ValidateCouponInput, CouponValidationResult, CouponRow } from './coupon.types';

// ── Create ────────────────────────────────────────────────────────────────

export async function createCoupon(
  facilityId: string,
  actorId: string,
  input: CreateCouponInput,
): Promise<CouponRow> {
  return withTenantContext(facilityId, async (tx) => {
    const code = input.code.toUpperCase();
    const exists = await checkCodeExists(code, tx);
    if (exists) {
      throw new AppError('COUPON_CODE_EXISTS', 'A coupon with this code already exists', 409);
    }

    const coupon = await insertCoupon(facilityId, actorId, { ...input, code }, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'coupon.created',
        resourceType: 'coupon',
        resourceId: coupon.id,
        metadata: { code: coupon.code, type: coupon.type },
      },
      tx,
    );

    return coupon;
  });
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateCoupon(
  facilityId: string,
  actorId: string,
  couponId: string,
  input: Partial<UpdateCouponInput>,
): Promise<CouponRow> {
  return withTenantContext(facilityId, async (tx) => {
    const existing = await findCouponById(couponId, tx);
    if (!existing) {
      throw new AppError('COUPON_NOT_FOUND', 'Coupon not found', 404);
    }

    const updated = await updateCouponById(couponId, actorId, input, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'coupon.updated',
        resourceType: 'coupon',
        resourceId: couponId,
        metadata: { changes: Object.keys(input) },
      },
      tx,
    );

    return updated;
  });
}

// ── Deactivate ────────────────────────────────────────────────────────────

export async function deactivateCoupon(
  facilityId: string,
  actorId: string,
  couponId: string,
): Promise<CouponRow> {
  return withTenantContext(facilityId, async (tx) => {
    const existing = await findCouponById(couponId, tx);
    if (!existing) {
      throw new AppError('COUPON_NOT_FOUND', 'Coupon not found', 404);
    }
    if (!existing.isActive) {
      throw new AppError('COUPON_ALREADY_INACTIVE', 'Coupon is already inactive', 409);
    }

    const updated = await updateCouponById(couponId, actorId, { isActive: false }, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'coupon.deactivated',
        resourceType: 'coupon',
        resourceId: couponId,
        metadata: {},
      },
      tx,
    );

    return updated;
  });
}

// ── Validate ──────────────────────────────────────────────────────────────

export async function validateCoupon(
  facilityId: string,
  input: ValidateCouponInput,
): Promise<CouponValidationResult> {
  return withTenantContext(facilityId, async (tx) => {
    const coupon = await findCouponByCode(input.code, tx);

    if (!coupon) {
      return { valid: false, reason: 'INVALID_CODE' };
    }

    if (!coupon.isActive) {
      return { valid: false, reason: 'INACTIVE' };
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, reason: 'INACTIVE' };
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      return { valid: false, reason: 'EXPIRED' };
    }

    if (
      coupon.totalUsageLimit !== null &&
      coupon.totalRedemptionCount >= coupon.totalUsageLimit
    ) {
      return { valid: false, reason: 'USAGE_LIMIT_REACHED' };
    }

    if (coupon.minOrderTotal !== null) {
      const orderTotalNum = parseFloat(input.orderTotal);
      const minOrderTotalNum = parseFloat(coupon.minOrderTotal);
      if (orderTotalNum < minOrderTotalNum) {
        return { valid: false, reason: 'MINIMUM_NOT_MET' };
      }
    }

    // Calculate effective discount — NEVER include internalNotes
    const orderTotalNum = parseFloat(input.orderTotal);
    let effectiveDiscount: number;

    if (coupon.type === 'PERCENTAGE') {
      const pct = parseFloat(coupon.discountValue) / 100;
      effectiveDiscount = orderTotalNum * pct;
      if (coupon.maxDiscountAmount !== null) {
        effectiveDiscount = Math.min(effectiveDiscount, parseFloat(coupon.maxDiscountAmount));
      }
    } else {
      effectiveDiscount = Math.min(parseFloat(coupon.discountValue), orderTotalNum);
    }

    return {
      valid: true,
      couponId: coupon.id,
      type: coupon.type,
      effectiveDiscount: effectiveDiscount.toFixed(2),
    };
  });
}

// ── Get single ────────────────────────────────────────────────────────────

export async function getCouponById(
  facilityId: string,
  couponId: string,
): Promise<CouponRow> {
  return withTenantContext(facilityId, async (tx) => {
    const coupon = await findCouponById(couponId, tx);
    if (!coupon) {
      throw new AppError('COUPON_NOT_FOUND', 'Coupon not found', 404);
    }
    return coupon;
  });
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listAllCoupons(
  facilityId: string,
  filters: { active?: boolean; search?: string; page: number; limit: number },
): Promise<{ rows: CouponRow[]; total: number }> {
  return withTenantContext(facilityId, async (tx) => {
    return listCoupons(filters, tx);
  });
}

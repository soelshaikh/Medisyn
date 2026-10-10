import type { CouponType, CouponValidationRejectionReason } from '../catalogue.types';

export interface CreateCouponInput {
  code: string;
  type: CouponType;
  discountValue: string;
  maxDiscountAmount?: string | null;
  minOrderTotal?: string | null;
  totalUsageLimit?: number | null;
  perCustomerUsageLimit?: number | null;
  applicableProductIds?: string[] | null;
  applicableCategoryIds?: string[] | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  internalNotes?: string | null;
}

export interface UpdateCouponInput {
  discountValue?: string;
  maxDiscountAmount?: string | null;
  minOrderTotal?: string | null;
  totalUsageLimit?: number | null;
  perCustomerUsageLimit?: number | null;
  applicableProductIds?: string[] | null;
  applicableCategoryIds?: string[] | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
  internalNotes?: string | null;
}

export interface ValidateCouponInput {
  code: string;
  orderTotal: string;
}

export interface CouponValidationSuccess {
  valid: true;
  couponId: string;
  type: CouponType;
  effectiveDiscount: string;
}

export interface CouponValidationFailure {
  valid: false;
  reason: CouponValidationRejectionReason;
}

export type CouponValidationResult = CouponValidationSuccess | CouponValidationFailure;

export interface CouponRow {
  id: string;
  facilityId: string;
  code: string;
  type: CouponType;
  discountValue: string;
  maxDiscountAmount: string | null;
  minOrderTotal: string | null;
  totalUsageLimit: number | null;
  perCustomerUsageLimit: number | null;
  totalRedemptionCount: number;
  applicableProductIds: string[] | null;
  applicableCategoryIds: string[] | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

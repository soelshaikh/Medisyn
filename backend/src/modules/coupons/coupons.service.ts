import { CouponModel } from "./coupons.schema";
import { OrderModel } from "@/modules/orders/orders.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function listCoupons(filters: { isActive?: boolean; page?: number; limit?: number } = {}) {
  const { isActive, page = 1, limit = 20 } = filters;
  const query: Record<string, unknown> = {};
  if (isActive !== undefined) query.isActive = isActive;
  const [total, data] = await Promise.all([
    CouponModel.countDocuments(query),
    CouponModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function createCoupon(data: {
  code: string; type: string; value: number;
  minOrderAmount?: number | null; maxDiscountAmount?: number | null;
  usageLimit?: number | null; perUserLimit?: number | null;
  applicableProductIds?: string[]; applicableCategoryIds?: string[];
  firstOrderOnly?: boolean; startDate?: Date | null; expiresAt?: Date | null;
}, actor?: AuditActor) {
  const exists = await CouponModel.findOne({ code: data.code.toUpperCase() });
  if (exists) throw new AppError("Coupon code already exists", 409);

  const coupon = await CouponModel.create(data);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "coupon.create",
    resource:   "coupon",
    resourceId: String(coupon._id),
    before:     null,
    after:      coupon.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return coupon;
}

export async function updateCoupon(id: string, data: Partial<{
  code: string; value: number; minOrderAmount: number | null;
  maxDiscountAmount: number | null; usageLimit: number | null;
  perUserLimit: number | null; applicableProductIds: string[];
  applicableCategoryIds: string[]; firstOrderOnly: boolean;
  startDate: Date | null; expiresAt: Date | null; isActive: boolean;
}>, actor?: AuditActor) {
  const before = await CouponModel.findById(id).lean();
  if (!before) throw new AppError("Coupon not found", 404);

  const coupon = await CouponModel.findByIdAndUpdate(id, data, { new: true });
  if (!coupon) throw new AppError("Coupon not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "coupon.update",
    resource:   "coupon",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      coupon.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return coupon;
}

export async function deleteCoupon(id: string, actor?: AuditActor) {
  const before = await CouponModel.findById(id).lean();
  if (!before) throw new AppError("Coupon not found", 404);

  await CouponModel.findByIdAndDelete(id);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "coupon.delete",
    resource:   "coupon",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      null,
    ipAddress:  actor?.ip,
  });
}

export interface ValidateResult {
  valid:          boolean;
  coupon?:        object;
  discountCents?: number;
  error?:         string;
}

export async function validateCoupon(
  code: string,
  subtotalCents: number,
  userId?: string,
  cartProductIds?: string[],
): Promise<ValidateResult> {
  const coupon = await CouponModel.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) return { valid: false, error: "Invalid coupon code" };

  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) return { valid: false, error: "Coupon not yet active" };
  if (coupon.expiresAt && coupon.expiresAt < now) return { valid: false, error: "Coupon has expired" };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, error: "Coupon usage limit reached" };
  }
  if (coupon.minOrderAmount && subtotalCents < coupon.minOrderAmount) {
    return { valid: false, error: `Minimum order amount not met` };
  }

  if (coupon.perUserLimit && userId) {
    const userUsage = await OrderModel.countDocuments({ userId, couponCode: code.toUpperCase() });
    if (userUsage >= coupon.perUserLimit) return { valid: false, error: "You have already used this coupon" };
  }

  if (coupon.firstOrderOnly && userId) {
    const priorOrders = await OrderModel.countDocuments({ userId });
    if (priorOrders > 0) return { valid: false, error: "Coupon only valid on first order" };
  }

  if (coupon.applicableProductIds.length > 0 && cartProductIds?.length) {
    const applicable = coupon.applicableProductIds.map(String);
    const hasApplicable = cartProductIds.some((id) => applicable.includes(id));
    if (!hasApplicable) return { valid: false, error: "Coupon not applicable to cart items" };
  }

  let discountCents = 0;
  if (coupon.type === "percentage") {
    discountCents = Math.round(subtotalCents * (coupon.value / 100));
    if (coupon.maxDiscountAmount) discountCents = Math.min(discountCents, coupon.maxDiscountAmount);
  } else if (coupon.type === "fixed_amount") {
    discountCents = Math.min(coupon.value, subtotalCents);
  } else if (coupon.type === "free_shipping") {
    discountCents = 0;
  }

  return { valid: true, coupon, discountCents };
}

export async function incrementUsage(code: string) {
  await CouponModel.findOneAndUpdate({ code: code.toUpperCase() }, { $inc: { usageCount: 1 } });
}

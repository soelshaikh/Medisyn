import mongoose, { type Document, Schema, type Types } from "mongoose";

export type CouponType = "percentage" | "fixed_amount" | "free_shipping";

export interface ICoupon extends Document {
  code:                  string;
  type:                  CouponType;
  value:                 number; // 0-100 for percentage, cents for fixed_amount, 0 for free_shipping
  minOrderAmount:        number | null; // cents
  maxDiscountAmount:     number | null; // cents — caps percentage discounts
  usageLimit:            number | null; // null = unlimited
  usageCount:            number;
  perUserLimit:          number | null;
  applicableProductIds:  Types.ObjectId[]; // empty = all products
  applicableCategoryIds: Types.ObjectId[]; // empty = all categories
  firstOrderOnly:        boolean;
  startDate:             Date | null;
  expiresAt:             Date | null;
  isActive:              boolean;
  createdAt:             Date;
  updatedAt:             Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code:                  { type: String, required: true, unique: true, uppercase: true, trim: true },
    type:                  { type: String, enum: ["percentage", "fixed_amount", "free_shipping"], required: true },
    value:                 { type: Number, required: true, min: 0 },
    minOrderAmount:        { type: Number, default: null },
    maxDiscountAmount:     { type: Number, default: null },
    usageLimit:            { type: Number, default: null },
    usageCount:            { type: Number, default: 0 },
    perUserLimit:          { type: Number, default: null },
    applicableProductIds:  [{ type: Schema.Types.ObjectId, ref: "Product" }],
    applicableCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    firstOrderOnly:        { type: Boolean, default: false },
    startDate:             { type: Date, default: null },
    expiresAt:             { type: Date, default: null },
    isActive:              { type: Boolean, default: true },
  },
  { timestamps: true }
);

CouponSchema.index({ code: 1 });
CouponSchema.index({ isActive: 1, expiresAt: 1 });

export const CouponModel = mongoose.model<ICoupon>("Coupon", CouponSchema);

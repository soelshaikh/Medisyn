import { z } from 'zod';

const numericString = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal');
const optionalNumeric = numericString.optional().nullable();

export const CreateCouponBodySchema = z
  .object({
    code: z.string().min(1).max(50),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    discountValue: numericString,
    maxDiscountAmount: optionalNumeric,
    minOrderTotal: optionalNumeric,
    totalUsageLimit: z.number().int().min(1).optional().nullable(),
    perCustomerUsageLimit: z.number().int().min(1).optional().nullable(),
    applicableProductIds: z.array(z.string().uuid()).optional().nullable(),
    applicableCategoryIds: z.array(z.string().uuid()).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
    internalNotes: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'PERCENTAGE') {
      const val = parseFloat(data.discountValue);
      if (val <= 0 || val > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PERCENTAGE discount value must be between 1 and 100',
          path: ['discountValue'],
        });
      }
    }
    if (data.maxDiscountAmount && data.type !== 'PERCENTAGE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxDiscountAmount is only valid for PERCENTAGE coupons',
        path: ['maxDiscountAmount'],
      });
    }
  });

export const UpdateCouponBodySchema = z
  .object({
    discountValue: numericString.optional(),
    maxDiscountAmount: optionalNumeric,
    minOrderTotal: optionalNumeric,
    totalUsageLimit: z.number().int().min(1).optional().nullable(),
    perCustomerUsageLimit: z.number().int().min(1).optional().nullable(),
    applicableProductIds: z.array(z.string().uuid()).optional().nullable(),
    applicableCategoryIds: z.array(z.string().uuid()).optional().nullable(),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
    internalNotes: z.string().max(1000).optional().nullable(),
  });

export const ValidateCouponBodySchema = z.object({
  code: z.string().min(1),
  orderTotal: numericString,
});

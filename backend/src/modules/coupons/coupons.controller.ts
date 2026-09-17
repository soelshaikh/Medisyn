import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./coupons.service";

const CouponDto = z.object({
  code:                  z.string().min(1).max(50),
  type:                  z.enum(["percentage", "fixed_amount", "free_shipping"]),
  value:                 z.number().min(0),
  minOrderAmount:        z.number().int().min(0).nullable().optional(),
  maxDiscountAmount:     z.number().int().min(0).nullable().optional(),
  usageLimit:            z.number().int().min(1).nullable().optional(),
  perUserLimit:          z.number().int().min(1).nullable().optional(),
  applicableProductIds:  z.array(z.string()).optional(),
  applicableCategoryIds: z.array(z.string()).optional(),
  firstOrderOnly:        z.boolean().optional(),
  startDate:             z.coerce.date().nullable().optional(),
  expiresAt:             z.coerce.date().nullable().optional(),
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { isActive, page, limit } = z.object({
    isActive: z.coerce.boolean().optional(),
    page:     z.coerce.number().int().min(1).optional(),
    limit:    z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listCoupons({ isActive, page, limit }));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CouponDto.parse(req.body);
  sendSuccess(res, await svc.createCoupon(dto), "Coupon created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = CouponDto.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  sendSuccess(res, await svc.updateCoupon(String(req.params.id), dto), "Coupon updated");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteCoupon(String(req.params.id));
  sendSuccess(res, null, "Coupon deleted");
});

export const validate = asyncHandler(async (req: Request, res: Response) => {
  const { subtotal, cartProductIds } = z.object({
    subtotal:       z.coerce.number().int().min(0),
    cartProductIds: z.array(z.string()).optional(),
  }).parse(req.query);
  const result = await svc.validateCoupon(
    String(req.params.code), subtotal,
    req.user?._id, cartProductIds,
  );
  sendSuccess(res, result);
});

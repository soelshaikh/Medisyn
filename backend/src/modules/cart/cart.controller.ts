import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./cart.service";

/* Helper — resolve userId and sessionId from request */
function resolveIdentity(req: Request) {
  const userId    = req.user?._id;
  const sessionId = req.cookies?.cartSession as string | undefined;
  return { userId, sessionId };
}

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const { userId, sessionId } = resolveIdentity(req);
  sendSuccess(res, await svc.getCartSummary(userId, sessionId));
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const { productId, quantity } = z.object({
    productId: z.string().min(1),
    quantity:  z.number().int().min(1).max(999),
  }).parse(req.body);
  const { userId, sessionId } = resolveIdentity(req);
  sendSuccess(res, await svc.addItem(productId, quantity, userId, sessionId), "Item added to cart");
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { quantity } = z.object({ quantity: z.number().int().min(0).max(999) }).parse(req.body);
  const { userId, sessionId } = resolveIdentity(req);
  sendSuccess(res, await svc.updateItem(String(req.params.productId), quantity, userId, sessionId));
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { userId, sessionId } = resolveIdentity(req);
  sendSuccess(res, await svc.removeItem(String(req.params.productId), userId, sessionId), "Item removed");
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
  const { userId, sessionId } = resolveIdentity(req);
  sendSuccess(res, await svc.applyCoupon(code, userId, sessionId), "Coupon applied");
});

export const removeCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { userId, sessionId } = resolveIdentity(req);
  sendSuccess(res, await svc.removeCoupon(userId, sessionId), "Coupon removed");
});

export const mergeCart = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.body);
  if (!req.user) throw new Error("Auth required");
  sendSuccess(res, await svc.mergeGuestCart(req.user._id, sessionId), "Cart merged");
});

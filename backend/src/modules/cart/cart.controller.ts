import type { Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { config } from "@/config";
import * as svc from "./cart.service";

const CART_COOKIE = "cartSession";
const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function resolveIdentity(req: Request) {
  return {
    userId:    req.user?._id as string | undefined,
    sessionId: req.cookies?.[CART_COOKIE] as string | undefined,
  };
}

function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(CART_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure:   config.NODE_ENV === "production",
    maxAge:   CART_TTL_MS,
  });
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

  let { userId, sessionId } = resolveIdentity(req);

  /* Guest: generate + set a persistent session cookie */
  if (!userId && !sessionId) {
    sessionId = uuidv4();
    setSessionCookie(res, sessionId);
  }

  await svc.addItem(productId, quantity, userId, sessionId);
  sendSuccess(res, await svc.getCartSummary(userId, sessionId), "Item added to cart");
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const { quantity } = z.object({ quantity: z.number().int().min(0).max(999) }).parse(req.body);
  const { userId, sessionId } = resolveIdentity(req);
  await svc.updateItem(String(req.params.productId), quantity, userId, sessionId);
  sendSuccess(res, await svc.getCartSummary(userId, sessionId));
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const { userId, sessionId } = resolveIdentity(req);
  await svc.removeItem(String(req.params.productId), userId, sessionId);
  sendSuccess(res, await svc.getCartSummary(userId, sessionId), "Item removed");
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
  const { userId, sessionId } = resolveIdentity(req);
  await svc.applyCoupon(code, userId, sessionId);
  sendSuccess(res, await svc.getCartSummary(userId, sessionId), "Coupon applied");
});

export const removeCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { userId, sessionId } = resolveIdentity(req);
  await svc.removeCoupon(userId, sessionId);
  sendSuccess(res, await svc.getCartSummary(userId, sessionId), "Coupon removed");
});

export const mergeCart = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(req.body);
  if (!req.user) throw new Error("Auth required");
  sendSuccess(res, await svc.mergeGuestCart(req.user._id, sessionId), "Cart merged");
});

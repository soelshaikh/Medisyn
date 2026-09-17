import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./orders.service";

const ProvinceEnum = z.enum([
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"
]);

const ShippingAddressDto = z.object({
  fullName:   z.string().min(1),
  phone:      z.string().min(7),
  address1:   z.string().min(1),
  address2:   z.string().optional().default(""),
  city:       z.string().min(1),
  province:   ProvinceEnum,
  postalCode: z.string().min(6).max(7),
  country:    z.literal("CA").default("CA"),
});

const CheckoutDto = z.object({
  shippingAddress: ShippingAddressDto,
  paymentMethod:   z.enum(["pickup", "delivery"]),
  notes:           z.string().max(500).optional(),
  sessionId:       z.string().optional(),
  guestInfo: z.object({
    email:    z.string().email(),
    fullName: z.string().min(1),
    phone:    z.string().min(7),
  }).optional(),
});

function actor(req: Request) {
  if (!req.user) return undefined;
  return { id: req.user._id, email: req.user.email, name: req.user.fullName, ip: req.ip };
}

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const dto    = CheckoutDto.parse(req.body);
  const userId = req.user?._id;
  if (!userId && !dto.guestInfo) {
    throw { statusCode: 400, message: "Guest checkout requires guestInfo (email, fullName, phone)" };
  }
  const order = await svc.checkout({
    ...dto,
    shippingAddress: { ...dto.shippingAddress, country: "CA" },
    userId,
    sessionId: dto.sessionId,
  });
  sendSuccess(res, order, "Order placed successfully", 201);
});

export const myOrders = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listUserOrders(req.user!._id, page, limit));
});

export const myOrder = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getOrder(String(req.params.id), req.user!._id))
);

export const adminList = asyncHandler(async (req: Request, res: Response) => {
  const filters = z.object({
    status:   z.string().optional(),
    search:   z.string().optional(),
    page:     z.coerce.number().int().min(1).optional(),
    limit:    z.coerce.number().int().min(1).max(100).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo:   z.coerce.date().optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminOrders(filters));
});

export const adminGet = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await svc.getOrder(String(req.params.id)))
);

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, note } = z.object({
    status: z.enum(["pending","confirmed","processing","ready_for_pickup","delivered","cancelled"]),
    note:   z.string().max(500).optional().default(""),
  }).parse(req.body);
  sendSuccess(res, await svc.updateOrderStatus(
    String(req.params.id), status, note, req.user!._id, actor(req),
  ), "Order status updated");
});

export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addAdminNote(String(req.params.id), note, actor(req)), "Note added");
});

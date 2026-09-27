import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./appointment-slots.service";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const router = Router();

/* ── Public: available slots for patients ── */
router.get("/available", asyncHandler(async (req, res) => {
  const { vaccineServiceId } = z.object({
    vaccineServiceId: z.string().optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAvailableSlots(vaccineServiceId));
}));

/* ── Admin ── */
router.get("/", authenticate, requirePermission("appointments.availability.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    vaccineServiceId: z.string().optional(),
    status:           z.string().optional(),
    date:             z.string().optional(),
    page:             z.coerce.number().int().min(1).optional(),
    limit:            z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminSlots(filters));
}));

router.get("/:id", authenticate, requirePermission("appointments.availability.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getSlot(String(req.params.id)));
}));

router.post("/", authenticate, requirePermission("appointments.availability.manage"), asyncHandler(async (req, res) => {
  const dto = z.object({
    vaccineServiceId: z.string().min(1),
    date:             z.coerce.date(),
    startTime:        z.string().regex(/^\d{2}:\d{2}$/),
    endTime:          z.string().regex(/^\d{2}:\d{2}$/),
    capacity:         z.number().int().min(1),
    capacityType:     z.enum(["strict","open"]).default("strict"),
    adminNotes:       z.string().max(1000).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.createSlot(dto, actor(req)), "Slot created", 201);
}));

router.patch("/:id", authenticate, requirePermission("appointments.availability.manage"), asyncHandler(async (req, res) => {
  const dto = z.object({
    date:         z.coerce.date().optional(),
    startTime:    z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime:      z.string().regex(/^\d{2}:\d{2}$/).optional(),
    capacity:     z.number().int().min(1).optional(),
    capacityType: z.enum(["strict","open"]).optional(),
    adminNotes:   z.string().max(1000).optional(),
    status:       z.enum(["active","cancelled"]).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateSlot(String(req.params.id), dto, actor(req)), "Updated");
}));

export default router;

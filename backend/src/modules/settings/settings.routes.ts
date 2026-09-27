import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./settings.service";

const router = Router();
router.use(authenticate);

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/* GET /settings (requires settings.read) */
router.get("/", requirePermission("settings.read"), asyncHandler(async (_req, res) => {
  sendSuccess(res, await svc.getSettings());
}));

/* PATCH /settings/info */
router.patch("/info", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const dto = z.object({
    pharmacyName:  z.string().min(1).max(200).optional(),
    phone:         z.string().optional(),
    email:         z.string().email().optional(),
    address:       z.string().optional(),
    city:          z.string().optional(),
    province:      z.string().length(2).optional(),
    postalCode:    z.string().optional(),
    licenseNumber: z.string().optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateInfo(dto), "Settings updated");
}));

/* PUT /settings/hours */
router.put("/hours", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const dto = z.array(z.object({
    day:       z.number().int().min(0).max(6),
    isOpen:    z.boolean(),
    openTime:  z.string().regex(TimeRegex),
    closeTime: z.string().regex(TimeRegex),
  })).length(7);
  const hours = dto.parse(req.body);
  sendSuccess(res, await svc.updateWorkingHours(hours), "Working hours updated");
}));

/* POST /settings/holidays */
router.post("/holidays", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const dto = z.object({
    date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name:     z.string().min(1).max(100),
    isClosed: z.boolean().optional().default(true),
  }).parse(req.body);
  sendSuccess(res, await svc.addHoliday(dto), "Holiday added", 201);
}));

/* PATCH /settings/holidays/:id */
router.patch("/holidays/:id", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const dto = z.object({
    date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    name:     z.string().min(1).max(100).optional(),
    isClosed: z.boolean().optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateHoliday(String(req.params.id), dto), "Holiday updated");
}));

/* DELETE /settings/holidays/:id */
router.delete("/holidays/:id", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.deleteHoliday(String(req.params.id)), "Holiday deleted");
}));

export default router;

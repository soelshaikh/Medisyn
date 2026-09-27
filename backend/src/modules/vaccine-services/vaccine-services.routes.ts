import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./vaccine-services.service";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const router = Router();

/* ── Public ── */
router.get("/", asyncHandler(async (_req, res) => {
  sendSuccess(res, await svc.listVaccineServices());
}));

router.get("/by-slug/:slug", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getVaccineServiceBySlug(String(req.params.slug)));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getVaccineService(String(req.params.id)));
}));

/* ── Admin ── */
router.get("/admin/all", authenticate, requirePermission("vaccines.read"), asyncHandler(async (_req, res) => {
  sendSuccess(res, await svc.listAdminVaccineServices());
}));

router.post("/", authenticate, requirePermission("vaccines.create"), asyncHandler(async (req, res) => {
  const dto = z.object({
    name:             z.string().min(1).max(200),
    description:      z.string().max(1000).optional(),
    eligibilityNotes: z.string().max(1000).optional(),
    durationMinutes:  z.number().int().min(1).max(120).optional(),
    sortOrder:        z.number().int().min(0).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.createVaccineService(dto, actor(req)), "Vaccine service created", 201);
}));

router.patch("/admin/sort-order", authenticate, requirePermission("vaccines.update"), asyncHandler(async (req, res) => {
  const dto = z.object({
    items: z.array(z.object({ id: z.string(), sortOrder: z.number().int().min(0) })).min(1).max(200),
  }).parse(req.body);
  sendSuccess(res, await svc.batchUpdateSortOrder(dto.items, actor(req)), "Sort order updated");
}));

router.patch("/:id", authenticate, requirePermission("vaccines.update"), asyncHandler(async (req, res) => {
  const dto = z.object({
    name:             z.string().min(1).max(200).optional(),
    description:      z.string().max(1000).optional(),
    eligibilityNotes: z.string().max(1000).optional(),
    durationMinutes:  z.number().int().min(1).max(120).optional(),
    sortOrder:        z.number().int().min(0).optional(),
    status:           z.enum(["active","inactive"]).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateVaccineService(String(req.params.id), dto, actor(req)), "Updated");
}));

router.delete("/:id", authenticate, requirePermission("vaccines.delete"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.deleteVaccineService(String(req.params.id), actor(req)), "Deactivated");
}));

export default router;

import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import * as svc from "./clinics.service";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission("clinics.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listClinics(filters));
}));

router.get("/:id", requirePermission("clinics.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getClinic(String(req.params.id)));
}));

router.patch("/:id/status", requirePermission("clinics.approve"), asyncHandler(async (req, res) => {
  const { status } = z.object({
    status: z.enum(["active", "approved", "rejected", "suspended", "deactivated"]),
  }).parse(req.body);
  sendSuccess(res,
    await svc.updateClinicStatus(String(req.params.id), status, req.user!._id, req.user!.email, req.user!.fullName, req.ip),
    "Clinic status updated",
  );
}));

router.post("/:id/notes", requirePermission("clinics.approve"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addClinicAdminNote(String(req.params.id), note, req.user!._id, req.user!.email, req.user!.fullName, req.ip), "Note added");
}));

export default router;

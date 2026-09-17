import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./ailment-request.service";
import type { AilmentRequestStatus } from "./ailment-request.schema";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const router = Router();
router.use(authenticate);

/* ── Patient routes ── */
router.post("/", asyncHandler(async (req, res) => {
  const dto = z.object({
    ailmentId: z.string().min(1),
    formData:  z.record(z.unknown()),
    notes:     z.string().max(1000).optional(),
  }).parse(req.body);

  sendSuccess(res, await svc.createAilmentRequest({
    patientId: req.user!._id,
    ...dto,
  }), "Request submitted", 201);
}));

router.get("/my", asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listPatientAilmentRequests(req.user!._id, page, limit));
}));

router.get("/my/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getPatientAilmentRequest(String(req.params.id), req.user!._id));
}));

/* ── Admin routes ── */
router.get("/admin", requirePermission("healthcare.ailments.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminAilmentRequests(filters));
}));

router.get("/admin/:id", requirePermission("healthcare.ailments.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getAdminAilmentRequest(String(req.params.id)));
}));

router.patch("/admin/:id/status", requirePermission("healthcare.ailments.manage"), asyncHandler(async (req, res) => {
  const { status, note } = z.object({
    status: z.enum(["submitted","reviewing","responded","closed"] as [AilmentRequestStatus, ...AilmentRequestStatus[]]),
    note:   z.string().max(500).optional().default(""),
  }).parse(req.body);
  sendSuccess(res, await svc.updateAilmentRequestStatus(String(req.params.id), status, note, actor(req)), "Status updated");
}));

router.post("/admin/:id/respond", requirePermission("healthcare.ailments.manage"), asyncHandler(async (req, res) => {
  const { responseText } = z.object({ responseText: z.string().min(1).max(5000) }).parse(req.body);
  sendSuccess(res, await svc.respondToAilmentRequest(String(req.params.id), responseText, actor(req)), "Response sent");
}));

router.post("/admin/:id/notes", requirePermission("healthcare.ailments.manage"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addAilmentRequestAdminNote(String(req.params.id), note, actor(req)), "Note added");
}));

export default router;

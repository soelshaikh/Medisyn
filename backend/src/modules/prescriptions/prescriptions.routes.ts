import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./prescriptions.service";
import type { PrescriptionStatus } from "./prescriptions.schema";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const PRESCRIPTION_STATUSES: [PrescriptionStatus, ...PrescriptionStatus[]] = ["active","expired","cancelled"];

const CreateDto = z.object({
  prescriptionNumber: z.string().min(1).max(100),
  prescriberName:     z.string().min(1).max(200),
  prescriberLicense:  z.string().max(100).optional(),
  prescriberPhone:    z.string().max(30).optional(),
  medicationName:     z.string().min(1).max(200),
  dosage:             z.string().max(100).optional(),
  refillsRemaining:   z.number().int().min(0).optional(),
  expiresAt:          z.coerce.date().nullable().optional(),
  notes:              z.string().max(1000).optional(),
});

const router = Router();
router.use(authenticate);

/* ── Patient routes ── */
router.post("/", asyncHandler(async (req, res) => {
  const dto = CreateDto.parse(req.body);
  sendSuccess(res, await svc.createPrescription({
    patientId: req.user!._id,
    ...dto,
  }), "Prescription added", 201);
}));

router.get("/my", asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listPatientPrescriptions(req.user!._id, page, limit));
}));

router.get("/my/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getPatientPrescription(String(req.params.id), req.user!._id));
}));

router.patch("/my/:id", asyncHandler(async (req, res) => {
  const dto = CreateDto.partial().parse(req.body);
  sendSuccess(res, await svc.updatePrescription(String(req.params.id), dto), "Prescription updated");
}));

/* ── Admin routes ── */
router.get("/admin", requirePermission("healthcare.prescriptions.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminPrescriptions(filters));
}));

router.get("/admin/:id", requirePermission("healthcare.prescriptions.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getAdminPrescription(String(req.params.id)));
}));

router.patch("/admin/:id/status", requirePermission("healthcare.prescriptions.manage"), asyncHandler(async (req, res) => {
  const { status, note } = z.object({
    status: z.enum(PRESCRIPTION_STATUSES),
    note:   z.string().max(500).optional().default(""),
  }).parse(req.body);
  sendSuccess(res, await svc.updatePrescriptionStatus(String(req.params.id), status, note, actor(req)), "Status updated");
}));

router.post("/admin/:id/notes", requirePermission("healthcare.prescriptions.manage"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addPrescriptionAdminNote(String(req.params.id), note, actor(req)), "Note added");
}));

export default router;

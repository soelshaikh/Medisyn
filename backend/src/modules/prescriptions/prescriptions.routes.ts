import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./prescriptions.service";
import type { PrescriptionStatus } from "./prescriptions.schema";
import { logAction } from "@/modules/audit/audit.service";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const PRESCRIPTION_STATUSES: [PrescriptionStatus, ...PrescriptionStatus[]] = [
  "submitted","received","verified","dispensed","cancelled",
];

const CreateDto = z.object({
  requestType:           z.enum(["standard","new_delivery","refill","transfer"]).optional(),
  prescriptionNumber:    z.string().max(100).optional().default(""),
  prescriberName:        z.string().max(200).optional().default(""),
  prescriberLicense:     z.string().max(100).optional(),
  prescriberPhone:       z.string().max(30).optional(),
  medicationName:        z.string().max(200).optional().default(""),
  dosage:                z.string().max(100).optional(),
  refillsRemaining:      z.number().int().min(0).optional(),
  expiresAt:             z.coerce.date().nullable().optional(),
  notes:                 z.string().max(2000).optional(),
  /* Request-type-specific */
  deliveryAddress:       z.string().max(500).optional(),
  dateOfBirth:           z.string().max(20).optional(),
  previousPharmacyName:  z.string().max(200).optional(),
  previousPharmacyPhone: z.string().max(30).optional(),
  transferAll:           z.boolean().optional(),
  rxNumbers:             z.array(z.string().max(100)).max(10).optional(),
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
router.get("/admin", requirePermission("prescriptions.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminPrescriptions(filters));
}));

router.get("/admin/:id", requirePermission("prescriptions.read"), asyncHandler(async (req, res) => {
  const result = await svc.getAdminPrescription(String(req.params.id));
  /* PHIPA — log every staff read of patient prescription data */
  logAction({ action: "phi.read", resource: "prescription", resourceId: String(req.params.id), userId: String(req.user!._id), userEmail: req.user!.email, actorName: req.user!.fullName, ipAddress: req.ip });
  sendSuccess(res, result);
}));

router.patch("/admin/:id/status", requirePermission("prescriptions.status.update"), asyncHandler(async (req, res) => {
  const { status, note } = z.object({
    status: z.enum(PRESCRIPTION_STATUSES),
    note:   z.string().max(500).optional().default(""),
  }).parse(req.body);
  sendSuccess(
    res,
    await svc.updatePrescriptionStatus(
      String(req.params.id), status, note, actor(req),
      new Set(req.user!.effectivePermissions),
    ),
    "Status updated",
  );
}));

router.post("/admin/:id/notes", requirePermission("prescriptions.notes"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addPrescriptionAdminNote(String(req.params.id), note, actor(req)), "Note added");
}));

export default router;

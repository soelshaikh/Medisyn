import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./compounding.service";
import type { CompoundingStatus } from "./compounding.schema";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const COMPOUNDING_STATUSES: [CompoundingStatus, ...CompoundingStatus[]] = [
  "submitted","reviewing","quote_sent","approved","in_production","ready","delivered","cancelled"
];

const router = Router();
router.use(authenticate);

/* ── Patient routes ── */
router.post("/", asyncHandler(async (req, res) => {
  const dto = z.object({
    medicationName:    z.string().min(1).max(200),
    strength:          z.string().max(100).optional(),
    form:              z.enum(["capsule","cream","liquid","suppository","other"]),
    quantity:          z.string().min(1).max(100),
    prescriberName:    z.string().min(1).max(200),
    prescriberLicense: z.string().min(1).max(100),
    notes:             z.string().max(1000).optional(),
    fileUrl:           z.string().optional(),
  }).parse(req.body);

  sendSuccess(res, await svc.createCompoundingRequest({
    patientId: req.user!._id,
    ...dto,
  }), "Compounding request submitted", 201);
}));

router.get("/my", asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listPatientCompoundingRequests(req.user!._id, page, limit));
}));

router.get("/my/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getPatientCompoundingRequest(String(req.params.id), req.user!._id));
}));

/* ── Admin routes ── */
router.get("/admin", requirePermission("healthcare.compounding.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminCompoundingRequests(filters));
}));

router.get("/admin/:id", requirePermission("healthcare.compounding.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getAdminCompoundingRequest(String(req.params.id)));
}));

router.patch("/admin/:id/status", requirePermission("healthcare.compounding.manage"), asyncHandler(async (req, res) => {
  const { status, note, quoteAmount, quoteNote } = z.object({
    status:      z.enum(COMPOUNDING_STATUSES),
    note:        z.string().max(500).optional().default(""),
    quoteAmount: z.number().int().min(0).nullable().optional(),
    quoteNote:   z.string().max(500).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.updateCompoundingStatus(
    String(req.params.id), status, note, actor(req), quoteAmount, quoteNote,
  ), "Status updated");
}));

router.post("/admin/:id/notes", requirePermission("healthcare.compounding.manage"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addCompoundingAdminNote(String(req.params.id), note, actor(req)), "Note added");
}));

export default router;

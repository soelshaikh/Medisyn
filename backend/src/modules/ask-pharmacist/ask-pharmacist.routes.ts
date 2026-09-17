import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./ask-pharmacist.service";
import type { AskPharmacistStatus } from "./ask-pharmacist.schema";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const ASK_STATUSES: [AskPharmacistStatus, ...AskPharmacistStatus[]] = ["open","answered","closed"];

const router = Router();
router.use(authenticate);

/* ── Patient routes ── */
router.post("/", asyncHandler(async (req, res) => {
  const dto = z.object({
    subject:  z.string().min(1).max(200),
    question: z.string().min(1).max(5000),
    fileUrl:  z.string().optional(),
  }).parse(req.body);

  sendSuccess(res, await svc.createAskPharmacistRequest({
    patientId: req.user!._id,
    ...dto,
  }), "Question submitted", 201);
}));

router.get("/my", asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listPatientAskRequests(req.user!._id, page, limit));
}));

router.get("/my/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getPatientAskRequest(String(req.params.id), req.user!._id));
}));

/* ── Admin routes ── */
router.get("/admin", requirePermission("healthcare.ask_pharmacist.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminAskRequests(filters));
}));

router.get("/admin/:id", requirePermission("healthcare.ask_pharmacist.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getAdminAskRequest(String(req.params.id)));
}));

router.post("/admin/:id/respond", requirePermission("healthcare.ask_pharmacist.manage"), asyncHandler(async (req, res) => {
  const { responseText } = z.object({ responseText: z.string().min(1).max(5000) }).parse(req.body);
  sendSuccess(res, await svc.respondToAskPharmacist(String(req.params.id), responseText, actor(req)), "Response sent");
}));

router.patch("/admin/:id/status", requirePermission("healthcare.ask_pharmacist.manage"), asyncHandler(async (req, res) => {
  const { status, note } = z.object({
    status: z.enum(ASK_STATUSES),
    note:   z.string().max(500).optional().default(""),
  }).parse(req.body);
  sendSuccess(res, await svc.updateAskPharmacistStatus(String(req.params.id), status, note, actor(req)), "Status updated");
}));

router.post("/admin/:id/notes", requirePermission("healthcare.ask_pharmacist.manage"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addAskPharmacistAdminNote(String(req.params.id), note, actor(req)), "Note added");
}));

export default router;

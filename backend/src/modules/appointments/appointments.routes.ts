import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import type { Request } from "express";
import * as svc from "./appointments.service";
import type { AppointmentStatus } from "./appointments.schema";

function actor(req: Request) {
  return { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip };
}

const APPT_STATUSES: [AppointmentStatus, ...AppointmentStatus[]] = [
  "pending", "confirmed", "cancelled", "completed", "no_show",
];

const router = Router();
router.use(authenticate);

/* ── Patient routes ── */
router.post("/", asyncHandler(async (req, res) => {
  const dto = z.object({
    slotId:           z.string().min(1),
    vaccineServiceId: z.string().min(1),
    patientNotes:     z.string().max(1000).optional(),
  }).parse(req.body);
  sendSuccess(res, await svc.createBookingRequest({
    patientId: req.user!._id,
    ...dto,
  }), "Booking request submitted", 201);
}));

router.get("/my", asyncHandler(async (req, res) => {
  const { page, limit } = z.object({
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listPatientBookings(req.user!._id, page, limit));
}));

router.get("/my/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getPatientBooking(String(req.params.id), req.user!._id));
}));

router.delete("/my/:id", asyncHandler(async (req, res) => {
  const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body);
  sendSuccess(res, await svc.cancelPatientBooking(String(req.params.id), req.user!._id, reason), "Booking cancelled");
}));

/* ── Admin routes ── */
router.get("/admin", requirePermission("appointments.read"), asyncHandler(async (req, res) => {
  const filters = z.object({
    status:           z.string().optional(),
    slotId:           z.string().optional(),
    vaccineServiceId: z.string().optional(),
    search:           z.string().optional(),
    page:             z.coerce.number().int().min(1).optional(),
    limit:            z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);
  sendSuccess(res, await svc.listAdminBookings(filters));
}));

router.get("/admin/:id", requirePermission("appointments.read"), asyncHandler(async (req, res) => {
  sendSuccess(res, await svc.getAdminBooking(String(req.params.id)));
}));

router.patch("/admin/:id/status", requirePermission("appointments.status.update"), asyncHandler(async (req, res) => {
  const { status, note } = z.object({
    status: z.enum(APPT_STATUSES),
    note:   z.string().max(500).optional().default(""),
  }).parse(req.body);
  sendSuccess(res, await svc.updateBookingStatus(String(req.params.id), status, note, actor(req)), "Status updated");
}));

router.patch("/admin/:id/reply", requirePermission("appointments.status.update"), asyncHandler(async (req, res) => {
  const { reply } = z.object({ reply: z.string().max(2000) }).parse(req.body);
  sendSuccess(res, await svc.setBookingAdminReply(String(req.params.id), reply, actor(req)), "Reply saved");
}));

router.post("/admin/:id/notes", requirePermission("appointments.read"), asyncHandler(async (req, res) => {
  const { note } = z.object({ note: z.string().min(1).max(2000) }).parse(req.body);
  sendSuccess(res, await svc.addBookingAdminNote(String(req.params.id), note, actor(req)), "Note added");
}));

export default router;

import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import { AppointmentInterestModel, type AppointmentInterestStatus } from "./appointment-interest.schema";

const router = Router();

const SubmitDto = z.object({
  firstName:          z.string().min(1).max(100),
  lastName:           z.string().max(100).optional().default(""),
  email:              z.string().email(),
  phone:              z.string().min(1).max(30),
  vaccineServiceName: z.string().max(150).optional().default(""),
  preferredDate:      z.string().max(50).optional().default(""),
  preferredTime:      z.string().max(50).optional().default(""),
  notes:              z.string().max(2000).optional().default(""),
  termsAccepted:      z.boolean().optional().default(false),
});

const STATUSES: [AppointmentInterestStatus, ...AppointmentInterestStatus[]] = ["new","contacted","resolved"];

/* Patient — submit interest request (auth required) */
router.post("/", authenticate, asyncHandler(async (req, res) => {
  const data = SubmitDto.parse(req.body);
  const interest = await AppointmentInterestModel.create({
    ...data,
    patientId: req.user!._id,
  });
  sendSuccess(res, interest, "Request submitted", 201);
}));

/* Patient — list own interest requests */
router.get("/my", authenticate, asyncHandler(async (req, res) => {
  const requests = await AppointmentInterestModel
    .find({ patientId: req.user!._id })
    .sort({ createdAt: -1 })
    .lean();
  sendSuccess(res, requests);
}));

/* Admin — list all */
router.get("/admin", authenticate, requirePermission("appointments.interest.read"), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = z.object({
    status: z.string().optional(),
    page:   z.coerce.number().int().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).optional(),
  }).parse(req.query);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await AppointmentInterestModel.countDocuments(filter);
  const docs  = await AppointmentInterestModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("patientId", "fullName email")
    .lean();

  sendSuccess(res, { data: docs, total, page: Number(page), limit: Number(limit) });
}));

/* Admin — update status */
router.patch("/admin/:id/status", authenticate, requirePermission("appointments.interest.manage"), asyncHandler(async (req, res) => {
  const { status, adminNote } = z.object({
    status:    z.enum(STATUSES),
    adminNote: z.string().max(1000).optional(),
  }).parse(req.body);

  const interest = await AppointmentInterestModel.findByIdAndUpdate(
    req.params.id,
    { $set: { status, ...(adminNote !== undefined && { adminNote }) } },
    { new: true }
  );
  if (!interest) throw new AppError("Request not found", 404);
  sendSuccess(res, interest, "Status updated");
}));

export default router;

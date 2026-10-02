import { AppointmentBookingModel, type AppointmentStatus } from "./appointments.schema";
import { AppointmentSlotModel } from "@/modules/appointment-slots/appointment-slots.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { EmailTriggerService } from "@/modules/email/email-trigger.service";
import { UserModel } from "@/modules/users/users.schema";
import { createNotification, notifyAdmins } from "@/modules/notifications/notifications.service";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";
import { logger } from "@/common/utils/logger";

/* ────────────────────────────────────────────────
   Patient operations
──────────────────────────────────────────────── */

export async function createBookingRequest(data: {
  patientId:       string;
  slotId:          string;
  vaccineServiceId:string;
  patientNotes?:   string;
}) {
  const slot = await AppointmentSlotModel.findOne({ _id: data.slotId, status: "active" }).lean();
  if (!slot) throw new AppError("Slot not found or no longer available", 404);

  /* STRICT slots: block submission if fully booked */
  if (slot.capacityType === "strict" && slot.bookedCount >= slot.capacity) {
    throw new AppError("This appointment slot is fully booked", 409);
  }

  /* One pending/confirmed booking per patient per slot */
  const existing = await AppointmentBookingModel.findOne({
    patientId: data.patientId,
    slotId:    data.slotId,
    status:    { $in: ["pending", "confirmed"] },
  });
  if (existing) throw new AppError("You already have a booking for this slot", 409);

  const booking = await AppointmentBookingModel.create({
    ...data,
    status: "pending",
    statusHistory: [{
      status:        "pending",
      changedAt:     new Date(),
      changedBy:     null,
      changedByName: "",
      note:          "Booking request submitted by patient",
    }],
  });

  /* Notify admins of new booking request */
  notifyAdmins({
    type:     "appointment_update",
    title:    "New Appointment Booking",
    message:  "A patient has submitted a new appointment booking request.",
    metadata: { bookingId: String(booking._id) },
  });

  return booking;
}

export async function listPatientBookings(patientId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    AppointmentBookingModel.countDocuments({ patientId }),
    AppointmentBookingModel.find({ patientId })
      .populate("slotId", "date startTime endTime capacityType")
      .populate("vaccineServiceId", "name durationMinutes")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getPatientBooking(id: string, patientId: string) {
  const booking = await AppointmentBookingModel.findOne({ _id: id, patientId })
    .populate("slotId", "date startTime endTime capacityType capacity")
    .populate("vaccineServiceId", "name eligibilityNotes durationMinutes")
    .lean();
  if (!booking) throw new AppError("Booking not found", 404);
  return booking;
}

export async function cancelPatientBooking(id: string, patientId: string, reason?: string) {
  const booking = await AppointmentBookingModel.findOne({ _id: id, patientId });
  if (!booking) throw new AppError("Booking not found", 404);
  if (!["pending", "confirmed"].includes(booking.status)) {
    throw new AppError("Booking cannot be cancelled in its current state", 400);
  }

  const wasConfirmed = booking.status === "confirmed";
  booking.status             = "cancelled";
  booking.cancelledAt        = new Date();
  booking.cancelledBy        = "patient";
  booking.cancellationReason = reason ?? "";
  booking.statusHistory.push({
    status:        "cancelled",
    changedAt:     new Date(),
    changedBy:     null,
    changedByName: "Patient",
    note:          reason ?? "Cancelled by patient",
  });
  await booking.save();

  /* Return the confirmed slot count if the booking was confirmed */
  if (wasConfirmed) {
    await AppointmentSlotModel.findByIdAndUpdate(
      booking.slotId,
      { $inc: { bookedCount: -1 } },
    );
  }

  return booking;
}

/* ────────────────────────────────────────────────
   Admin operations
──────────────────────────────────────────────── */

export async function listAdminBookings(filters: {
  status?: string; slotId?: string; vaccineServiceId?: string;
  search?: string; page?: number; limit?: number;
} = {}) {
  const { status, slotId, vaccineServiceId, search, page = 1, limit = 25 } = filters;
  const query: Record<string, unknown> = {};
  if (status)           query.status           = status;
  if (slotId)           query.slotId           = slotId;
  if (vaccineServiceId) query.vaccineServiceId = vaccineServiceId;

  const [total, data] = await Promise.all([
    AppointmentBookingModel.countDocuments(query),
    AppointmentBookingModel.find(query)
      .populate("patientId",        "fullName email phone")
      .populate("slotId",           "date startTime endTime capacityType capacity bookedCount")
      .populate("vaccineServiceId", "name")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getAdminBooking(id: string) {
  const booking = await AppointmentBookingModel.findById(id)
    .select("+adminNotes")
    .populate("patientId",        "fullName email phone")
    .populate("slotId",           "date startTime endTime capacityType capacity bookedCount adminNotes")
    .populate("vaccineServiceId", "name eligibilityNotes durationMinutes")
    .lean();
  if (!booking) throw new AppError("Booking not found", 404);
  return booking;
}

export async function updateBookingStatus(
  id:     string,
  status: AppointmentStatus,
  note:   string,
  actor:  AuditActor,
) {
  const booking = await AppointmentBookingModel.findById(id);
  if (!booking) throw new AppError("Booking not found", 404);

  const oldStatus = booking.status;

  /* ── Concurrency-safe confirmation ── */
  if (status === "confirmed" && oldStatus !== "confirmed") {
    const slot = await AppointmentSlotModel.findById(booking.slotId);
    if (!slot || slot.status !== "active") throw new AppError("Slot is no longer active", 400);

    if (slot.capacityType === "strict") {
      /* Atomic: increment only if capacity allows */
      const updated = await AppointmentSlotModel.findOneAndUpdate(
        { _id: booking.slotId, $expr: { $lt: ["$bookedCount", "$capacity"] } },
        { $inc: { bookedCount: 1 } },
        { new: true },
      );
      if (!updated) throw new AppError("Slot is fully booked — cannot confirm this booking", 409);
    } else {
      /* OPEN slot: always allow, just track */
      await AppointmentSlotModel.findByIdAndUpdate(booking.slotId, { $inc: { bookedCount: 1 } });
    }
  }

  /* ── If moving away from confirmed: return the slot count ── */
  if (oldStatus === "confirmed" && status !== "confirmed") {
    await AppointmentSlotModel.findByIdAndUpdate(
      booking.slotId,
      { $inc: { bookedCount: -1 } },
    );
  }

  booking.status = status;
  if (["cancelled"].includes(status)) {
    booking.cancelledAt  = new Date();
    booking.cancelledBy  = "admin";
  }
  booking.statusHistory.push({
    status,
    changedAt:     new Date(),
    changedBy:     actor.id as unknown as import("mongoose").Types.ObjectId,
    changedByName: actor.name,
    note,
  });

  const saved = await booking.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: `appointment.status.${status}`,
    resource: "appointment_booking", resourceId: id,
    before: { status: oldStatus }, after: { status },
    details: { note }, ipAddress: actor.ip,
  });

  /* Fire-and-forget: email + notification */
  void _appointmentStatusSideEffects(saved, oldStatus, status);

  return saved;
}

async function _appointmentStatusSideEffects(
  booking: Awaited<ReturnType<typeof AppointmentBookingModel.prototype.save>>,
  oldStatus: AppointmentStatus,
  status: AppointmentStatus,
) {
  try {
    const patient = await UserModel.findById(booking.patientId).select("email fullName").lean();
    if (!patient) return;

    /* Build human-readable date/time */
    const slot = await AppointmentSlotModel.findById(booking.slotId)
      .select("date startTime endTime")
      .lean();
    const svcDoc = await (await import("@/modules/vaccine-services/vaccine-services.schema"))
      .VaccineServiceModel.findById(booking.vaccineServiceId).select("name").lean();

    const dateTime = slot
      ? `${new Date(slot.date).toLocaleDateString("en-CA")} ${slot.startTime}–${slot.endTime}`
      : "—";
    const serviceName = svcDoc?.name ?? "Appointment";

    void EmailTriggerService.fire("appointments", oldStatus, status, {
      customer: { email: patient.email, fullName: patient.fullName },
      refId:    String(booking._id),
      extra:    { service: serviceName, dateTime },
    });

    createNotification({
      userId:   String(booking.patientId),
      type:     "appointment_update",
      title:    "Appointment Update",
      message:  `Your ${serviceName} appointment is now ${status.replace(/_/g, " ")}`,
      metadata: { bookingId: String(booking._id), status },
    }).catch((e) => logger.error("[Notification] appointment status", e));
  } catch (err) {
    logger.error("[Appointments] post-status side effects failed", err);
  }
}

export async function setBookingAdminReply(id: string, reply: string, actor: AuditActor) {
  const booking = await AppointmentBookingModel.findById(id);
  if (!booking) throw new AppError("Booking not found", 404);
  booking.adminReply = reply;
  const saved = await booking.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "appointment.reply.set", resource: "appointment_booking", resourceId: id,
    details: { reply }, ipAddress: actor.ip,
  });

  return saved;
}

export async function addBookingAdminNote(id: string, note: string, actor: AuditActor) {
  const booking = await AppointmentBookingModel.findById(id).select("+adminNotes");
  if (!booking) throw new AppError("Booking not found", 404);
  const old = booking.adminNotes ?? "";
  booking.adminNotes = old
    ? `${old}\n\n${new Date().toISOString()}: ${note}`
    : `${new Date().toISOString()}: ${note}`;
  const saved = await booking.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "appointment.note.added", resource: "appointment_booking", resourceId: id,
    details: { note }, ipAddress: actor.ip,
  });

  return saved;
}

import { AppointmentSlotModel } from "./appointment-slots.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function listAdminSlots(filters: {
  vaccineServiceId?: string; status?: string; date?: string;
  page?: number; limit?: number;
} = {}) {
  const { vaccineServiceId, status, date, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = {};
  if (vaccineServiceId) query.vaccineServiceId = vaccineServiceId;
  if (status)           query.status           = status;
  if (date) {
    const d = new Date(date);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    query.date = { $gte: d, $lt: next };
  }

  const [total, data] = await Promise.all([
    AppointmentSlotModel.countDocuments(query),
    AppointmentSlotModel.find(query)
      .populate("vaccineServiceId", "name durationMinutes")
      .sort({ date: 1, startTime: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function listAvailableSlots(vaccineServiceId?: string): Promise<Array<Record<string, unknown>>> {
  const query: Record<string, unknown> = {
    status: "active",
    date:   { $gte: new Date() },
  };
  if (vaccineServiceId) query.vaccineServiceId = vaccineServiceId;

  const slots = await AppointmentSlotModel.find(query)
    .populate("vaccineServiceId", "name durationMinutes eligibilityNotes")
    .sort({ date: 1, startTime: 1 })
    .lean();

  return slots.map((s) => ({
    ...(s as Record<string, unknown>),
    isFullyBooked: s.capacityType === "strict" && s.bookedCount >= s.capacity,
    spotsLeft:     s.capacityType === "strict" ? Math.max(0, s.capacity - s.bookedCount) : null,
  }));
}

export async function getSlot(id: string) {
  const slot = await AppointmentSlotModel.findById(id)
    .select("+adminNotes")
    .populate("vaccineServiceId", "name durationMinutes eligibilityNotes")
    .lean();
  if (!slot) throw new AppError("Slot not found", 404);
  return slot;
}

export async function createSlot(data: {
  vaccineServiceId: string;
  date:             Date;
  startTime:        string;
  endTime:          string;
  capacity:         number;
  capacityType:     "strict" | "open";
  adminNotes?:      string;
}, actor: AuditActor) {
  const slot = await AppointmentSlotModel.create(data);

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "slot.created", resource: "appointment_slot", resourceId: String(slot._id),
    details: { date: data.date, startTime: data.startTime, capacity: data.capacity },
    ipAddress: actor.ip,
  });

  return slot;
}

export async function updateSlot(id: string, data: Partial<{
  date: Date; startTime: string; endTime: string;
  capacity: number; capacityType: "strict" | "open"; adminNotes: string; status: "active" | "cancelled";
}>, actor: AuditActor) {
  const slot = await AppointmentSlotModel.findById(id);
  if (!slot) throw new AppError("Slot not found", 404);

  const before: Record<string, unknown> = {};
  if (data.date         !== undefined) { before.date         = slot.date;         slot.date         = data.date; }
  if (data.startTime    !== undefined) { before.startTime    = slot.startTime;    slot.startTime    = data.startTime; }
  if (data.endTime      !== undefined) { before.endTime      = slot.endTime;      slot.endTime      = data.endTime; }
  if (data.capacity     !== undefined) { before.capacity     = slot.capacity;     slot.capacity     = data.capacity; }
  if (data.capacityType !== undefined) { before.capacityType = slot.capacityType; slot.capacityType = data.capacityType; }
  if (data.adminNotes   !== undefined) { slot.adminNotes     = data.adminNotes; }
  if (data.status       !== undefined) { before.status       = slot.status;       slot.status       = data.status; }

  const saved = await slot.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "slot.updated", resource: "appointment_slot", resourceId: id,
    before, after: data, ipAddress: actor.ip,
  });

  return saved;
}

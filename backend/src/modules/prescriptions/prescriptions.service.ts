import { PrescriptionModel, type PrescriptionStatus } from "./prescriptions.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function createPrescription(data: {
  patientId:          string;
  prescriptionNumber: string;
  prescriberName:     string;
  prescriberLicense?: string;
  prescriberPhone?:   string;
  medicationName:     string;
  dosage?:            string;
  refillsRemaining?:  number;
  expiresAt?:         Date | null;
  notes?:             string;
}) {
  const prescription = await PrescriptionModel.create({
    ...data,
    status: "active",
    statusHistory: [{
      status:        "active",
      changedAt:     new Date(),
      changedBy:     null,
      changedByName: "",
      note:          "Prescription added by patient",
    }],
  });

  return prescription;
}

export async function listPatientPrescriptions(patientId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    PrescriptionModel.countDocuments({ patientId }),
    PrescriptionModel.find({ patientId })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getPatientPrescription(id: string, patientId: string) {
  const prescription = await PrescriptionModel.findOne({ _id: id, patientId }).lean();
  if (!prescription) throw new AppError("Prescription not found", 404);
  return prescription;
}

export async function listAdminPrescriptions(filters: {
  status?: string; search?: string; page?: number; limit?: number;
} = {}) {
  const { status, search, page = 1, limit = 25 } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { prescriptionNumber: { $regex: search, $options: "i" } },
      { medicationName:     { $regex: search, $options: "i" } },
    ];
  }

  const [total, data] = await Promise.all([
    PrescriptionModel.countDocuments(query),
    PrescriptionModel.find(query)
      .populate("patientId", "fullName email")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getAdminPrescription(id: string) {
  const prescription = await PrescriptionModel.findById(id)
    .select("+adminNotes")
    .populate("patientId", "fullName email phone")
    .lean();
  if (!prescription) throw new AppError("Prescription not found", 404);
  return prescription;
}

export async function updatePrescription(id: string, data: Partial<{
  prescriberName: string; prescriberLicense: string; prescriberPhone: string;
  medicationName: string; dosage: string;
  refillsRemaining: number; expiresAt: Date | null; notes: string;
}>, actor?: AuditActor) {
  const before = await PrescriptionModel.findById(id).lean();
  if (!before) throw new AppError("Prescription not found", 404);

  const prescription = await PrescriptionModel.findByIdAndUpdate(id, data, { new: true });
  if (!prescription) throw new AppError("Prescription not found", 404);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "prescription.update",
    resource:   "prescription",
    resourceId: id,
    before:     before as Record<string, unknown>,
    after:      prescription.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return prescription;
}

export async function updatePrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
  note: string,
  actor: AuditActor,
) {
  const prescription = await PrescriptionModel.findById(id);
  if (!prescription) throw new AppError("Prescription not found", 404);

  const oldStatus = prescription.status;
  prescription.status = status;
  prescription.statusHistory.push({
    status,
    changedAt:     new Date(),
    changedBy:     actor.id as unknown as import("mongoose").Types.ObjectId,
    changedByName: actor.name,
    note,
  });
  const saved = await prescription.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     `prescription.status.${status}`,
    resource:   "prescription",
    resourceId: id,
    before:     { status: oldStatus },
    after:      { status },
    details:    { note },
    ipAddress:  actor.ip,
  });

  return saved;
}

export async function addPrescriptionAdminNote(id: string, note: string, actor: AuditActor) {
  const prescription = await PrescriptionModel.findById(id).select("+adminNotes");
  if (!prescription) throw new AppError("Prescription not found", 404);
  const old = prescription.adminNotes ?? "";
  prescription.adminNotes = old
    ? `${old}\n\n${new Date().toISOString()}: ${note}`
    : `${new Date().toISOString()}: ${note}`;
  const saved = await prescription.save();

  await logAction({
    userId:    actor.id,
    userEmail: actor.email,
    actorName: actor.name,
    action:    "prescription.note.added",
    resource:  "prescription",
    resourceId: id,
    details:   { note },
    ipAddress: actor.ip,
  });

  return saved;
}

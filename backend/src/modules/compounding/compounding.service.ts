import { CompoundingModel, type CompoundingStatus } from "./compounding.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function createCompoundingRequest(data: {
  patientId:         string;
  medicationName:    string;
  strength?:         string;
  form:              string;
  quantity:          string;
  prescriberName:    string;
  prescriberLicense: string;
  notes?:            string;
  fileUrl?:          string;
}) {
  const request = await CompoundingModel.create({
    ...data,
    status: "submitted",
    statusHistory: [{
      status:        "submitted",
      changedAt:     new Date(),
      changedBy:     null,
      changedByName: "",
      note:          "Compounding request submitted by patient",
    }],
  });

  return request;
}

export async function listPatientCompoundingRequests(patientId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    CompoundingModel.countDocuments({ patientId }),
    CompoundingModel.find({ patientId })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getPatientCompoundingRequest(id: string, patientId: string) {
  const request = await CompoundingModel.findOne({ _id: id, patientId }).lean();
  if (!request) throw new AppError("Request not found", 404);
  return request;
}

export async function listAdminCompoundingRequests(filters: {
  status?: string; search?: string; page?: number; limit?: number;
} = {}) {
  const { status, search, page = 1, limit = 25 } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (search) query.medicationName = { $regex: search, $options: "i" };

  const [total, data] = await Promise.all([
    CompoundingModel.countDocuments(query),
    CompoundingModel.find(query)
      .populate("patientId", "fullName email")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getAdminCompoundingRequest(id: string) {
  const request = await CompoundingModel.findById(id)
    .select("+adminNotes")
    .populate("patientId", "fullName email phone")
    .lean();
  if (!request) throw new AppError("Request not found", 404);
  return request;
}

export async function updateCompoundingStatus(
  id: string,
  status: CompoundingStatus,
  note: string,
  actor: AuditActor,
  quoteAmount?: number | null,
  quoteNote?: string,
) {
  const request = await CompoundingModel.findById(id);
  if (!request) throw new AppError("Request not found", 404);

  const oldStatus = request.status;
  request.status = status;
  request.statusHistory.push({
    status,
    changedAt:     new Date(),
    changedBy:     actor.id as unknown as import("mongoose").Types.ObjectId,
    changedByName: actor.name,
    note,
  });

  if (status === "quote_sent") {
    if (quoteAmount !== undefined) request.quoteAmount = quoteAmount ?? null;
    if (quoteNote)                 request.quoteNote   = quoteNote;
  }

  const saved = await request.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     `compounding.status.${status}`,
    resource:   "compounding_request",
    resourceId: id,
    before:     { status: oldStatus },
    after:      { status, quoteAmount: request.quoteAmount },
    details:    { note },
    ipAddress:  actor.ip,
  });

  return saved;
}

export async function addCompoundingAdminNote(id: string, note: string, actor: AuditActor) {
  const request = await CompoundingModel.findById(id).select("+adminNotes");
  if (!request) throw new AppError("Request not found", 404);
  const old = request.adminNotes ?? "";
  request.adminNotes = old
    ? `${old}\n\n${new Date().toISOString()}: ${note}`
    : `${new Date().toISOString()}: ${note}`;
  const saved = await request.save();

  await logAction({
    userId:    actor.id,
    userEmail: actor.email,
    actorName: actor.name,
    action:    "compounding.note.added",
    resource:  "compounding_request",
    resourceId: id,
    details:   { note },
    ipAddress: actor.ip,
  });

  return saved;
}

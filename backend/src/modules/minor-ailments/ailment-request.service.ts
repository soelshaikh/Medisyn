import { AilmentRequestModel, type AilmentRequestStatus } from "./ailment-request.schema";
import { AilmentCatalogModel } from "./ailment-catalog.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function createAilmentRequest(data: {
  patientId: string;
  ailmentId: string;
  formData:  Record<string, unknown>;
  notes?:    string;
}) {
  const ailment = await AilmentCatalogModel.findOne({ _id: data.ailmentId, isActive: true }).lean();
  if (!ailment) throw new AppError("Ailment not found or inactive", 404);

  const request = await AilmentRequestModel.create({
    patientId:   data.patientId,
    ailmentId:   data.ailmentId,
    ailmentName: ailment.name,
    formData:    data.formData,
    notes:       data.notes ?? "",
    status:      "submitted",
    statusHistory: [{
      status:        "submitted",
      changedAt:     new Date(),
      changedBy:     null,
      changedByName: "",
      note:          "Request submitted by patient",
    }],
  });

  return request;
}

export async function listPatientAilmentRequests(patientId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    AilmentRequestModel.countDocuments({ patientId }),
    AilmentRequestModel.find({ patientId })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getPatientAilmentRequest(id: string, patientId: string) {
  const request = await AilmentRequestModel.findOne({ _id: id, patientId }).lean();
  if (!request) throw new AppError("Request not found", 404);
  return request;
}

export async function listAdminAilmentRequests(filters: {
  status?: string; search?: string; page?: number; limit?: number;
} = {}) {
  const { status, search, page = 1, limit = 25 } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (search) query.ailmentName = { $regex: search, $options: "i" };

  const [total, data] = await Promise.all([
    AilmentRequestModel.countDocuments(query),
    AilmentRequestModel.find(query)
      .populate("patientId", "fullName email")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getAdminAilmentRequest(id: string) {
  const request = await AilmentRequestModel.findById(id)
    .select("+adminNotes")
    .populate("patientId", "fullName email phone")
    .lean();
  if (!request) throw new AppError("Request not found", 404);
  return request;
}

export async function updateAilmentRequestStatus(
  id: string,
  status: AilmentRequestStatus,
  note: string,
  actor: AuditActor,
) {
  const request = await AilmentRequestModel.findById(id);
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
  const saved = await request.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     `ailment_request.status.${status}`,
    resource:   "ailment_request",
    resourceId: id,
    before:     { status: oldStatus },
    after:      { status },
    details:    { note },
    ipAddress:  actor.ip,
  });

  return saved;
}

export async function respondToAilmentRequest(
  id: string,
  responseText: string,
  actor: AuditActor,
) {
  const request = await AilmentRequestModel.findById(id);
  if (!request) throw new AppError("Request not found", 404);

  const oldStatus = request.status;
  request.responseText = responseText;
  request.respondedAt  = new Date();
  request.respondedBy  = actor.id as unknown as import("mongoose").Types.ObjectId;
  request.status       = "responded";
  request.statusHistory.push({
    status:        "responded",
    changedAt:     new Date(),
    changedBy:     actor.id as unknown as import("mongoose").Types.ObjectId,
    changedByName: actor.name,
    note:          "Pharmacist response sent",
  });
  const saved = await request.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     "ailment_request.responded",
    resource:   "ailment_request",
    resourceId: id,
    before:     { status: oldStatus, responseText: "" },
    after:      { status: "responded", responseText },
    ipAddress:  actor.ip,
  });

  return saved;
}

export async function addAilmentRequestAdminNote(id: string, note: string, actor: AuditActor) {
  const request = await AilmentRequestModel.findById(id).select("+adminNotes");
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
    action:    "ailment_request.note.added",
    resource:  "ailment_request",
    resourceId: id,
    details:   { note },
    ipAddress: actor.ip,
  });

  return saved;
}

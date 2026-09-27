import { AskPharmacistModel, type AskPharmacistStatus } from "./ask-pharmacist.schema";
import { UserModel } from "@/modules/users/users.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { EmailService } from "@/modules/email/email.service";
import { createNotification, notifyAdmins } from "@/modules/notifications/notifications.service";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";
import { logger } from "@/common/utils/logger";

export async function createAskPharmacistRequest(data: {
  patientId: string;
  subject:   string;
  question:  string;
  fileUrl?:  string;
}) {
  const request = await AskPharmacistModel.create({
    ...data,
    status: "open",
    statusHistory: [{
      status:        "open",
      changedAt:     new Date(),
      changedBy:     null,
      changedByName: "",
      note:          "Question submitted by patient",
    }],
  });

  /* Notify admins of new question */
  notifyAdmins({
    type:     "ask_pharmacist_update",
    title:    "New Pharmacist Question",
    message:  `A patient submitted a new question: "${data.subject}"`,
    metadata: { requestId: String(request._id) },
  });

  return request;
}

export async function listPatientAskRequests(patientId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    AskPharmacistModel.countDocuments({ patientId }),
    AskPharmacistModel.find({ patientId })
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getPatientAskRequest(id: string, patientId: string) {
  const request = await AskPharmacistModel.findOne({ _id: id, patientId }).lean();
  if (!request) throw new AppError("Request not found", 404);
  return request;
}

export async function listAdminAskRequests(filters: {
  status?: string; search?: string; page?: number; limit?: number;
} = {}) {
  const { status, search, page = 1, limit = 25 } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (search) query.subject = { $regex: search, $options: "i" };

  const [total, data] = await Promise.all([
    AskPharmacistModel.countDocuments(query),
    AskPharmacistModel.find(query)
      .populate("patientId", "fullName email")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getAdminAskRequest(id: string) {
  const request = await AskPharmacistModel.findById(id)
    .select("+adminNotes")
    .populate("patientId", "fullName email phone")
    .lean();
  if (!request) throw new AppError("Request not found", 404);
  return request;
}

export async function respondToAskPharmacist(
  id: string,
  responseText: string,
  actor: AuditActor,
) {
  const request = await AskPharmacistModel.findById(id);
  if (!request) throw new AppError("Request not found", 404);

  const oldStatus = request.status;
  request.responseText = responseText;
  request.respondedAt  = new Date();
  request.respondedBy  = actor.id as unknown as import("mongoose").Types.ObjectId;
  request.status       = "answered";
  request.statusHistory.push({
    status:        "answered",
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
    action:     "ask_pharmacist.responded",
    resource:   "ask_pharmacist",
    resourceId: id,
    before:     { status: oldStatus, responseText: "" },
    after:      { status: "answered", responseText },
    ipAddress:  actor.ip,
  });

  /* Fire-and-forget: email + patient notification */
  void _askPharmacistRespondedSideEffects(saved, responseText);

  return saved;
}

async function _askPharmacistRespondedSideEffects(
  req: Awaited<ReturnType<typeof AskPharmacistModel.prototype.save>>,
  responseText: string,
) {
  try {
    const patient = await UserModel.findById(req.patientId).select("email fullName").lean();
    if (!patient) return;

    EmailService.sendAskPharmacistRespondedEmail(
      { email: patient.email, fullName: patient.fullName },
      req.subject,
      responseText,
    ).catch((e) => logger.error("[Email] ask-pharmacist responded", e));

    createNotification({
      userId:   String(req.patientId),
      type:     "ask_pharmacist_update",
      title:    "Pharmacist Responded",
      message:  `Your pharmacist question "${req.subject}" has been answered.`,
      metadata: { requestId: String(req._id) },
    }).catch((e) => logger.error("[Notification] ask-pharmacist responded", e));
  } catch (err) {
    logger.error("[AskPharmacist] post-respond side effects failed", err);
  }
}

export async function updateAskPharmacistStatus(
  id: string,
  status: AskPharmacistStatus,
  note: string,
  actor: AuditActor,
) {
  const request = await AskPharmacistModel.findById(id);
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
    action:     `ask_pharmacist.status.${status}`,
    resource:   "ask_pharmacist",
    resourceId: id,
    before:     { status: oldStatus },
    after:      { status },
    details:    { note },
    ipAddress:  actor.ip,
  });

  return saved;
}

export async function addAskPharmacistAdminNote(id: string, note: string, actor: AuditActor) {
  const request = await AskPharmacistModel.findById(id).select("+adminNotes");
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
    action:    "ask_pharmacist.note.added",
    resource:  "ask_pharmacist",
    resourceId: id,
    details:   { note },
    ipAddress: actor.ip,
  });

  return saved;
}

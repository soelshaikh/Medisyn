import { AuditLogModel } from "./audit.schema";

export interface AuditActor {
  id:    string;
  email: string;
  name:  string;
  ip?:   string;
}

export interface LogActionInput {
  userId?:     string | null;
  userEmail?:  string;
  actorName?:  string;
  action:      string;
  resource:    string;
  resourceId?: string;
  details?:    Record<string, unknown>;
  before?:     Record<string, unknown> | null;
  after?:      Record<string, unknown> | null;
  ipAddress?:  string;
}

export async function logAction(input: LogActionInput) {
  try {
    await AuditLogModel.create({
      userId:     input.userId    ?? null,
      userEmail:  input.userEmail ?? "system",
      actorName:  input.actorName ?? "system",
      action:     input.action,
      resource:   input.resource,
      resourceId: input.resourceId ?? "",
      details:    input.details   ?? {},
      before:     input.before    ?? null,
      after:      input.after     ?? null,
      ipAddress:  input.ipAddress ?? "",
    });
  } catch {
    /* Audit log failure must never crash the main request */
  }
}

export async function queryAuditLog(filters: {
  userId?:    string;
  resource?:  string;
  action?:    string;
  dateFrom?:  Date;
  dateTo?:    Date;
  page?:      number;
  limit?:     number;
}) {
  const { userId, resource, action, dateFrom, dateTo, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = {};
  if (userId)   query.userId   = userId;
  if (resource) query.resource = resource;
  if (action)   query.action   = { $regex: action, $options: "i" };
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) (query.createdAt as Record<string, Date>).$gte = dateFrom;
    if (dateTo)   (query.createdAt as Record<string, Date>).$lte = dateTo;
  }

  const [total, data] = await Promise.all([
    AuditLogModel.countDocuments(query),
    AuditLogModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  return { data, total, page, limit };
}

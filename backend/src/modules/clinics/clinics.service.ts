import { UserModel } from "@/modules/users/users.schema";
import { ClinicProfileModel } from "./clinics.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction } from "@/modules/audit/audit.service";

export async function listClinics(filters: {
  status?: string; search?: string; page?: number; limit?: number;
} = {}): Promise<{ data: Record<string, unknown>[]; total: number; page: number; limit: number }> {
  const { status, search, page = 1, limit = 25 } = filters;
  const userQuery: Record<string, unknown> = { role: "clinic" };
  if (status) userQuery.status = status;
  if (search) {
    userQuery.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email:    { $regex: search, $options: "i" } },
    ];
  }

  const [total, users] = await Promise.all([
    UserModel.countDocuments(userQuery),
    UserModel.find(userQuery).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  const userIds = users.map((u) => u._id);
  const profiles = await ClinicProfileModel.find({ userId: { $in: userIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  const data = users.map((u) => ({
    ...u,
    _id:     String(u._id),
    profile: profileMap.get(String(u._id)) ?? null,
  }));

  return { data, total, page, limit };
}

export async function getClinic(id: string): Promise<Record<string, unknown>> {
  const user = await UserModel.findOne({ _id: id, role: "clinic" }).lean<Record<string, unknown>>();
  if (!user) throw new AppError("Clinic not found", 404);
  const profile = await ClinicProfileModel.findOne({ userId: id }).select("+adminNotes").lean();
  return { ...user, _id: String((user as { _id: unknown })._id), profile };
}

export async function updateClinicStatus(
  id: string,
  status: string,
  actorId: string,
  actorEmail: string,
  actorName: string,
  ip?: string,
) {
  const before = await UserModel.findOne({ _id: id, role: "clinic" }).lean();
  if (!before) throw new AppError("Clinic not found", 404);

  const user = await UserModel.findByIdAndUpdate(id, { status }, { new: true });

  await logAction({
    userId:     actorId,
    userEmail:  actorEmail,
    actorName,
    action:     `clinic.status.${status}`,
    resource:   "clinic",
    resourceId: id,
    before:     { status: before.status },
    after:      { status },
    ipAddress:  ip ?? "",
  });

  return user;
}

export async function addClinicAdminNote(id: string, note: string, actorId?: string, actorEmail?: string, actorName?: string, ip?: string) {
  const profile = await ClinicProfileModel.findOne({ userId: id });
  if (!profile) throw new AppError("Clinic profile not found", 404);

  const oldNotes = profile.adminNotes ?? "";
  profile.adminNotes = oldNotes
    ? `${oldNotes}\n\n${new Date().toISOString()}: ${note}`
    : `${new Date().toISOString()}: ${note}`;
  const saved = await profile.save();

  await logAction({
    userId:     actorId ?? null,
    userEmail:  actorEmail,
    actorName,
    action:     "clinic.note.added",
    resource:   "clinic",
    resourceId: id,
    details:    { note },
    ipAddress:  ip ?? "",
  });

  return saved;
}

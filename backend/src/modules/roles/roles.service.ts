import { AppError } from "@/common/middleware/error.middleware";
import { RoleModel } from "./roles.schema";
import { PermissionModel } from "@/modules/permissions/permissions.schema";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

export async function listRoles() {
  return RoleModel.find().sort({ name: 1 }).lean();
}

export async function getRoleById(id: string) {
  const role = await RoleModel.findById(id).lean();
  if (!role) throw new AppError("Role not found", 404);
  return role;
}

export async function createRole(data: { name: string; slug: string; description?: string }, actor?: AuditActor) {
  const exists = await RoleModel.findOne({ slug: data.slug });
  if (exists) throw new AppError("Role slug already exists", 409);

  const role = await RoleModel.create({ ...data, permissions: [], isSystem: false });

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "role.create",
    resource:   "role",
    resourceId: String(role._id),
    before:     null,
    after:      role.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return role;
}

export async function updateRole(id: string, data: { name?: string; description?: string }, actor?: AuditActor) {
  const role = await RoleModel.findById(id);
  if (!role) throw new AppError("Role not found", 404);

  const before = role.toObject() as unknown as Record<string, unknown>;
  Object.assign(role, data);
  const saved = await role.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "role.update",
    resource:   "role",
    resourceId: id,
    before,
    after:      saved.toObject() as unknown as Record<string, unknown>,
    ipAddress:  actor?.ip,
  });

  return saved;
}

export async function deleteRole(id: string, actor?: AuditActor) {
  const role = await RoleModel.findById(id);
  if (!role) throw new AppError("Role not found", 404);
  if (role.isSystem) throw new AppError("Cannot delete a system role", 403);

  const before = role.toObject() as unknown as Record<string, unknown>;
  await RoleModel.findByIdAndDelete(id);

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "role.delete",
    resource:   "role",
    resourceId: id,
    before,
    after:      null,
    ipAddress:  actor?.ip,
  });
}

export async function setRolePermissions(id: string, permissions: string[], actor?: AuditActor) {
  const role = await RoleModel.findById(id);
  if (!role) throw new AppError("Role not found", 404);

  const existing = await PermissionModel.find({ key: { $in: permissions } }).lean();
  const existingKeys = existing.map((p) => p.key);
  const invalid = permissions.filter((p) => !existingKeys.includes(p));
  if (invalid.length > 0) {
    throw new AppError(`Unknown permission keys: ${invalid.join(", ")}`, 400);
  }

  const oldPermissions = [...role.permissions];
  role.permissions = permissions;
  const saved = await role.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "role.permissions_updated",
    resource:   "role",
    resourceId: id,
    before:     { permissions: oldPermissions },
    after:      { permissions },
    ipAddress:  actor?.ip,
  });

  return saved;
}

import { AppError } from "@/common/middleware/error.middleware";
import { RoleModel } from "./roles.schema";
import { PermissionModel } from "@/modules/permissions/permissions.schema";

export async function listRoles() {
  return RoleModel.find().sort({ name: 1 }).lean();
}

export async function getRoleById(id: string) {
  const role = await RoleModel.findById(id).lean();
  if (!role) throw new AppError("Role not found", 404);
  return role;
}

export async function createRole(data: { name: string; slug: string; description?: string }) {
  const exists = await RoleModel.findOne({ slug: data.slug });
  if (exists) throw new AppError("Role slug already exists", 409);
  return RoleModel.create({ ...data, permissions: [], isSystem: false });
}

export async function updateRole(id: string, data: { name?: string; description?: string }) {
  const role = await RoleModel.findById(id);
  if (!role) throw new AppError("Role not found", 404);
  Object.assign(role, data);
  return role.save();
}

export async function deleteRole(id: string) {
  const role = await RoleModel.findById(id);
  if (!role) throw new AppError("Role not found", 404);
  if (role.isSystem) throw new AppError("Cannot delete a system role", 403);
  await RoleModel.findByIdAndDelete(id);
}

export async function setRolePermissions(id: string, permissions: string[]) {
  const role = await RoleModel.findById(id);
  if (!role) throw new AppError("Role not found", 404);

  /* Validate all permission keys exist */
  const existing = await PermissionModel.find({ key: { $in: permissions } }).lean();
  const existingKeys = existing.map((p) => p.key);
  const invalid = permissions.filter((p) => !existingKeys.includes(p));
  if (invalid.length > 0) {
    throw new AppError(`Unknown permission keys: ${invalid.join(", ")}`, 400);
  }

  role.permissions = permissions;
  return role.save();
}

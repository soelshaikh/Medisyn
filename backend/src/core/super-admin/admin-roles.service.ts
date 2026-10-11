import { eq, and, sql, inArray } from 'drizzle-orm';
import { superAdminDb } from '@/db';
import { facilityRoles, facilityRolePermissions, permissions } from '@/db/schema/rbac';
import { superAdminQuery } from './super-admin.service';
import { AppError } from '@/lib/errors';

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export async function adminListRoles(facilityId: string) {
  const rows = await superAdminDb
    .select({
      id:       facilityRoles.id,
      name:     facilityRoles.name,
      isSystem: facilityRoles.isSystemRole,
      permKeys: sql<string[] | null>`
        array_agg(${permissions.key}) filter (where ${permissions.key} is not null)
      `,
    })
    .from(facilityRoles)
    .leftJoin(facilityRolePermissions, eq(facilityRolePermissions.roleId, facilityRoles.id))
    .leftJoin(permissions, eq(permissions.id, facilityRolePermissions.permissionId))
    .where(eq(facilityRoles.facilityId, facilityId))
    .groupBy(facilityRoles.id)
    .orderBy(facilityRoles.name);

  return rows.map((r) => ({
    id:          r.id,
    name:        r.name,
    slug:        toSlug(r.name),
    description: '',
    permissions: r.permKeys ?? [],
    isSystem:    r.isSystem,
  }));
}

export async function adminGetRoleById(facilityId: string, roleId: string) {
  const [row] = await superAdminDb
    .select({
      id:       facilityRoles.id,
      name:     facilityRoles.name,
      isSystem: facilityRoles.isSystemRole,
      permKeys: sql<string[] | null>`
        array_agg(${permissions.key}) filter (where ${permissions.key} is not null)
      `,
    })
    .from(facilityRoles)
    .leftJoin(facilityRolePermissions, eq(facilityRolePermissions.roleId, facilityRoles.id))
    .leftJoin(permissions, eq(permissions.id, facilityRolePermissions.permissionId))
    .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.id, roleId)))
    .groupBy(facilityRoles.id)
    .limit(1);

  if (!row) return null;

  return {
    id:          row.id,
    name:        row.name,
    slug:        toSlug(row.name),
    description: '',
    permissions: row.permKeys ?? [],
    isSystem:    row.isSystem,
  };
}

export async function adminCreateRole(
  actorId: string,
  facilityId: string,
  name: string,
  ipAddress?: string,
  userAgent?: string,
) {
  return superAdminQuery(
    { facilityId, actorId, action: 'admin.role.created', resourceType: 'role', resourceId: name, metadata: { name }, ipAddress, userAgent },
    async (tx) => {
      const [role] = await tx
        .insert(facilityRoles)
        .values({ facilityId, name, isSystemRole: false })
        .returning();
      return {
        id:          role!.id,
        name:        role!.name,
        slug:        toSlug(role!.name),
        description: '',
        permissions: [] as string[],
        isSystem:    role!.isSystemRole,
      };
    },
  );
}

export async function adminUpdateRole(
  actorId: string,
  facilityId: string,
  roleId: string,
  name: string,
  ipAddress?: string,
  userAgent?: string,
) {
  return superAdminQuery(
    { facilityId, actorId, action: 'admin.role.updated', resourceType: 'role', resourceId: roleId, metadata: { name }, ipAddress, userAgent },
    async (tx) => {
      const [row] = await tx
        .select({ isSystem: facilityRoles.isSystemRole })
        .from(facilityRoles)
        .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.id, roleId)))
        .limit(1);

      if (!row) throw new AppError('NOT_FOUND', 'Role not found', 404);
      if (row.isSystem) throw new AppError('FORBIDDEN', 'System roles cannot be renamed', 403);

      const [updated] = await tx
        .update(facilityRoles)
        .set({ name, updatedAt: new Date() })
        .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.id, roleId)))
        .returning();

      return {
        id:          updated!.id,
        name:        updated!.name,
        slug:        toSlug(updated!.name),
        description: '',
        permissions: [] as string[],
        isSystem:    updated!.isSystemRole,
      };
    },
  );
}

export async function adminDeleteRole(
  actorId: string,
  facilityId: string,
  roleId: string,
  ipAddress?: string,
  userAgent?: string,
) {
  return superAdminQuery(
    { facilityId, actorId, action: 'admin.role.deleted', resourceType: 'role', resourceId: roleId, metadata: {}, ipAddress, userAgent },
    async (tx) => {
      const [row] = await tx
        .select({ isSystem: facilityRoles.isSystemRole })
        .from(facilityRoles)
        .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.id, roleId)))
        .limit(1);

      if (!row) throw new AppError('NOT_FOUND', 'Role not found', 404);
      if (row.isSystem) throw new AppError('FORBIDDEN', 'System roles cannot be deleted', 403);

      await tx
        .delete(facilityRoles)
        .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.id, roleId)));
    },
  );
}

export async function adminSetRolePermissions(
  actorId: string,
  facilityId: string,
  roleId: string,
  permissionKeys: string[],
  ipAddress?: string,
  userAgent?: string,
) {
  return superAdminQuery(
    { facilityId, actorId, action: 'admin.role.permissions_updated', resourceType: 'role', resourceId: roleId, metadata: { permissionKeys }, ipAddress, userAgent },
    async (tx) => {
      // Verify role belongs to facility
      const [role] = await tx
        .select({ id: facilityRoles.id })
        .from(facilityRoles)
        .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.id, roleId)))
        .limit(1);

      if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);

      // Resolve keys to permission IDs
      let permissionIds: string[] = [];
      if (permissionKeys.length > 0) {
        const resolved = await tx
          .select({ id: permissions.id })
          .from(permissions)
          .where(inArray(permissions.key, permissionKeys));
        permissionIds = resolved.map((r) => r.id);
      }

      // Replace all permissions for this role
      await tx
        .delete(facilityRolePermissions)
        .where(eq(facilityRolePermissions.roleId, roleId));

      if (permissionIds.length > 0) {
        await tx.insert(facilityRolePermissions).values(
          permissionIds.map((permissionId) => ({ facilityId, roleId, permissionId })),
        );
      }
    },
  );
}

export async function adminListPermissions() {
  const rows = await superAdminDb
    .select({
      key:         permissions.key,
      description: permissions.description,
    })
    .from(permissions)
    .orderBy(permissions.key);

  return rows.map((r) => ({
    key:         r.key,
    group:       r.key.split(':')[0] ?? r.key,
    description: r.description ?? '',
  }));
}

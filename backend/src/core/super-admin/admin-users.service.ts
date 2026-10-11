import { eq, and, ilike, or, sql, desc } from 'drizzle-orm';
import { superAdminDb } from '@/db';
import { users } from '@/db/schema/core';
import { facilityUsers, facilityRoles } from '@/db/schema/rbac';
import { patientProfiles } from '@/db/schema/patient';
import { superAdminQuery } from './super-admin.service';
import { AppError } from '@/lib/errors';

function deriveStatus(emailVerified: boolean, isActive: boolean): string {
  if (!isActive) return 'suspended';
  if (!emailVerified) return 'pending_verification';
  return 'active';
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

type UserListParams = {
  page?: number | string;
  limit?: number | string;
  status?: string;
  search?: string;
  hasRoles?: string;
};

function buildWhere(facilityId: string, p: UserListParams) {
  const conds = [eq(facilityUsers.facilityId, facilityId)];

  if (p.hasRoles === 'false') {
    conds.push(eq(facilityRoles.name, 'patient'));
  } else if (p.hasRoles === 'true') {
    conds.push(sql`${facilityRoles.name} != 'patient'`);
  }

  if (p.status === 'suspended') {
    conds.push(eq(facilityUsers.isActive, false));
  } else if (p.status === 'pending_verification') {
    conds.push(eq(users.emailVerified, false));
  } else if (p.status === 'active') {
    conds.push(eq(facilityUsers.isActive, true));
    conds.push(eq(users.emailVerified, true));
  }

  if (p.search) {
    const q = `%${p.search}%`;
    conds.push(
      or(ilike(users.email, q), ilike(users.firstName, q), ilike(users.lastName, q))!,
    );
  }

  return and(...conds);
}

export async function adminListUsers(facilityId: string, params: UserListParams) {
  const page  = Math.max(1, Number(params.page)  || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const offset = (page - 1) * limit;

  const where = buildWhere(facilityId, params);

  const [rows, [countRow]] = await Promise.all([
    superAdminDb
      .select({
        id:            users.id,
        email:         users.email,
        firstName:     users.firstName,
        lastName:      users.lastName,
        emailVerified: users.emailVerified,
        createdAt:     users.createdAt,
        isActive:      facilityUsers.isActive,
        roleId:        facilityRoles.id,
        roleName:      facilityRoles.name,
        roleIsSystem:  facilityRoles.isSystemRole,
        phone:         patientProfiles.phone,
      })
      .from(facilityUsers)
      .innerJoin(users, eq(facilityUsers.userId, users.id))
      .leftJoin(facilityRoles, eq(facilityUsers.roleId, facilityRoles.id))
      .leftJoin(
        patientProfiles,
        and(eq(patientProfiles.userId, users.id), eq(patientProfiles.facilityId, facilityId)),
      )
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),

    superAdminDb
      .select({ total: sql<number>`count(*)::int` })
      .from(facilityUsers)
      .innerJoin(users, eq(facilityUsers.userId, users.id))
      .leftJoin(facilityRoles, eq(facilityUsers.roleId, facilityRoles.id))
      .where(where),
  ]);

  const total = Number(countRow?.total ?? 0);

  return {
    data: rows.map((r) => ({
      id:            r.id,
      email:         r.email,
      fullName:      `${r.firstName} ${r.lastName}`,
      phone:         r.phone ?? null,
      role:          r.roleName ?? '',
      roles:         r.roleName
        ? [{
            id:          r.roleId ?? '',
            name:        r.roleName,
            slug:        toSlug(r.roleName),
            description: '',
            permissions: [] as string[],
            isSystem:    r.roleIsSystem ?? false,
          }]
        : [],
      status:        deriveStatus(r.emailVerified, r.isActive),
      emailVerified: r.emailVerified,
      createdAt:     r.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function adminSearchUsers(facilityId: string, q: string) {
  const pattern = `%${q}%`;
  const rows = await superAdminDb
    .select({
      id:        users.id,
      firstName: users.firstName,
      lastName:  users.lastName,
      email:     users.email,
      phone:     patientProfiles.phone,
    })
    .from(facilityUsers)
    .innerJoin(users, eq(facilityUsers.userId, users.id))
    .leftJoin(
      patientProfiles,
      and(eq(patientProfiles.userId, users.id), eq(patientProfiles.facilityId, facilityId)),
    )
    .where(
      and(
        eq(facilityUsers.facilityId, facilityId),
        or(ilike(users.email, pattern), ilike(users.firstName, pattern), ilike(users.lastName, pattern))!,
      ),
    )
    .limit(20);

  return rows.map((r) => ({
    id:       r.id,
    uhid:     null as string | null,
    fullName: `${r.firstName} ${r.lastName}`,
    email:    r.email,
    phone:    r.phone ?? null,
  }));
}

export async function adminGetUserById(facilityId: string, userId: string) {
  const [row] = await superAdminDb
    .select({
      id:            users.id,
      email:         users.email,
      firstName:     users.firstName,
      lastName:      users.lastName,
      emailVerified: users.emailVerified,
      createdAt:     users.createdAt,
      isActive:      facilityUsers.isActive,
      roleId:        facilityRoles.id,
      roleName:      facilityRoles.name,
      roleIsSystem:  facilityRoles.isSystemRole,
      phone:         patientProfiles.phone,
    })
    .from(facilityUsers)
    .innerJoin(users, eq(facilityUsers.userId, users.id))
    .leftJoin(facilityRoles, eq(facilityUsers.roleId, facilityRoles.id))
    .leftJoin(
      patientProfiles,
      and(eq(patientProfiles.userId, users.id), eq(patientProfiles.facilityId, facilityId)),
    )
    .where(and(eq(facilityUsers.facilityId, facilityId), eq(facilityUsers.userId, userId)))
    .limit(1);

  if (!row) return null;

  return {
    id:            row.id,
    email:         row.email,
    fullName:      `${row.firstName} ${row.lastName}`,
    phone:         row.phone ?? null,
    role:          row.roleName ?? '',
    roles:         row.roleName
      ? [{
          id:          row.roleId ?? '',
          name:        row.roleName,
          slug:        toSlug(row.roleName),
          description: '',
          permissions: [] as string[],
          isSystem:    row.roleIsSystem ?? false,
        }]
      : [],
    status:        deriveStatus(row.emailVerified, row.isActive),
    emailVerified: row.emailVerified,
    createdAt:     row.createdAt.toISOString(),
  };
}

export async function adminSetUserStatus(
  actorId: string,
  facilityId: string,
  userId: string,
  status: string,
  ipAddress?: string,
  userAgent?: string,
) {
  if (status !== 'active' && status !== 'suspended') {
    throw new AppError('VALIDATION_ERROR', 'status must be "active" or "suspended"', 422);
  }

  const isActive = status === 'active';

  return superAdminQuery(
    { facilityId, actorId, action: 'admin.user.status_updated', resourceType: 'user', resourceId: userId, metadata: { status }, ipAddress, userAgent },
    async (tx) => {
      const [updated] = await tx
        .update(facilityUsers)
        .set({ isActive, updatedAt: new Date() })
        .where(and(eq(facilityUsers.facilityId, facilityId), eq(facilityUsers.userId, userId)))
        .returning({ id: facilityUsers.id });

      if (!updated) {
        throw new AppError('NOT_FOUND', 'User not found in this facility', 404);
      }
    },
  );
}

export async function adminSetUserRoles(
  actorId: string,
  facilityId: string,
  userId: string,
  roleIds: string[],
  ipAddress?: string,
  userAgent?: string,
) {
  const roleId = roleIds[0];
  if (!roleId) {
    throw new AppError('VALIDATION_ERROR', 'At least one roleId is required', 422);
  }

  return superAdminQuery(
    { facilityId, actorId, action: 'admin.user.role_updated', resourceType: 'user', resourceId: userId, metadata: { roleIds }, ipAddress, userAgent },
    async (tx) => {
      const [updated] = await tx
        .update(facilityUsers)
        .set({ roleId, updatedAt: new Date() })
        .where(and(eq(facilityUsers.facilityId, facilityId), eq(facilityUsers.userId, userId)))
        .returning({ id: facilityUsers.id });

      if (!updated) {
        throw new AppError('NOT_FOUND', 'User not found in this facility', 404);
      }
    },
  );
}

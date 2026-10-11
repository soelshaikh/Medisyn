import { sql, eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { superAdminDb, identityDb } from '@/db';
import { identityUsers } from '@/db/schema/identity';
import {
  getIdentityUserByEmail,
  createIdentityUser,
  resolveUniqueUsername,
} from '@/core/auth/identity-queries.service';

// ── Types ─────────────────────────────────────────────────────────────────

export interface AdminFacility {
  id: string;
  name: string;
  slug: string;
  status: string;
  planId: string;
  planName: string;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFacilityDetail extends AdminFacility {
  settings: Record<string, unknown>;
  planKey: string;
  prefix: string | null;
}

export interface AdminPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface AdminPlanModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
}

export interface AdminPlanDetail extends AdminPlan {
  modules: AdminPlanModule[];
  facilityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface PlatformStats {
  totalFacilities: number;
  activeFacilities: number;
  totalPatients: number;
  totalOrders: number;
  totalRevenueCad: string;
  totalSuperAdmins: number;
}

export interface AdminSuperAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

// ── DEFAULT_SYSTEM_ROLES ──────────────────────────────────────────────────

const DEFAULT_SYSTEM_ROLES = ['patient', 'pharmacist', 'staff', 'admin'] as const;

// ── Facilities ─────────────────────────────────────────────────────────────

export async function adminListFacilities(
  page: number,
  limit: number,
  search?: string,
): Promise<{ rows: AdminFacility[]; total: number }> {
  const offset = (page - 1) * limit;
  const searchPat = search ? `%${search.toLowerCase()}%` : null;

  const [rows, totals] = await Promise.all([
    superAdminDb.execute<{
      id: string; name: string; slug: string; status: string;
      plan_id: string; plan_name: string; user_count: number;
      created_at: string; updated_at: string;
    }>(sql`
      SELECT
        f.id,
        f.name,
        f.slug,
        f.status,
        f.subscription_plan_id  AS plan_id,
        sp.name                 AS plan_name,
        COUNT(DISTINCT hp.id)::int AS user_count,
        f.created_at,
        f.updated_at
      FROM facilities f
      JOIN subscription_plans sp ON sp.id = f.subscription_plan_id
      LEFT JOIN health_professionals hp ON hp.facility_id = f.id AND hp.is_active = true
      ${searchPat ? sql`WHERE LOWER(f.name) LIKE ${searchPat} OR LOWER(f.slug) LIKE ${searchPat}` : sql``}
      GROUP BY f.id, sp.name
      ORDER BY f.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    superAdminDb.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM facilities
      ${searchPat ? sql`WHERE LOWER(name) LIKE ${searchPat} OR LOWER(slug) LIKE ${searchPat}` : sql``}
    `),
  ]);

  const total = (Array.from(totals) as Array<{ cnt: number }>)[0]?.cnt ?? 0;

  return {
    rows: (Array.from(rows) as typeof rows[0][]).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      planId: r.plan_id,
      planName: r.plan_name,
      userCount: r.user_count,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })),
    total,
  };
}

export async function adminGetFacilityById(id: string): Promise<AdminFacilityDetail | null> {
  const rows = await superAdminDb.execute<{
    id: string; name: string; slug: string; prefix: string | null; status: string;
    plan_id: string; plan_name: string; plan_key: string;
    user_count: number; settings: unknown;
    created_at: string; updated_at: string;
  }>(sql`
    SELECT
      f.id, f.name, f.slug, f.prefix, f.status, f.settings,
      f.subscription_plan_id AS plan_id,
      sp.name                AS plan_name,
      sp.key                 AS plan_key,
      COUNT(DISTINCT hp.id)::int AS user_count,
      f.created_at, f.updated_at
    FROM facilities f
    JOIN subscription_plans sp ON sp.id = f.subscription_plan_id
    LEFT JOIN health_professionals hp ON hp.facility_id = f.id AND hp.is_active = true
    WHERE f.id = ${id}
    GROUP BY f.id, sp.name, sp.key
  `);

  const r = (Array.from(rows) as typeof rows[0][])[0];
  if (!r) return null;

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    prefix: r.prefix ?? null,
    status: r.status,
    planId: r.plan_id,
    planName: r.plan_name,
    planKey: r.plan_key,
    userCount: r.user_count,
    settings: (r.settings as Record<string, unknown>) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function adminCreateFacility(data: {
  name: string;
  slug: string;
  prefix: string;
  planId: string;
}): Promise<{ id: string }> {
  return superAdminDb.transaction(async (tx) => {
    // Check slug uniqueness
    const existingSlug = await tx.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM facilities WHERE slug = ${data.slug}
    `);
    if ((Array.from(existingSlug) as Array<{ cnt: number }>)[0]?.cnt ?? 0 > 0) {
      throw new Error(`Slug '${data.slug}' is already taken`);
    }

    // Check prefix uniqueness (globally unique across all facilities)
    const existingPrefix = await tx.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM facilities WHERE prefix = ${data.prefix}
    `);
    if ((Array.from(existingPrefix) as Array<{ cnt: number }>)[0]?.cnt ?? 0 > 0) {
      throw new Error(`Prefix '${data.prefix}' is already taken`);
    }

    // Verify plan exists
    const plan = await tx.execute<{ id: string }>(sql`
      SELECT id FROM subscription_plans WHERE id = ${data.planId} AND is_active = true
    `);
    if ((Array.from(plan) as Array<{ id: string }>).length === 0) {
      throw new Error('Subscription plan not found or inactive');
    }

    // Create facility with prefix
    const facilityRows = await tx.execute<{ id: string }>(sql`
      INSERT INTO facilities (name, slug, prefix, status, subscription_plan_id, settings)
      VALUES (${data.name}, ${data.slug}, ${data.prefix}, 'active', ${data.planId}, '{}')
      RETURNING id
    `);
    const facilityId = (Array.from(facilityRows) as Array<{ id: string }>)[0]?.id;
    if (!facilityId) throw new Error('Failed to create facility');

    // Keep legacy facility_roles for migration compatibility
    for (const roleName of DEFAULT_SYSTEM_ROLES) {
      await tx.execute(sql`
        INSERT INTO facility_roles (facility_id, name, is_system_role)
        VALUES (${facilityId}, ${roleName}, true)
        ON CONFLICT DO NOTHING
      `);
    }

    return { id: facilityId };
  });
}

export async function adminUpdateFacility(
  id: string,
  data: { name?: string; status?: string; planId?: string },
): Promise<void> {
  if (data.name !== undefined) {
    await superAdminDb.execute(sql`
      UPDATE facilities SET name = ${data.name}, updated_at = NOW() WHERE id = ${id}
    `);
  }
  if (data.status !== undefined) {
    await superAdminDb.execute(sql`
      UPDATE facilities SET status = ${data.status}, updated_at = NOW() WHERE id = ${id}
    `);
  }
  if (data.planId !== undefined) {
    await superAdminDb.execute(sql`
      UPDATE facilities SET subscription_plan_id = ${data.planId}, updated_at = NOW() WHERE id = ${id}
    `);
  }
}

// ── Plans ─────────────────────────────────────────────────────────────────

export async function adminListPlans(): Promise<AdminPlan[]> {
  const rows = await superAdminDb.execute<{
    id: string; key: string; name: string; description: string | null; is_active: boolean;
  }>(sql`
    SELECT id, key, name, description, is_active
    FROM subscription_plans
    ORDER BY name
  `);

  return (Array.from(rows) as typeof rows[0][]).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isActive: r.is_active,
  }));
}

// ── Platform Stats ─────────────────────────────────────────────────────────

export async function adminGetPlatformStats(): Promise<PlatformStats> {
  const [facilityRows, patientRows, orderRows, superAdminRows] = await Promise.all([
    superAdminDb.execute<{ total: number; active: number }>(sql`
      SELECT
        COUNT(*)::int                                           AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int         AS active
      FROM facilities
    `),
    superAdminDb.execute<{ cnt: number }>(sql`
      SELECT COUNT(DISTINCT fu.user_id)::int AS cnt
      FROM facility_users fu
      JOIN facility_roles fr ON fr.id = fu.role_id
      WHERE fr.name = 'patient'
    `),
    superAdminDb.execute<{ cnt: number; revenue: string }>(sql`
      SELECT
        COUNT(*)::int                           AS cnt,
        COALESCE(SUM(total), 0)::text           AS revenue
      FROM orders
      WHERE status IN ('shipped', 'delivered')
    `),
    superAdminDb.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM users WHERE is_platform_super_admin = true
    `),
  ]);

  type FacRow   = { total: number; active: number };
  type CntRow   = { cnt: number };
  type OrdRow   = { cnt: number; revenue: string };

  const fac  = (Array.from(facilityRows) as FacRow[])[0];
  const pat  = (Array.from(patientRows)  as CntRow[])[0];
  const ord  = (Array.from(orderRows)    as OrdRow[])[0];
  const sa   = (Array.from(superAdminRows) as CntRow[])[0];

  return {
    totalFacilities:  fac?.total  ?? 0,
    activeFacilities: fac?.active ?? 0,
    totalPatients:    pat?.cnt    ?? 0,
    totalOrders:      ord?.cnt    ?? 0,
    totalRevenueCad:  Number(ord?.revenue ?? 0).toFixed(2),
    totalSuperAdmins: sa?.cnt     ?? 0,
  };
}

// ── Super Admins ──────────────────────────────────────────────────────────

export async function adminListSuperAdmins(): Promise<AdminSuperAdmin[]> {
  const rows = await identityDb
    .select({
      id:          identityUsers.id,
      email:       identityUsers.email,
      firstName:   identityUsers.firstName,
      lastName:    identityUsers.lastName,
      createdAt:   identityUsers.createdAt,
      lastLoginAt: identityUsers.lastLoginAt,
    })
    .from(identityUsers)
    .where(eq(identityUsers.accountType, 'super_admin'))
    .orderBy(identityUsers.createdAt);

  return rows.map((r) => ({
    id:          r.id,
    email:       r.email,
    firstName:   r.firstName,
    lastName:    r.lastName,
    createdAt:   r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
  }));
}

export async function adminCreateSuperAdmin(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ id: string }> {
  const existing = await getIdentityUserByEmail(data.email);
  if (existing) throw new Error(`Email '${data.email}' is already registered`);

  const emailLocal = data.email.split('@')[0] ?? data.email;
  const { username, normalizedUsername } = await resolveUniqueUsername(emailLocal, null);

  const passwordHash = await argon2.hash(data.password);

  const user = await createIdentityUser({
    email:              data.email,
    username,
    normalizedUsername,
    passwordHash,
    firstName:          data.firstName,
    lastName:           data.lastName,
    accountType:        'super_admin',
    facilityPrefix:     null,
  });

  return { id: user.id };
}

// ── Plan detail, create, update ───────────────────────────────────────────

export async function adminGetPlanById(id: string): Promise<AdminPlanDetail | null> {
  const [planRows, moduleRows, facilityRows] = await Promise.all([
    superAdminDb.execute<{
      id: string; key: string; name: string; description: string | null;
      is_active: boolean; created_at: string; updated_at: string;
    }>(sql`
      SELECT id, key, name, description, is_active, created_at, updated_at
      FROM subscription_plans
      WHERE id = ${id}
    `),
    superAdminDb.execute<{
      id: string; key: string; name: string; description: string | null;
    }>(sql`
      SELECT pm_mod.id, pm_mod.key, pm_mod.name, pm_mod.description
      FROM plan_modules pm
      JOIN platform_modules pm_mod ON pm_mod.id = pm.module_id
      WHERE pm.plan_id = ${id}
      ORDER BY pm_mod.name
    `),
    superAdminDb.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt
      FROM facilities
      WHERE subscription_plan_id = ${id}
    `),
  ]);

  const plan = (Array.from(planRows) as typeof planRows[0][])[0];
  if (!plan) return null;

  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    isActive: plan.is_active,
    modules: (Array.from(moduleRows) as typeof moduleRows[0][]).map((m) => ({
      id: m.id,
      key: m.key,
      name: m.name,
      description: m.description,
    })),
    facilityCount: (Array.from(facilityRows) as Array<{ cnt: number }>)[0]?.cnt ?? 0,
    createdAt: String(plan.created_at),
    updatedAt: String(plan.updated_at),
  };
}

export async function adminCreatePlan(data: {
  key: string;
  name: string;
  description?: string;
  moduleIds?: string[];
}): Promise<{ id: string }> {
  const existing = await superAdminDb.execute<{ cnt: number }>(sql`
    SELECT COUNT(*)::int AS cnt FROM subscription_plans WHERE key = ${data.key}
  `);
  if ((Array.from(existing) as Array<{ cnt: number }>)[0]?.cnt ?? 0 > 0) {
    throw new Error(`Plan key '${data.key}' is already taken`);
  }

  const rows = await superAdminDb.execute<{ id: string }>(sql`
    INSERT INTO subscription_plans (key, name, description)
    VALUES (${data.key}, ${data.name}, ${data.description ?? null})
    RETURNING id
  `);

  const id = (Array.from(rows) as Array<{ id: string }>)[0]?.id;
  if (!id) throw new Error('Failed to create plan');

  if (data.moduleIds && data.moduleIds.length > 0) {
    for (const moduleId of data.moduleIds) {
      await superAdminDb.execute(sql`
        INSERT INTO plan_modules (plan_id, module_id)
        VALUES (${id}, ${moduleId})
        ON CONFLICT DO NOTHING
      `);
    }
  }

  return { id };
}

export async function adminUpdatePlan(
  id: string,
  data: { name?: string; description?: string | null; isActive?: boolean },
): Promise<void> {
  if (data.name !== undefined) {
    await superAdminDb.execute(sql`
      UPDATE subscription_plans SET name = ${data.name}, updated_at = NOW() WHERE id = ${id}
    `);
  }
  if (data.description !== undefined) {
    await superAdminDb.execute(sql`
      UPDATE subscription_plans SET description = ${data.description}, updated_at = NOW() WHERE id = ${id}
    `);
  }
  if (data.isActive !== undefined) {
    await superAdminDb.execute(sql`
      UPDATE subscription_plans SET is_active = ${data.isActive}, updated_at = NOW() WHERE id = ${id}
    `);
  }
}

export async function adminListPlatformModules(): Promise<AdminModule[]> {
  const rows = await superAdminDb.execute<{
    id: string; key: string; name: string; description: string | null; is_active: boolean;
  }>(sql`
    SELECT id, key, name, description, is_active
    FROM platform_modules
    ORDER BY name
  `);

  return (Array.from(rows) as typeof rows[0][]).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isActive: r.is_active,
  }));
}

// ── Facility staff / seat config ──────────────────────────────────────────

export interface FacilitySeatResource {
  resourceKey: string;
  roleName: string;
  planLimit: number;
  overrideLimit: number | null;
  effectiveLimit: number;
  currentUsage: number;
}

export interface FacilityStaffMember {
  healthProfessionalId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  joinedAt: string;
}

// Maps resource key → facilityRoleEnum value used in health_professionals + user_roles
const SEAT_ROLE_MAP: Record<string, string> = {
  admin_seats:      'facility_admin',
  staff_seats:      'staff',
  pharmacist_seats: 'pharmacist',
};

export async function adminGetFacilitySeatConfig(facilityId: string): Promise<FacilitySeatResource[]> {
  const [facilityRows, planEntRows, overrideRows, usageRows] = await Promise.all([
    superAdminDb.execute<{ plan_id: string }>(sql`
      SELECT subscription_plan_id AS plan_id FROM facilities WHERE id = ${facilityId}
    `),
    superAdminDb.execute<{ resource_key: string; limit_value: number }>(sql`
      SELECT pe.resource_key, pe.limit_value
      FROM plan_entitlements pe
      JOIN facilities f ON f.subscription_plan_id = pe.plan_id
      WHERE f.id = ${facilityId}
        AND pe.resource_key IN ('admin_seats', 'staff_seats', 'pharmacist_seats')
    `),
    superAdminDb.execute<{ resource_key: string; limit_value: number }>(sql`
      SELECT resource_key, limit_value
      FROM facility_entitlement_overrides
      WHERE facility_id = ${facilityId}
        AND resource_key IN ('admin_seats', 'staff_seats', 'pharmacist_seats')
    `),
    superAdminDb.execute<{ role_name: string; cnt: number }>(sql`
      SELECT ur.role AS role_name, COUNT(DISTINCT hp.id)::int AS cnt
      FROM health_professionals hp
      JOIN user_roles ur ON ur.health_professional_id = hp.id
      WHERE hp.facility_id = ${facilityId}
        AND hp.is_active = true
        AND ur.is_active = true
        AND ur.role IN ('facility_admin', 'staff', 'pharmacist')
      GROUP BY ur.role
    `),
  ]);

  if ((Array.from(facilityRows) as Array<{ plan_id: string }>).length === 0) {
    throw new Error('Facility not found');
  }

  type PERow  = { resource_key: string; limit_value: number };
  type OvRow  = { resource_key: string; limit_value: number };
  type UsgRow = { role_name: string; cnt: number };

  const planLimitMap     = Object.fromEntries((Array.from(planEntRows)  as PERow[]).map((r) => [r.resource_key, r.limit_value]));
  const overrideLimitMap = Object.fromEntries((Array.from(overrideRows) as OvRow[]).map((r) => [r.resource_key, r.limit_value]));
  const usageMap         = Object.fromEntries((Array.from(usageRows)    as UsgRow[]).map((r) => [r.role_name, r.cnt]));

  return Object.entries(SEAT_ROLE_MAP).map(([resourceKey, roleName]) => {
    const planLimit     = planLimitMap[resourceKey]     ?? -1;
    const overrideLimit = overrideLimitMap[resourceKey] !== undefined ? overrideLimitMap[resourceKey] : null;
    const effectiveLimit = overrideLimit !== null ? overrideLimit : planLimit;
    const currentUsage  = usageMap[roleName] ?? 0;
    return { resourceKey, roleName, planLimit, overrideLimit, effectiveLimit, currentUsage };
  });
}

export async function adminSetFacilitySeatOverride(
  facilityId: string,
  resourceKey: string,
  limitValue: number,
  createdBy: string,
): Promise<void> {
  await superAdminDb.execute(sql`
    INSERT INTO facility_entitlement_overrides (facility_id, resource_key, limit_value, created_by)
    VALUES (${facilityId}, ${resourceKey}, ${limitValue}, ${createdBy})
    ON CONFLICT (facility_id, resource_key)
    DO UPDATE SET limit_value = ${limitValue}, updated_at = NOW()
  `);
}

export async function adminListFacilityStaff(facilityId: string): Promise<FacilityStaffMember[]> {
  // Step 1: get health_professionals + all their roles from vtech-core
  type HpRow = { hp_id: string; user_id: string; is_active: boolean; joined_at: string; role: string };
  const hpRows = await superAdminDb.execute<HpRow>(sql`
    SELECT
      hp.id        AS hp_id,
      hp.user_id,
      hp.is_active,
      hp.joined_at,
      ur.role
    FROM health_professionals hp
    JOIN user_roles ur ON ur.health_professional_id = hp.id AND ur.is_active = true
    WHERE hp.facility_id = ${facilityId}
    ORDER BY hp.joined_at, ur.role
  `);

  const allRows = Array.from(hpRows) as HpRow[];
  if (allRows.length === 0) return [];

  // Group roles by health_professional_id
  const hpMap = new Map<string, { userId: string; isActive: boolean; joinedAt: string; roles: string[] }>();
  for (const r of allRows) {
    const existing = hpMap.get(r.hp_id);
    if (existing) {
      existing.roles.push(r.role);
    } else {
      hpMap.set(r.hp_id, {
        userId:   r.user_id,
        isActive: r.is_active,
        joinedAt: String(r.joined_at),
        roles:    [r.role],
      });
    }
  }

  // Step 2: batch-fetch user details from identityDb
  const userIds = Array.from(new Set(allRows.map((r) => r.user_id)));
  const identityUsersRows = await identityDb
    .select({
      id:        identityUsers.id,
      email:     identityUsers.email,
      firstName: identityUsers.firstName,
      lastName:  identityUsers.lastName,
    })
    .from(identityUsers)
    .where(
      userIds.length === 1
        ? eq(identityUsers.id, userIds[0]!)
        : sql`${identityUsers.id} = ANY(${userIds})`,
    );

  const userMap = new Map(identityUsersRows.map((u) => [u.id, u]));

  // Step 3: merge and return
  const result: FacilityStaffMember[] = [];
  for (const [hpId, hp] of hpMap.entries()) {
    const u = userMap.get(hp.userId);
    if (!u) continue; // user not in identity DB yet (migration pending)
    result.push({
      healthProfessionalId: hpId,
      userId:               hp.userId,
      email:                u.email,
      firstName:            u.firstName,
      lastName:             u.lastName,
      roles:                hp.roles,
      isActive:             hp.isActive,
      joinedAt:             hp.joinedAt,
    });
  }
  return result;
}

// Role name accepted from API → facilityRoleEnum value stored in DB
const ROLE_NAME_TO_ENUM: Record<string, string> = {
  admin:       'facility_admin',
  pharmacist:  'pharmacist',
  staff:       'staff',
};

export async function adminCreateFacilityStaff(
  facilityId: string,
  data: { email: string; password: string; firstName: string; lastName: string; roleName: string },
): Promise<{ id: string }> {
  // Get facility including prefix
  const facilityRows = await superAdminDb.execute<{ prefix: string | null }>(sql`
    SELECT prefix FROM facilities WHERE id = ${facilityId}
  `);
  const facility = (Array.from(facilityRows) as Array<{ prefix: string | null }>)[0];
  if (!facility) throw new Error('Facility not found');
  if (!facility.prefix) throw new Error('Facility has no prefix configured. Set prefix before adding staff.');

  const roleEnum = ROLE_NAME_TO_ENUM[data.roleName];
  if (!roleEnum) throw new Error(`Unknown role '${data.roleName}'`);

  // Check email uniqueness in identity DB
  const existingUser = await getIdentityUserByEmail(data.email);
  if (existingUser) throw new Error(`Email '${data.email}' is already registered`);

  // Generate unique qualified username: {prefix}{emailLocal}
  const emailLocal = data.email.split('@')[0] ?? data.email;
  const { username, normalizedUsername } = await resolveUniqueUsername(emailLocal, facility.prefix);

  const passwordHash = await argon2.hash(data.password);

  // Create user in vtech-identity
  const identityUser = await createIdentityUser({
    email:              data.email,
    username,
    normalizedUsername,
    passwordHash,
    firstName:          data.firstName,
    lastName:           data.lastName,
    accountType:        'facility_user',
    facilityPrefix:     facility.prefix,
  });

  // Create health_professional + user_role in vtech-core (atomic)
  let healthProfessionalId: string;
  try {
    const result = await superAdminDb.transaction(async (tx) => {
      const hpRows = await tx.execute<{ id: string }>(sql`
        INSERT INTO health_professionals (user_id, facility_id, is_active, joined_at, updated_at)
        VALUES (${identityUser.id}, ${facilityId}, true, NOW(), NOW())
        RETURNING id
      `);
      const hpId = (Array.from(hpRows) as Array<{ id: string }>)[0]?.id;
      if (!hpId) throw new Error('Failed to create health_professional');

      await tx.execute(sql`
        INSERT INTO user_roles (health_professional_id, role, is_active, granted_at)
        VALUES (${hpId}, ${roleEnum}::facility_role, true, NOW())
        ON CONFLICT (health_professional_id, role) DO NOTHING
      `);

      return { id: hpId };
    });
    healthProfessionalId = result.id;
  } catch (err) {
    // Best-effort cleanup: remove orphaned identity user
    try {
      await identityDb
        .delete(identityUsers)
        .where(eq(identityUsers.id, identityUser.id));
    } catch {
      // Cleanup failure is non-fatal — log for ops visibility
      console.error('[adminCreateFacilityStaff] Failed to clean up orphaned identity user:', identityUser.id);
    }
    throw err;
  }

  return { id: healthProfessionalId };
}

export async function adminSetPlanModules(planId: string, moduleIds: string[]): Promise<void> {
  await superAdminDb.execute(sql`
    DELETE FROM plan_modules WHERE plan_id = ${planId}
  `);

  for (const moduleId of moduleIds) {
    await superAdminDb.execute(sql`
      INSERT INTO plan_modules (plan_id, module_id)
      VALUES (${planId}, ${moduleId})
      ON CONFLICT DO NOTHING
    `);
  }
}

// Cross-facility query helpers. This file is in src/core/super-admin/ because
// all queries use superAdminDb (BYPASSRLS) — they read across all facilities
// without tenant context. Phase 2 adds auth-specific helpers below.

import { eq, and, isNull, sql } from 'drizzle-orm';
import { superAdminDb, SuperAdminTransaction } from '@/db';
import { sessions, users, facilities } from '@/db/schema/core';
import {
  platformModules,
  planModules,
} from '@/db/schema/plans';
import { facilityModuleOverrides, facilityUsers, facilityRoles } from '@/db/schema/rbac';
import { redisSet, isRedisUnavailableError } from '@/lib/redis';
import { createAuditEntry, AuditEntryParams } from '@/core/audit/audit.service';

const AUTH_VERSION_CACHE_TTL = 60;
const REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60;

// ── Session revocation ────────────────────────────────────────────────────

export async function getSessionRevocationState(
  sessionId: string,
): Promise<{ exists: boolean; revokedAt: Date | null }> {
  const [session] = await superAdminDb
    .select({ id: sessions.id, revokedAt: sessions.revokedAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) return { exists: false, revokedAt: null };
  return { exists: true, revokedAt: session.revokedAt ?? null };
}

// ── Auth version ──────────────────────────────────────────────────────────

export async function getCurrentAuthVersion(userId: string): Promise<number | null> {
  const [user] = await superAdminDb
    .select({ authVersion: users.authVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.authVersion ?? null;
}

export async function cacheAuthVersion(
  userId: string,
  version: number,
): Promise<void> {
  try {
    await redisSet(`auth_version:${userId}`, String(version), AUTH_VERSION_CACHE_TTL);
  } catch (err) {
    if (!isRedisUnavailableError(err)) throw err;
    // Redis write failure is non-fatal — DB is source of truth
  }
}

// ── Facility status ───────────────────────────────────────────────────────

export type FacilityStatus = 'active' | 'suspended' | 'deactivated';

export async function getFacilityStatus(
  facilityId: string,
): Promise<FacilityStatus | null> {
  const [facility] = await superAdminDb
    .select({ status: facilities.status })
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  return (facility?.status as FacilityStatus) ?? null;
}

// ── Module access ─────────────────────────────────────────────────────────

export type ModuleAccessResult =
  | { access: 'granted' }
  | { access: 'denied'; code: 'MODULE_NOT_AVAILABLE' | 'MODULE_DISABLED' };

export async function getModuleAccess(
  facilityId: string,
  moduleKey: string,
): Promise<ModuleAccessResult> {
  // Find module
  const [mod] = await superAdminDb
    .select({ id: platformModules.id })
    .from(platformModules)
    .where(and(eq(platformModules.key, moduleKey), eq(platformModules.isActive, true)))
    .limit(1);

  if (!mod) return { access: 'denied', code: 'MODULE_NOT_AVAILABLE' };

  // Check facility override
  const [override] = await superAdminDb
    .select({ enabled: facilityModuleOverrides.enabled })
    .from(facilityModuleOverrides)
    .where(
      and(
        eq(facilityModuleOverrides.facilityId, facilityId),
        eq(facilityModuleOverrides.moduleId, mod.id),
      ),
    )
    .limit(1);

  if (override !== undefined) {
    return override.enabled
      ? { access: 'granted' }
      : { access: 'denied', code: 'MODULE_DISABLED' };
  }

  // Check plan
  const [facility] = await superAdminDb
    .select({ subscriptionPlanId: facilities.subscriptionPlanId })
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  if (!facility) return { access: 'denied', code: 'MODULE_NOT_AVAILABLE' };

  const [planModule] = await superAdminDb
    .select({ id: planModules.id })
    .from(planModules)
    .where(
      and(
        eq(planModules.planId, facility.subscriptionPlanId),
        eq(planModules.moduleId, mod.id),
      ),
    )
    .limit(1);

  return planModule
    ? { access: 'granted' }
    : { access: 'denied', code: 'MODULE_NOT_AVAILABLE' };
}

// ── Session revocation write ──────────────────────────────────────────────

export { revokeSession, revokeAllUserSessions, revokeAllFacilitySessions };

async function revokeSession(
  sessionId: string,
  reason: 'user_logout' | 'admin_revoked' | 'facility_suspended' | 'password_changed' | 'rotated' = 'admin_revoked',
): Promise<void> {
  await superAdminDb
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));

  try {
    await redisSet(`revoked_session:${sessionId}`, '1', REVOCATION_TTL_SECONDS);
  } catch (err) {
    if (!isRedisUnavailableError(err)) throw err;
  }
}

async function revokeAllUserSessions(
  userId: string,
  reason: 'user_logout' | 'admin_revoked' | 'facility_suspended' | 'password_changed' | 'rotated' = 'admin_revoked',
): Promise<void> {
  const revoked = await superAdminDb
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });

  for (const { id } of revoked) {
    try {
      await redisSet(`revoked_session:${id}`, '1', REVOCATION_TTL_SECONDS);
    } catch (err) {
      if (!isRedisUnavailableError(err)) throw err;
    }
  }
}

async function revokeAllFacilitySessions(
  facilityId: string,
  reason: 'user_logout' | 'admin_revoked' | 'facility_suspended' | 'password_changed' = 'facility_suspended',
): Promise<void> {
  const revoked = await superAdminDb
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(sessions.facilityId, facilityId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });

  for (const { id } of revoked) {
    try {
      await redisSet(`revoked_session:${id}`, '1', REVOCATION_TTL_SECONDS);
    } catch (err) {
      if (!isRedisUnavailableError(err)) throw err;
    }
  }
}

// ── Phase 2: Auth endpoint helpers ───────────────────────────────────────────
// All helpers below use superAdminDb (BYPASSRLS) to read/write across
// facility boundaries as required by auth flows.

export async function getFacilityBySlug(slug: string) {
  const [facility] = await superAdminDb
    .select()
    .from(facilities)
    .where(eq(facilities.slug, slug))
    .limit(1);
  return facility ?? null;
}

export async function getUserByEmail(email: string) {
  const [user] = await superAdminDb
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}

export async function getUserById(userId: string) {
  const [user] = await superAdminDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}) {
  const [user] = await superAdminDb
    .insert(users)
    .values(data)
    .returning();
  return user!;
}

export async function createSession(data: {
  id: string;
  userId: string;
  facilityId: string | null;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<void> {
  await superAdminDb.insert(sessions).values({
    id: data.id,
    userId: data.userId,
    facilityId: data.facilityId ?? null,
    refreshTokenHash: data.refreshTokenHash,
    userAgent: data.userAgent ?? null,
    ipAddress: data.ipAddress ?? null,
    expiresAt: data.expiresAt,
    lastUsedAt: new Date(),
  });
}

export async function getSessionById(sessionId: string) {
  const [session] = await superAdminDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return session ?? null;
}

export async function revokeSessionOnRotation(sessionId: string): Promise<void> {
  await superAdminDb
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: 'rotated' })
    .where(eq(sessions.id, sessionId));
}

export async function incrementAuthVersion(userId: string): Promise<void> {
  await superAdminDb
    .update(users)
    .set({ authVersion: sql`${users.authVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserPasswordAndVersion(
  userId: string,
  newPasswordHash: string,
): Promise<void> {
  await superAdminDb
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      authVersion: sql`${users.authVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function setPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await superAdminDb
    .update(users)
    .set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByPasswordResetToken(token: string) {
  const [user] = await superAdminDb
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  return user ?? null;
}

export async function clearPasswordResetToken(userId: string): Promise<void> {
  await superAdminDb
    .update(users)
    .set({ passwordResetToken: null, passwordResetExpiresAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function setEmailVerifyToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await superAdminDb
    .update(users)
    .set({ emailVerifyToken: token, emailVerifyExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserByEmailVerifyToken(token: string) {
  const [user] = await superAdminDb
    .select()
    .from(users)
    .where(eq(users.emailVerifyToken, token))
    .limit(1);
  return user ?? null;
}

export async function clearEmailVerifyTokenAndMarkVerified(userId: string): Promise<void> {
  await superAdminDb
    .update(users)
    .set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateLastLoginAt(userId: string): Promise<void> {
  await superAdminDb
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getFacilityUserByUserAndFacility(
  userId: string,
  facilityId: string,
) {
  const [link] = await superAdminDb
    .select()
    .from(facilityUsers)
    .where(and(eq(facilityUsers.userId, userId), eq(facilityUsers.facilityId, facilityId)))
    .limit(1);
  return link ?? null;
}

export async function getFacilityRoleName(roleId: string): Promise<string | null> {
  const [role] = await superAdminDb
    .select({ name: facilityRoles.name })
    .from(facilityRoles)
    .where(eq(facilityRoles.id, roleId))
    .limit(1);
  return role?.name ?? null;
}

// writeAuthAuditEntry — writes a single audit entry using a fresh superAdminDb
// transaction. Auth.service.ts calls this instead of createAuditEntry directly
// (which requires an open transaction to be passed in).
export async function writeAuthAuditEntry(
  params: Omit<AuditEntryParams, 'actorType'> & { actorType?: AuditEntryParams['actorType'] },
): Promise<void> {
  try {
    await superAdminDb.transaction(async (tx) => {
      await createAuditEntry(
        { actorType: 'user', ...params },
        tx as SuperAdminTransaction,
      );
    });
  } catch (err) {
    // Audit write failure is logged but not propagated — never block the auth flow
    console.error('[auth-queries] writeAuthAuditEntry failed:', err);
  }
}

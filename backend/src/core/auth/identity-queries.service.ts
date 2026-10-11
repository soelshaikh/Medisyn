// All reads/writes against the vtech-identity database.
// Imported from auth.service.ts, auth middleware, and (after migration) admin-facilities.

import { eq, and, isNull, sql } from 'drizzle-orm';
import { identityDb } from '@/db';
import { identityUsers, identitySessions } from '@/db/schema/identity';
import { redisSet, isRedisUnavailableError } from '@/lib/redis';

const REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_VERSION_CACHE_TTL = 60;

// ── User queries ───────────────────────────────────────────────────────────────

export async function getIdentityUserByEmail(email: string) {
  const [user] = await identityDb
    .select()
    .from(identityUsers)
    .where(eq(identityUsers.email, email))
    .limit(1);
  return user ?? null;
}

export async function getIdentityUserById(id: string) {
  const [user] = await identityDb
    .select()
    .from(identityUsers)
    .where(eq(identityUsers.id, id))
    .limit(1);
  return user ?? null;
}

export async function getIdentityUserByPasswordResetToken(token: string) {
  const [user] = await identityDb
    .select()
    .from(identityUsers)
    .where(eq(identityUsers.passwordResetToken, token))
    .limit(1);
  return user ?? null;
}

export async function getIdentityUserByEmailVerifyToken(token: string) {
  const [user] = await identityDb
    .select()
    .from(identityUsers)
    .where(eq(identityUsers.emailVerifyToken, token))
    .limit(1);
  return user ?? null;
}

export async function createIdentityUser(data: {
  email: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  accountType: 'super_admin' | 'facility_user' | 'patient';
  facilityPrefix?: string | null;
}) {
  const [user] = await identityDb
    .insert(identityUsers)
    .values(data)
    .returning();
  return user!;
}

export async function updateIdentityLastLoginAt(userId: string): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(identityUsers.id, userId));
}

export async function incrementIdentityAuthVersion(userId: string): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({ authVersion: sql`${identityUsers.authVersion} + 1`, updatedAt: new Date() })
    .where(eq(identityUsers.id, userId));
}

export async function updateIdentityUserPasswordAndVersion(
  userId: string,
  newPasswordHash: string,
): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({
      passwordHash: newPasswordHash,
      authVersion: sql`${identityUsers.authVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(identityUsers.id, userId));
}

export async function setIdentityPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(identityUsers.id, userId));
}

export async function clearIdentityPasswordResetToken(userId: string): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({ passwordResetToken: null, passwordResetExpiresAt: null, updatedAt: new Date() })
    .where(eq(identityUsers.id, userId));
}

export async function setIdentityEmailVerifyToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({ emailVerifyToken: token, emailVerifyExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(identityUsers.id, userId));
}

export async function clearIdentityEmailVerifyTokenAndMarkVerified(userId: string): Promise<void> {
  await identityDb
    .update(identityUsers)
    .set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(identityUsers.id, userId));
}

// ── Auth-version helpers (used by verify-auth-version middleware) ─────────────

export async function getIdentityAuthVersion(userId: string): Promise<number | null> {
  const [user] = await identityDb
    .select({ authVersion: identityUsers.authVersion })
    .from(identityUsers)
    .where(eq(identityUsers.id, userId))
    .limit(1);
  return user?.authVersion ?? null;
}

export async function cacheIdentityAuthVersion(userId: string, version: number): Promise<void> {
  try {
    await redisSet(`auth_version:${userId}`, String(version), AUTH_VERSION_CACHE_TTL);
  } catch (err) {
    if (!isRedisUnavailableError(err)) throw err;
  }
}

// ── Username helpers ───────────────────────────────────────────────────────────

function normaliseStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function resolveUniqueUsername(
  emailLocalPart: string,
  facilityPrefix: string | null,
): Promise<{ username: string; normalizedUsername: string }> {
  const base = normaliseStr(emailLocalPart) || 'user';
  const candidate = facilityPrefix ? `${facilityPrefix}${base}` : base;
  let counter = 0;

  while (true) {
    const slug = counter === 0 ? candidate : `${candidate}${counter}`;
    const [existing] = await identityDb
      .select({ id: identityUsers.id })
      .from(identityUsers)
      .where(eq(identityUsers.normalizedUsername, slug))
      .limit(1);
    if (!existing) return { username: slug, normalizedUsername: slug };
    counter++;
  }
}

// ── Session queries ────────────────────────────────────────────────────────────

export async function createIdentitySession(data: {
  id: string;
  userId: string;
  facilityId: string | null;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<void> {
  await identityDb.insert(identitySessions).values({
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

export async function getIdentitySessionById(sessionId: string) {
  const [session] = await identityDb
    .select()
    .from(identitySessions)
    .where(eq(identitySessions.id, sessionId))
    .limit(1);
  return session ?? null;
}

export async function getIdentitySessionRevocationState(
  sessionId: string,
): Promise<{ exists: boolean; revokedAt: Date | null }> {
  const [session] = await identityDb
    .select({ id: identitySessions.id, revokedAt: identitySessions.revokedAt })
    .from(identitySessions)
    .where(eq(identitySessions.id, sessionId))
    .limit(1);
  if (!session) return { exists: false, revokedAt: null };
  return { exists: true, revokedAt: session.revokedAt ?? null };
}

export async function revokeIdentitySession(
  sessionId: string,
  reason: 'user_logout' | 'admin_revoked' | 'facility_suspended' | 'password_changed' | 'rotated' = 'admin_revoked',
): Promise<void> {
  await identityDb
    .update(identitySessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(identitySessions.id, sessionId), isNull(identitySessions.revokedAt)));

  try {
    await redisSet(`revoked_session:${sessionId}`, '1', REVOCATION_TTL_SECONDS);
  } catch (err) {
    if (!isRedisUnavailableError(err)) throw err;
  }
}

export async function revokeIdentitySessionOnRotation(sessionId: string): Promise<void> {
  await identityDb
    .update(identitySessions)
    .set({ revokedAt: new Date(), revokedReason: 'rotated' })
    .where(eq(identitySessions.id, sessionId));
}

export async function revokeAllIdentityUserSessions(
  userId: string,
  reason: 'user_logout' | 'admin_revoked' | 'facility_suspended' | 'password_changed' = 'admin_revoked',
): Promise<void> {
  const revoked = await identityDb
    .update(identitySessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(identitySessions.userId, userId), isNull(identitySessions.revokedAt)))
    .returning({ id: identitySessions.id });

  for (const { id } of revoked) {
    try {
      await redisSet(`revoked_session:${id}`, '1', REVOCATION_TTL_SECONDS);
    } catch (err) {
      if (!isRedisUnavailableError(err)) throw err;
    }
  }
}

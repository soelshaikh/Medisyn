import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { getSuperAdminTestDb } from './db';
import * as coreSchema from '@/db/schema/core';
import * as rbacSchema from '@/db/schema/rbac';
import * as plansSchema from '@/db/schema/plans';

// ── Plan fixture ───────────────────────────────────────────────────────

let _starterPlanId: string | null = null;

export async function getOrCreateStarterPlan(): Promise<string> {
  if (_starterPlanId) return _starterPlanId;
  const sa = getSuperAdminTestDb();
  const existing = await sa
    .select()
    .from(plansSchema.subscriptionPlans)
    .where(eq(plansSchema.subscriptionPlans.key, 'starter'))
    .limit(1);

  if (existing.length > 0) {
    _starterPlanId = existing[0].id;
    return _starterPlanId;
  }

  const [plan] = await sa
    .insert(plansSchema.subscriptionPlans)
    .values({ key: 'starter', name: 'Starter (Test)' })
    .returning({ id: plansSchema.subscriptionPlans.id });
  _starterPlanId = plan.id;
  return _starterPlanId;
}

// ── Facility fixture ───────────────────────────────────────────────────

export async function createTestFacility(
  overrides: Partial<typeof coreSchema.facilities.$inferInsert> = {},
): Promise<{ id: string; slug: string }> {
  const sa = getSuperAdminTestDb();
  const planId = await getOrCreateStarterPlan();
  const slug = overrides.slug ?? `test-facility-${uuidv4().slice(0, 8)}`;

  const [facility] = await sa
    .insert(coreSchema.facilities)
    .values({
      name: overrides.name ?? `Test Facility ${slug}`,
      slug,
      status: overrides.status ?? 'active',
      subscriptionPlanId: overrides.subscriptionPlanId ?? planId,
      settings: overrides.settings ?? {},
    })
    .returning({ id: coreSchema.facilities.id, slug: coreSchema.facilities.slug });

  return facility;
}

// ── User + facility membership fixture ────────────────────────────────

export async function createTestUser(
  facilityId: string,
  roleName: string = 'staff',
  overrides: Partial<typeof coreSchema.users.$inferInsert> = {},
): Promise<{ userId: string; roleId: string }> {
  const sa = getSuperAdminTestDb();

  // Create user
  const email = overrides.email ?? `test-${uuidv4().slice(0, 8)}@test.vtechmed.dev`;
  const passwordHash = await argon2.hash('TestPassword123!');

  const [user] = await sa
    .insert(coreSchema.users)
    .values({
      email,
      passwordHash,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      emailVerified: true,
      ...overrides,
    })
    .returning({ id: coreSchema.users.id });

  // Find or create role for this facility
  let role = await sa
    .select()
    .from(rbacSchema.facilityRoles)
    .where(
      (fr: typeof rbacSchema.facilityRoles.$inferSelect) =>
        eq(fr.facilityId, facilityId) && eq(fr.name, roleName),
    )
    .limit(1);

  if (role.length === 0) {
    const [created] = await sa
      .insert(rbacSchema.facilityRoles)
      .values({ facilityId, name: roleName, isSystemRole: false })
      .returning({ id: rbacSchema.facilityRoles.id });
    role = [created];
  }

  const roleId = role[0].id;

  // Create facility membership
  await sa.insert(rbacSchema.facilityUsers).values({
    facilityId,
    userId: user.id,
    roleId,
    isActive: true,
  });

  // Create a session for this user
  await sa.insert(coreSchema.sessions).values({
    userId: user.id,
    facilityId,
    refreshTokenHash: await argon2.hash(`refresh-${uuidv4()}`),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { userId: user.id, roleId };
}

// ── Phase 2: Auth test helpers ─────────────────────────────────────────────

let _emailCounter = 0;

/** Generate a unique email address for each test to avoid collisions. */
export function uniqueEmail(prefix = 'patient'): string {
  return `${prefix}.${Date.now()}.${++_emailCounter}@test.vtechmed.dev`;
}

/** Get a facility by its slug. Returns null if not found. */
export async function getTestFacilityBySlug(
  slug: string,
): Promise<typeof coreSchema.facilities.$inferSelect | null> {
  const sa = getSuperAdminTestDb();
  const [facility] = await sa
    .select()
    .from(coreSchema.facilities)
    .where(eq(coreSchema.facilities.slug, slug))
    .limit(1);
  return facility ?? null;
}

/** Delete a user by email (cascade deletes sessions, facilityUsers). */
export async function deleteUserByEmail(email: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa.delete(coreSchema.users).where(eq(coreSchema.users.email, email));
}

/** Delete all users whose email matches the given prefix (for bulk cleanup). */
export async function deleteTestUsersByEmailPrefix(prefix: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  const allUsers = await sa.select({ id: coreSchema.users.id, email: coreSchema.users.email })
    .from(coreSchema.users);
  for (const u of allUsers) {
    if (u.email.startsWith(prefix)) {
      await sa.delete(coreSchema.users).where(eq(coreSchema.users.id, u.id));
    }
  }
}

/** Get the most recent non-revoked session for a userId. */
export async function getActiveSessionForUser(userId: string) {
  const sa = getSuperAdminTestDb();
  const [session] = await sa
    .select()
    .from(coreSchema.sessions)
    .where(and(eq(coreSchema.sessions.userId, userId), isNull(coreSchema.sessions.revokedAt)))
    .limit(1);
  return session ?? null;
}

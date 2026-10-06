// Phase 2 — US2: Patient Login
// Requires: Docker Compose up + db:migrate + db:seed + db:seed:facilities

import { describe, it, expect, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { getSuperAdminTestDb, closeTestConnections } from '../setup/db';
import { uniqueEmail, deleteUserByEmail } from '../setup/fixtures';
import * as rbacSchema from '@/db/schema/rbac';
import * as auditSchema from '@/db/schema/audit';
import { eq, and } from 'drizzle-orm';

const app = createApp();
const agent = supertest(app);
const sa = getSuperAdminTestDb();

const ACTIVE_SLUG = 'test-pharmacy';
const SUSPENDED_SLUG = 'suspended-pharmacy';

/** Register a user and return the email for use in login tests */
async function registerAndGetUser(email: string, password = 'password123') {
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ firstName: 'Login', lastName: 'Tester', email, password, facilitySlug: ACTIVE_SLUG });
  if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  return res.body.data.userId as string;
}

afterAll(async () => {
  await closeTestConnections();
});

describe('POST /api/v1/auth/login', () => {
  // LOG-001: valid credentials → 200 + tokens
  it('LOG-001: returns 200 with accessToken and user on valid credentials', async () => {
    const email = uniqueEmail('log001');
    try {
      await registerAndGetUser(email);
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.user).toBeDefined();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // LOG-002: wrong password → 401 INVALID_CREDENTIALS
  it('LOG-002: returns 401 INVALID_CREDENTIALS for wrong password', async () => {
    const email = uniqueEmail('log002');
    try {
      await registerAndGetUser(email);
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrongpassword', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // LOG-003: unknown email → 401 INVALID_CREDENTIALS
  it('LOG-003: returns 401 INVALID_CREDENTIALS for unknown email', async () => {
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@nonexistent.test', password: 'password123', facilitySlug: ACTIVE_SLUG });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  // LOG-004: unknown facilitySlug → 404
  it('LOG-004: returns 404 FACILITY_NOT_FOUND for unknown facility', async () => {
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('log004'), password: 'password123', facilitySlug: 'no-such-pharmacy' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FACILITY_NOT_FOUND');
  });

  // LOG-005: suspended facility → 403
  it('LOG-005: returns 403 FACILITY_INACTIVE for suspended facility', async () => {
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('log005'), password: 'password123', facilitySlug: SUSPENDED_SLUG });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FACILITY_INACTIVE');
  });

  // LOG-006: inactive facilityUser → 403 ACCOUNT_INACTIVE
  it('LOG-006: returns 403 ACCOUNT_INACTIVE when facilityUsers.isActive=false', async () => {
    const email = uniqueEmail('log006');
    try {
      const userId = await registerAndGetUser(email);
      // Deactivate the facilityUser record directly
      await sa
        .update(rbacSchema.facilityUsers)
        .set({ isActive: false })
        .where(eq(rbacSchema.facilityUsers.userId, userId));

      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // LOG-007: response body has correct user object shape
  it('LOG-007: user object has id, email, firstName, lastName, emailVerified, role, facilityId', async () => {
    const email = uniqueEmail('log007');
    try {
      await registerAndGetUser(email);
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(200);
      const user = res.body.data.user;
      expect(typeof user.id).toBe('string');
      expect(user.email).toBe(email);
      expect(typeof user.firstName).toBe('string');
      expect(typeof user.lastName).toBe('string');
      expect(typeof user.emailVerified).toBe('boolean');
      expect(typeof user.role).toBe('string');
      expect(user.facilityId).toBeDefined();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // LOG-008: HttpOnly refresh_token cookie is set
  it('LOG-008: response sets HttpOnly refresh_token cookie', async () => {
    const email = uniqueEmail('log008');
    try {
      await registerAndGetUser(email);
      const res = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
      expect(cookieStr).toContain('refresh_token=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // LOG-009: writes auth.login audit entry
  it('LOG-009: writes auth.login audit entry after successful login', async () => {
    const email = uniqueEmail('log009');
    try {
      const userId = await registerAndGetUser(email);
      await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      await new Promise((r) => setTimeout(r, 50));

      const [row] = await sa
        .select()
        .from(auditSchema.auditLog)
        .where(and(eq(auditSchema.auditLog.actorId, userId), eq(auditSchema.auditLog.action, 'auth.login')))
        .limit(1);

      expect(row).toBeDefined();
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

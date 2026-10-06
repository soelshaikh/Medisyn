// Phase 2 — US1: Patient Self-Registration
// Requires: Docker Compose up + db:migrate + db:seed + db:seed:facilities

import { describe, it, expect, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { getSuperAdminTestDb, closeTestConnections } from '../setup/db';
import { uniqueEmail, deleteUserByEmail } from '../setup/fixtures';
import * as auditSchema from '@/db/schema/audit';
import { eq, and } from 'drizzle-orm';

const app = createApp();
const agent = supertest(app);
const sa = getSuperAdminTestDb();

// Slugs set up by db:seed:facilities
const ACTIVE_SLUG = 'test-pharmacy';
const SUSPENDED_SLUG = 'suspended-pharmacy';
const SECOND_SLUG = 'second-pharmacy';

afterAll(async () => {
  await closeTestConnections();
});

describe('POST /api/v1/auth/register', () => {
  // REG-001: valid registration
  it('REG-001: returns 201 with userId on valid registration', async () => {
    const email = uniqueEmail('reg001');
    try {
      const res = await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(201);
      expect(res.body.data.userId).toBeDefined();
      expect(typeof res.body.data.userId).toBe('string');
      expect(res.body.data.message).toContain('verify your account');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REG-002: duplicate email at same facility
  it('REG-002: returns 409 EMAIL_IN_USE for duplicate email at same facility', async () => {
    const email = uniqueEmail('reg002');
    try {
      await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_IN_USE');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REG-003: unknown facilitySlug
  it('REG-003: returns 404 FACILITY_NOT_FOUND for unknown slug', async () => {
    const res = await agent
      .post('/api/v1/auth/register')
      .send({ firstName: 'Jane', lastName: 'Doe', email: uniqueEmail('reg003'), password: 'password123', facilitySlug: 'no-such-pharmacy-xyz' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FACILITY_NOT_FOUND');
  });

  // REG-004: suspended facility
  it('REG-004: returns 403 FACILITY_INACTIVE for suspended facility', async () => {
    const res = await agent
      .post('/api/v1/auth/register')
      .send({ firstName: 'Jane', lastName: 'Doe', email: uniqueEmail('reg004'), password: 'password123', facilitySlug: SUSPENDED_SLUG });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FACILITY_INACTIVE');
  });

  // REG-005: password too short
  it('REG-005: returns 422 VALIDATION_ERROR for password shorter than 8 chars', async () => {
    const res = await agent
      .post('/api/v1/auth/register')
      .send({ firstName: 'Jane', lastName: 'Doe', email: uniqueEmail('reg005'), password: 'abc123', facilitySlug: ACTIVE_SLUG });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // REG-006: cross-pharmacy linking — correct password
  it('REG-006: allows cross-pharmacy linking with correct password — returns 201', async () => {
    const email = uniqueEmail('reg006');
    try {
      // Register at first pharmacy
      const r1 = await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: ACTIVE_SLUG });
      expect(r1.status).toBe(201);
      const firstUserId = r1.body.data.userId;

      // Register same email at second pharmacy with correct password
      const r2 = await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: SECOND_SLUG });
      expect(r2.status).toBe(201);
      // Should return same userId (account was linked, not duplicated)
      expect(r2.body.data.userId).toBe(firstUserId);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REG-007: cross-pharmacy linking — wrong password
  it('REG-007: returns 409 ACCOUNT_EXISTS_LOGIN for cross-pharmacy with wrong password', async () => {
    const email = uniqueEmail('reg007');
    try {
      await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: ACTIVE_SLUG });

      const res = await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'wrongpassword', facilitySlug: SECOND_SLUG });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACCOUNT_EXISTS_LOGIN');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REG-008: audit log entry written
  it('REG-008: writes auth.register entry to auditLog after successful registration', async () => {
    const email = uniqueEmail('reg008');
    try {
      const res = await agent
        .post('/api/v1/auth/register')
        .send({ firstName: 'Jane', lastName: 'Doe', email, password: 'password123', facilitySlug: ACTIVE_SLUG });
      expect(res.status).toBe(201);
      const userId = res.body.data.userId;

      // Give audit write a moment (it's non-blocking but fast)
      await new Promise((r) => setTimeout(r, 50));

      const [auditRow] = await sa
        .select()
        .from(auditSchema.auditLog)
        .where(and(eq(auditSchema.auditLog.actorId, userId), eq(auditSchema.auditLog.action, 'auth.register')))
        .limit(1);

      expect(auditRow).toBeDefined();
      expect(auditRow.action).toBe('auth.register');
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

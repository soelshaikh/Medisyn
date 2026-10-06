// Phase 2 — US5: Forgot/Reset Password + US6: Email Verification
// Requires: Docker Compose up + db:migrate + db:seed + db:seed:facilities

import { describe, it, expect, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { getSuperAdminTestDb, closeTestConnections } from '../setup/db';
import { uniqueEmail, deleteUserByEmail } from '../setup/fixtures';
import * as coreSchema from '@/db/schema/core';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const app = createApp();
const agent = supertest(app);
const sa = getSuperAdminTestDb();

const ACTIVE_SLUG = 'test-pharmacy';

async function registerUser(email: string): Promise<string> {
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ firstName: 'PwReset', lastName: 'Tester', email, password: 'oldpassword1', facilitySlug: ACTIVE_SLUG });
  if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  return res.body.data.userId as string;
}

/** Directly set a password reset token with a given expiry offset (in ms from now) */
async function setResetToken(userId: string, token: string, expiresOffsetMs: number): Promise<void> {
  await sa
    .update(coreSchema.users)
    .set({
      passwordResetToken: token,
      passwordResetExpiresAt: new Date(Date.now() + expiresOffsetMs),
    })
    .where(eq(coreSchema.users.id, userId));
}

/** Directly set an email verify token with a given expiry offset (in ms from now) */
async function setVerifyToken(userId: string, token: string, expiresOffsetMs: number): Promise<void> {
  await sa
    .update(coreSchema.users)
    .set({
      emailVerifyToken: token,
      emailVerifyExpiresAt: new Date(Date.now() + expiresOffsetMs),
    })
    .where(eq(coreSchema.users.id, userId));
}

afterAll(async () => {
  await closeTestConnections();
});

// ── US5: Forgot/Reset Password ─────────────────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  // PW-001: always returns 200 (enumerate-safe — never reveals if email exists)
  it('PW-001: returns 200 regardless of whether the email is registered', async () => {
    const resRegistered = await agent
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'registered@test.vtechmed.dev' });
    expect(resRegistered.status).toBe(200);

    const resUnknown = await agent
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@nowhere.test' });
    expect(resUnknown.status).toBe(200);
  });

  // PW-002: sets passwordResetToken + expiresAt in DB for registered user
  it('PW-002: sets passwordResetToken and passwordResetExpiresAt for a known user', async () => {
    const email = uniqueEmail('pw002');
    try {
      const userId = await registerUser(email);

      await agent.post('/api/v1/auth/forgot-password').send({ email });

      const [user] = await sa
        .select()
        .from(coreSchema.users)
        .where(eq(coreSchema.users.id, userId))
        .limit(1);

      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetToken).not.toBeNull();
      expect(user.passwordResetExpiresAt).toBeDefined();
      expect(user.passwordResetExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // PW-003: invalid email format → 422 VALIDATION_ERROR
  it('PW-003: returns 422 VALIDATION_ERROR for invalid email format', async () => {
    const res = await agent.post('/api/v1/auth/forgot-password').send({ email: 'notanemail' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  // PW-004: valid token + new password → 200 + password updated + all sessions revoked
  it('PW-004: returns 200 and updates password + revokes sessions on valid token', async () => {
    const email = uniqueEmail('pw004');
    try {
      const userId = await registerUser(email);
      const token = uuidv4();
      await setResetToken(userId, token, 30 * 60 * 1000); // 30 min from now

      // Create a session first so we can verify it gets revoked
      await sa.insert(coreSchema.sessions).values({
        userId,
        facilityId: null,
        refreshTokenHash: 'dummyhash',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const res = await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'newpassword1' });

      expect(res.status).toBe(200);

      // All sessions should be revoked
      const sessions = await sa
        .select()
        .from(coreSchema.sessions)
        .where(eq(coreSchema.sessions.userId, userId));
      const active = sessions.filter((s) => s.revokedAt === null);
      expect(active).toHaveLength(0);

      // Password reset token should be cleared
      const [user] = await sa
        .select()
        .from(coreSchema.users)
        .where(eq(coreSchema.users.id, userId))
        .limit(1);
      expect(user.passwordResetToken).toBeNull();

      // Can now login with new password
      const loginRes = await agent
        .post('/api/v1/auth/login')
        .send({ email, password: 'newpassword1', facilitySlug: ACTIVE_SLUG });
      expect(loginRes.status).toBe(200);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // PW-005: invalid/unknown token → 400 RESET_TOKEN_INVALID
  it('PW-005: returns 400 RESET_TOKEN_INVALID for unknown token', async () => {
    const res = await agent
      .post('/api/v1/auth/reset-password')
      .send({ token: uuidv4(), password: 'newpassword1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  // PW-006: expired token → 400 RESET_TOKEN_INVALID
  it('PW-006: returns 400 RESET_TOKEN_INVALID for expired token', async () => {
    const email = uniqueEmail('pw006');
    try {
      const userId = await registerUser(email);
      const token = uuidv4();
      await setResetToken(userId, token, -1000); // already expired

      const res = await agent
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'newpassword1' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // PW-007: password too short → 422 VALIDATION_ERROR
  it('PW-007: returns 422 VALIDATION_ERROR when new password is too short', async () => {
    const res = await agent
      .post('/api/v1/auth/reset-password')
      .send({ token: uuidv4(), password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── US6: Email Verification ────────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-email', () => {
  // EV-001: valid token → 200 + emailVerified=true
  it('EV-001: returns 200 and marks emailVerified=true for valid token', async () => {
    const email = uniqueEmail('ev001');
    try {
      const userId = await registerUser(email);
      const token = uuidv4();
      await setVerifyToken(userId, token, 24 * 60 * 60 * 1000); // 24h

      const res = await agent.post('/api/v1/auth/verify-email').send({ token });

      expect(res.status).toBe(200);

      const [user] = await sa
        .select()
        .from(coreSchema.users)
        .where(eq(coreSchema.users.id, userId))
        .limit(1);
      expect(user.emailVerified).toBe(true);
      expect(user.emailVerifyToken).toBeNull();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // EV-002: unknown token → 400 VERIFY_TOKEN_INVALID
  it('EV-002: returns 400 VERIFY_TOKEN_INVALID for unknown token', async () => {
    const res = await agent.post('/api/v1/auth/verify-email').send({ token: uuidv4() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VERIFY_TOKEN_INVALID');
  });

  // EV-003: expired token → 400 VERIFY_TOKEN_INVALID
  it('EV-003: returns 400 VERIFY_TOKEN_INVALID for expired token', async () => {
    const email = uniqueEmail('ev003');
    try {
      const userId = await registerUser(email);
      const token = uuidv4();
      await setVerifyToken(userId, token, -1000); // already expired

      const res = await agent.post('/api/v1/auth/verify-email').send({ token });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VERIFY_TOKEN_INVALID');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // EV-004: idempotent — already verified → 200 (no error)
  it('EV-004: returns 200 idempotently when email already verified', async () => {
    const email = uniqueEmail('ev004');
    try {
      const userId = await registerUser(email);
      const token = uuidv4();
      await setVerifyToken(userId, token, 24 * 60 * 60 * 1000);
      // Mark already verified directly
      await sa
        .update(coreSchema.users)
        .set({ emailVerified: true, emailVerifyToken: token })
        .where(eq(coreSchema.users.id, userId));

      const res = await agent.post('/api/v1/auth/verify-email').send({ token });
      expect(res.status).toBe(200);
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

describe('POST /api/v1/auth/resend-verification', () => {
  // EV-005: registered unverified email → 200 + new token set
  it('EV-005: returns 200 and sets a new emailVerifyToken for an unverified user', async () => {
    const email = uniqueEmail('ev005');
    try {
      const userId = await registerUser(email);

      // Ensure emailVerified is false
      await sa
        .update(coreSchema.users)
        .set({ emailVerified: false })
        .where(eq(coreSchema.users.id, userId));

      const res = await agent.post('/api/v1/auth/resend-verification').send({ email });
      expect(res.status).toBe(200);

      const [user] = await sa
        .select()
        .from(coreSchema.users)
        .where(eq(coreSchema.users.id, userId))
        .limit(1);
      expect(user.emailVerifyToken).not.toBeNull();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // EV-006: unknown email → 200 (enumerate-safe — never reveals account existence)
  it('EV-006: returns 200 for unknown email without revealing account existence', async () => {
    const res = await agent
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'nobody@doesnotexist.test' });
    expect(res.status).toBe(200);
  });
});

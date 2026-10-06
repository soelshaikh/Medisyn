// Phase 2 — US3: Token Refresh with rotation + theft detection
// Requires: Docker Compose up + db:migrate + db:seed + db:seed:facilities

import { describe, it, expect, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { getSuperAdminTestDb, closeTestConnections } from '../setup/db';
import { uniqueEmail, deleteUserByEmail } from '../setup/fixtures';
import * as coreSchema from '@/db/schema/core';
import { eq, isNull } from 'drizzle-orm';

const app = createApp();
const sa = getSuperAdminTestDb();

const ACTIVE_SLUG = 'test-pharmacy';

interface LoginResult {
  accessToken: string;
  cookieHeader: string[];
  userId: string;
}

async function registerAndLogin(email: string): Promise<LoginResult> {
  const agent = supertest(app);
  await agent
    .post('/api/v1/auth/register')
    .send({ firstName: 'Refresh', lastName: 'Tester', email, password: 'password123', facilitySlug: ACTIVE_SLUG });

  const loginRes = await agent
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123', facilitySlug: ACTIVE_SLUG });

  if (loginRes.status !== 200) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);

  const cookieHeader = loginRes.headers['set-cookie'] as string[] | string | undefined;
  return {
    accessToken: loginRes.body.data.accessToken,
    cookieHeader: Array.isArray(cookieHeader) ? cookieHeader : (cookieHeader ? [cookieHeader] : []),
    userId: loginRes.body.data.user.id,
  };
}

/** Extract the refresh_token value from set-cookie headers */
function extractRefreshToken(setCookieHeaders: string[]): string {
  for (const c of setCookieHeaders) {
    const match = c.match(/refresh_token=([^;]+)/);
    if (match) return match[1];
  }
  throw new Error('No refresh_token found in set-cookie');
}

afterAll(async () => {
  await closeTestConnections();
});

describe('POST /api/v1/auth/refresh', () => {
  // REF-001: valid refresh returns new accessToken + rotates cookie
  it('REF-001: returns 200 with new accessToken and rotated refresh cookie', async () => {
    const email = uniqueEmail('ref001');
    try {
      const { accessToken, cookieHeader } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.accessToken).not.toBe(accessToken);

      // New cookie should be set
      const newCookies = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(newCookies) ? newCookies.join('; ') : (newCookies ?? '');
      expect(cookieStr).toContain('refresh_token=');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-002: missing refresh_token cookie → 401 REFRESH_TOKEN_MISSING
  it('REF-002: returns 401 REFRESH_TOKEN_MISSING when cookie is absent', async () => {
    const email = uniqueEmail('ref002');
    try {
      const { accessToken } = await registerAndLogin(email);

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`);
      // No cookie

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_MISSING');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-003: missing Authorization header → 401 REFRESH_TOKEN_INVALID
  it('REF-003: returns 401 REFRESH_TOKEN_INVALID when Authorization header is absent', async () => {
    const email = uniqueEmail('ref003');
    try {
      const { cookieHeader } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${refreshToken}`]);
      // No Authorization

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-004: wrong token in cookie (valid JWT session, wrong hash) → 401 REFRESH_TOKEN_INVALID
  it('REF-004: returns 401 REFRESH_TOKEN_INVALID when cookie value is tampered', async () => {
    const email = uniqueEmail('ref004');
    try {
      const { accessToken } = await registerAndLogin(email);

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', ['refresh_token=totallywrongtoken0000000000000000000000000000000000000000000000000']);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-005: expired session (manually set expiresAt to the past)
  it('REF-005: returns 401 REFRESH_TOKEN_EXPIRED when session expiresAt is in the past', async () => {
    const email = uniqueEmail('ref005');
    try {
      const { accessToken, cookieHeader, userId } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      // Expire the session manually
      await sa
        .update(coreSchema.sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(coreSchema.sessions.userId, userId));

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_EXPIRED');
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-006: token reuse detection — re-present an already-rotated session
  it('REF-006: returns 401 REFRESH_TOKEN_REUSE and revokes all sessions when rotated token is re-used', async () => {
    const email = uniqueEmail('ref006');
    try {
      const { accessToken, cookieHeader, userId } = await registerAndLogin(email);
      const oldRefreshToken = extractRefreshToken(cookieHeader);

      // First refresh — rotates the token
      const r1 = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${oldRefreshToken}`]);
      expect(r1.status).toBe(200);

      // Re-present the OLD (now rotated) token
      const r2 = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${oldRefreshToken}`]);

      expect(r2.status).toBe(401);
      expect(r2.body.error.code).toBe('REFRESH_TOKEN_REUSE');

      // All sessions for this user should now be revoked
      const activeSessions = await sa
        .select()
        .from(coreSchema.sessions)
        .where(isNull(coreSchema.sessions.revokedAt));
      const userActiveSessions = activeSessions.filter((s) => s.userId === userId);
      expect(userActiveSessions).toHaveLength(0);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-007: after rotation, old session is revoked with revokedReason='rotated'
  it('REF-007: old session has revokedAt set with revokedReason=rotated after refresh', async () => {
    const email = uniqueEmail('ref007');
    try {
      const { accessToken, cookieHeader, userId } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${refreshToken}`]);
      expect(res.status).toBe(200);

      // Find the revoked session
      const revokedSessions = await sa
        .select()
        .from(coreSchema.sessions)
        .where(eq(coreSchema.sessions.userId, userId));

      const rotated = revokedSessions.find((s) => s.revokedReason === 'rotated');
      expect(rotated).toBeDefined();
      expect(rotated!.revokedAt).not.toBeNull();

      // There should also be one active new session
      const active = revokedSessions.find((s) => s.revokedAt === null);
      expect(active).toBeDefined();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // REF-008: completely invalid JWT in Authorization header
  it('REF-008: returns 401 REFRESH_TOKEN_INVALID when Authorization JWT is garbage', async () => {
    const email = uniqueEmail('ref008');
    try {
      const { cookieHeader } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer notajwtatallgarbage')
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

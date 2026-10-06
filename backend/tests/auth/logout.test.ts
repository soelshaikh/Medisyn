// Phase 2 — US4: Logout (single + all sessions)
// Requires: Docker Compose up + db:migrate + db:seed + db:seed:facilities

import { describe, it, expect, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { getSuperAdminTestDb, closeTestConnections } from '../setup/db';
import { uniqueEmail, deleteUserByEmail } from '../setup/fixtures';
import * as coreSchema from '@/db/schema/core';
import { eq } from 'drizzle-orm';

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
    .send({ firstName: 'Logout', lastName: 'Tester', email, password: 'password123', facilitySlug: ACTIVE_SLUG });

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

describe('POST /api/v1/auth/logout', () => {
  // OUT-001: valid logout → 200 + session revoked in DB
  it('OUT-001: returns 200 and revokes the current session', async () => {
    const email = uniqueEmail('out001');
    try {
      const { accessToken, userId } = await registerAndLogin(email);

      const res = await supertest(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBeDefined();

      // Session should now be revoked
      const sessions = await sa
        .select()
        .from(coreSchema.sessions)
        .where(eq(coreSchema.sessions.userId, userId));
      const active = sessions.filter((s) => s.revokedAt === null);
      expect(active).toHaveLength(0);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // OUT-002: no auth header → 401
  it('OUT-002: returns 401 when Authorization header is missing', async () => {
    const res = await supertest(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });

  // OUT-003: logout clears the refresh_token cookie (Set-Cookie: refresh_token=; ...)
  it('OUT-003: response clears the refresh_token cookie', async () => {
    const email = uniqueEmail('out003');
    try {
      const { accessToken, cookieHeader } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      const res = await supertest(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
      // clearCookie sets the token to empty or expiry in the past
      expect(cookieStr).toContain('refresh_token=');
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

describe('POST /api/v1/auth/logout-all', () => {
  // OUT-004: logout-all → 200 + all sessions revoked + authVersion incremented
  it('OUT-004: returns 200 and revokes all sessions + increments authVersion', async () => {
    const email = uniqueEmail('out004');
    try {
      const { accessToken, userId } = await registerAndLogin(email);

      // Get current authVersion before logout-all
      const [userBefore] = await sa
        .select({ authVersion: coreSchema.users.authVersion })
        .from(coreSchema.users)
        .where(eq(coreSchema.users.id, userId))
        .limit(1);
      const versionBefore = userBefore.authVersion;

      const res = await supertest(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBeDefined();

      // All sessions should be revoked
      const sessions = await sa
        .select()
        .from(coreSchema.sessions)
        .where(eq(coreSchema.sessions.userId, userId));
      const active = sessions.filter((s) => s.revokedAt === null);
      expect(active).toHaveLength(0);

      // authVersion should be incremented
      const [userAfter] = await sa
        .select({ authVersion: coreSchema.users.authVersion })
        .from(coreSchema.users)
        .where(eq(coreSchema.users.id, userId))
        .limit(1);
      expect(userAfter.authVersion).toBe(versionBefore + 1);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  // OUT-005: no auth header → 401
  it('OUT-005: returns 401 when Authorization header is missing', async () => {
    const res = await supertest(app).post('/api/v1/auth/logout-all');
    expect(res.status).toBe(401);
  });

  // OUT-006: logout-all clears the refresh_token cookie
  it('OUT-006: response clears the refresh_token cookie after logout-all', async () => {
    const email = uniqueEmail('out006');
    try {
      const { accessToken, cookieHeader } = await registerAndLogin(email);
      const refreshToken = extractRefreshToken(cookieHeader);

      const res = await supertest(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refresh_token=${refreshToken}`]);

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '');
      expect(cookieStr).toContain('refresh_token=');
    } finally {
      await deleteUserByEmail(email);
    }
  });
});

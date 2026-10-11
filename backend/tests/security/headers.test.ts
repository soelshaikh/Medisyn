// Phase 10 — US2: Security header tests (no DB required)

import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';

const app = createApp();
const agent = supertest(app);

describe('Security headers', () => {
  it('SEC-001: X-Frame-Options: DENY is present on all responses', async () => {
    const res = await agent.get('/health');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('SEC-002: X-Content-Type-Options: nosniff is present', async () => {
    const res = await agent.get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('SEC-003: Strict-Transport-Security header is present with min 1-year max-age', async () => {
    const res = await agent.get('/health');
    const hsts = res.headers['strict-transport-security'] as string | undefined;
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('SEC-004: Referrer-Policy header is present', async () => {
    const res = await agent.get('/health');
    const rp = res.headers['referrer-policy'] as string | undefined;
    expect(rp).toBeDefined();
    expect(rp).toContain('strict-origin-when-cross-origin');
  });

  it('SEC-005: 404 route also includes security headers', async () => {
    const res = await agent.get('/api/v1/nonexistent-route-xyz');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('Swagger UI is publicly accessible', () => {
  it('SEC-010: GET /api/docs returns 200', async () => {
    const res = await agent.get('/api/docs');
    expect(res.status).toBe(200);
  });

  it('SEC-011: GET /api/docs/swagger.json returns valid JSON with openapi field', async () => {
    const res = await agent.get('/api/docs/swagger.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('MediSyn API');
  });
});

describe('Body size limit', () => {
  it('SEC-020: returns 413 for JSON body exceeding 1MB', async () => {
    // Generate a ~1.5MB body
    const bigString = 'x'.repeat(1.5 * 1024 * 1024);
    const res = await agent
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: bigString }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

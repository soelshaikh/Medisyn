// Phase 7 — US5: Coupon Management
// Requires: Docker Compose up + db:migrate + db:seed

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections } from '../setup/db';
import { createTestFacility, createAuthedAdminToken } from '../setup/fixtures';

const app = createApp();
const agent = supertest(app);

let facilityId: string;
let token: string;
let cleanupUser: () => Promise<void>;

beforeAll(async () => {
  const facility = await createTestFacility();
  facilityId = facility.id;
  const auth = await createAuthedAdminToken(facilityId);
  token = auth.token;
  cleanupUser = auth.cleanup;
});

afterAll(async () => {
  await cleanupUser();
  await closeTestConnections();
});

// ── CPN-001: Create coupon (FIXED_AMOUNT) ─────────────────────────────────
describe('POST /api/v1/catalogue/coupons', () => {
  it('CPN-001: creates a FIXED_AMOUNT coupon', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code: `SAVE10-${Date.now()}`,
        type: 'FIXED_AMOUNT',
        discountValue: '10.00',
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBeTruthy();
    expect(res.body.data.type).toBe('FIXED_AMOUNT');
    expect(res.body.data.discountValue).toBe('10.00');
    expect(res.body.data.isActive).toBe(true);
  });

  it('CPN-002: code is stored UPPERCASE', async () => {
    const code = `lowercase-${Date.now()}`;
    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, type: 'FIXED_AMOUNT', discountValue: '5.00', isActive: true });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe(code.toUpperCase());
  });

  it('CPN-003: duplicate code returns 409 COUPON_CODE_EXISTS', async () => {
    const code = `DUPCODE-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, type: 'FIXED_AMOUNT', discountValue: '5.00', isActive: true });

    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, type: 'FIXED_AMOUNT', discountValue: '5.00', isActive: true });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COUPON_CODE_EXISTS');
  });

  it('CPN-004: PERCENTAGE with discountValue > 100 returns 422', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code: `PCTBAD-${Date.now()}`, type: 'PERCENTAGE', discountValue: '150', isActive: true });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('CPN-005: maxDiscountAmount on FIXED_AMOUNT returns 422', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code: `BADMAX-${Date.now()}`,
        type: 'FIXED_AMOUNT',
        discountValue: '10.00',
        maxDiscountAmount: '50.00',
        isActive: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('CPN-006: creates a PERCENTAGE coupon with maxDiscountAmount', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code: `PCT20-${Date.now()}`,
        type: 'PERCENTAGE',
        discountValue: '20',
        maxDiscountAmount: '50.00',
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('PERCENTAGE');
    expect(res.body.data.maxDiscountAmount).toBe('50.00');
  });

  it('CPN-007: returns 401 without auth', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons')
      .set('X-Facility-ID', facilityId)
      .send({ code: `NOAUTH-${Date.now()}`, type: 'FIXED_AMOUNT', discountValue: '5.00', isActive: true });

    expect(res.status).toBe(401);
  });
});

// ── CPN-010: Get coupon ────────────────────────────────────────────────────
describe('GET /api/v1/catalogue/coupons/:id', () => {
  it('CPN-010: returns coupon by id', async () => {
    const createRes = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code: `GETME-${Date.now()}`, type: 'FIXED_AMOUNT', discountValue: '3.00', isActive: true });

    const id = createRes.body.data.id;
    const res = await agent
      .get(`/api/v1/catalogue/coupons/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('CPN-011: unknown id returns 404 COUPON_NOT_FOUND', async () => {
    const res = await agent
      .get('/api/v1/catalogue/coupons/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
  });
});

// ── CPN-020: Update coupon ────────────────────────────────────────────────
describe('PATCH /api/v1/catalogue/coupons/:id', () => {
  it('CPN-020: updates minOrderTotal', async () => {
    const createRes = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code: `UPDAT-${Date.now()}`, type: 'FIXED_AMOUNT', discountValue: '5.00', isActive: true });

    const id = createRes.body.data.id;
    const res = await agent
      .patch(`/api/v1/catalogue/coupons/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ minOrderTotal: '25.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.minOrderTotal).toBe('25.00');
  });

  it('CPN-021: unknown id returns 404', async () => {
    const res = await agent
      .patch('/api/v1/catalogue/coupons/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ isActive: false });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
  });
});

// ── CPN-030: Deactivate coupon ────────────────────────────────────────────
describe('DELETE /api/v1/catalogue/coupons/:id', () => {
  it('CPN-030: deactivates (soft-deletes) a coupon', async () => {
    const createRes = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code: `DEACT-${Date.now()}`, type: 'FIXED_AMOUNT', discountValue: '7.00', isActive: true });

    const id = createRes.body.data.id;
    const res = await agent
      .delete(`/api/v1/catalogue/coupons/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(204);

    // Verify it's now inactive
    const check = await agent
      .get(`/api/v1/catalogue/coupons/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);
    expect(check.body.data.isActive).toBe(false);
  });

  it('CPN-031: deleting already-inactive coupon returns 409 COUPON_ALREADY_INACTIVE', async () => {
    const createRes = await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code: `DBLE-${Date.now()}`, type: 'FIXED_AMOUNT', discountValue: '7.00', isActive: false });

    const id = createRes.body.data.id;
    const res = await agent
      .delete(`/api/v1/catalogue/coupons/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COUPON_ALREADY_INACTIVE');
  });
});

// ── CPN-040: List coupons ─────────────────────────────────────────────────
describe('GET /api/v1/catalogue/coupons', () => {
  it('CPN-040: returns paginated list', async () => {
    const res = await agent
      .get('/api/v1/catalogue/coupons?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(0);
  });

  it('CPN-041: active=true filter returns only active coupons', async () => {
    const res = await agent
      .get('/api/v1/catalogue/coupons?active=true')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const allActive = res.body.data.every((c: { isActive: boolean }) => c.isActive === true);
    expect(allActive).toBe(true);
  });
});

// ── CPN-050: Validate coupon ──────────────────────────────────────────────
describe('POST /api/v1/catalogue/coupons/validate', () => {
  it('CPN-050: valid FIXED_AMOUNT coupon returns effectiveDiscount', async () => {
    const code = `VALFIX-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, type: 'FIXED_AMOUNT', discountValue: '10.00', isActive: true });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '50.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.effectiveDiscount).toBe('10.00');
    expect(res.body.data.type).toBe('FIXED_AMOUNT');
  });

  it('CPN-051: PERCENTAGE coupon applies percentage correctly', async () => {
    const code = `VALPCT-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, type: 'PERCENTAGE', discountValue: '20', isActive: true });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '100.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.effectiveDiscount).toBe('20.00');
  });

  it('CPN-052: PERCENTAGE coupon is capped by maxDiscountAmount', async () => {
    const code = `VALCAP-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code,
        type: 'PERCENTAGE',
        discountValue: '50',
        maxDiscountAmount: '20.00',
        isActive: true,
      });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '200.00' });

    // 50% of 200 = 100, capped at 20
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.effectiveDiscount).toBe('20.00');
  });

  it('CPN-053: inactive coupon returns valid=false reason=INACTIVE', async () => {
    const code = `VALINACT-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, type: 'FIXED_AMOUNT', discountValue: '5.00', isActive: false });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '50.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toBe('INACTIVE');
  });

  it('CPN-054: unknown code returns valid=false reason=INVALID_CODE', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code: 'DOESNOTEXIST', orderTotal: '50.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toBe('INVALID_CODE');
  });

  it('CPN-055: orderTotal below minOrderTotal returns valid=false reason=MINIMUM_NOT_MET', async () => {
    const code = `VALMIN-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code,
        type: 'FIXED_AMOUNT',
        discountValue: '10.00',
        minOrderTotal: '50.00',
        isActive: true,
      });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '30.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toBe('MINIMUM_NOT_MET');
  });

  it('CPN-056: expired coupon (endsAt in the past) returns valid=false reason=EXPIRED', async () => {
    const code = `VALEXP-${Date.now()}`;
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // yesterday

    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code,
        type: 'FIXED_AMOUNT',
        discountValue: '5.00',
        endsAt: pastDate,
        isActive: true,
      });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '50.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toBe('EXPIRED');
  });

  it('CPN-057: validate response MUST NOT contain internalNotes', async () => {
    const code = `SECNOTES-${Date.now()}`;
    await agent
      .post('/api/v1/catalogue/coupons')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        code,
        type: 'FIXED_AMOUNT',
        discountValue: '5.00',
        isActive: true,
        internalNotes: 'SECRET internal note',
      });

    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ code, orderTotal: '50.00' });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.internalNotes).toBeUndefined();
    // Walk the entire response body to confirm no field named internalNotes
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('internalNotes');
    expect(body).not.toContain('SECRET internal note');
  });

  it('CPN-058: returns 401 without auth', async () => {
    const res = await agent
      .post('/api/v1/catalogue/coupons/validate')
      .set('X-Facility-ID', facilityId)
      .send({ code: 'ANY', orderTotal: '50.00' });

    expect(res.status).toBe(401);
  });
});

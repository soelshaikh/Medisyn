// Phase 10 — US4: Prescription submission integration tests
// Requires: Docker Compose up + db:migrate + db:seed:facilities

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections } from '../setup/db';
import {
  createTestFacility,
  createAuthedAdminToken,
} from '../setup/fixtures';

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

describe('POST /api/v1/prescriptions', () => {
  // RX-001: authenticated user submits prescription → 201 with id + status
  it('RX-001: returns 201 with id and status=submitted on valid request', async () => {
    const res = await agent
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        type: 'refill',
        medicationName: 'Lisinopril 10mg',
        dosage: '1 tablet daily',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.status).toBe('submitted');
  });

  // RX-002: no auth → 401
  it('RX-002: returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
    const res = await agent
      .post('/api/v1/prescriptions')
      .set('X-Facility-ID', facilityId)
      .send({ type: 'refill', medicationName: 'Test Med' });

    expect(res.status).toBe(401);
  });

  // RX-003: missing required field → 422
  it('RX-003: returns 422 VALIDATION_ERROR when medicationName is missing', async () => {
    const res = await agent
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ type: 'refill' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // RX-004: invalid type → 422
  it('RX-004: returns 422 VALIDATION_ERROR for invalid prescription type', async () => {
    const res = await agent
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ type: 'invalid_type', medicationName: 'Test Med' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/prescriptions', () => {
  it('RX-010: returns 200 with data array for authenticated patient', async () => {
    const res = await agent
      .get('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('RX-011: returns 401 without auth header', async () => {
    const res = await agent
      .get('/api/v1/prescriptions')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(401);
  });
});

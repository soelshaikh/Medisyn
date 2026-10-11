// Phase 10 — US4: Appointment booking integration tests
// Requires: Docker Compose up + db:migrate + db:seed:facilities

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections } from '../setup/db';
import {
  createTestFacility,
  createAuthedAdminToken,
} from '../setup/fixtures';
import {
  createTestVaccineService,
  createTestAvailabilitySlot,
  deleteTestAppointmentsByFacility,
  deleteTestAvailabilitySlotsByFacility,
  deleteTestVaccineServicesByFacility,
} from '../setup/appointment-fixtures';

const app = createApp();
const agent = supertest(app);

let facilityId: string;
let token: string;
let cleanupUser: () => Promise<void>;
let slotId: string;

beforeAll(async () => {
  const facility = await createTestFacility();
  facilityId = facility.id;

  const auth = await createAuthedAdminToken(facilityId);
  token = auth.token;
  cleanupUser = auth.cleanup;

  const service = await createTestVaccineService(facilityId, { name: 'Flu Shot' });
  const slot = await createTestAvailabilitySlot(facilityId, service.id, { capacity: 5, bookedCount: 0 });
  slotId = slot.id;
});

afterAll(async () => {
  await deleteTestAppointmentsByFacility(facilityId);
  await deleteTestAvailabilitySlotsByFacility(facilityId);
  await deleteTestVaccineServicesByFacility(facilityId);
  await cleanupUser();
  await closeTestConnections();
});

describe('POST /api/v1/appointments', () => {
  // APPT-001: book appointment with available slot → 201
  it('APPT-001: returns 201 with id and status=scheduled on valid booking', async () => {
    const res = await agent
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ slotId });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.slotId).toBe(slotId);
  });

  // APPT-002: no auth → 401
  it('APPT-002: returns 401 UNAUTHORIZED without auth header', async () => {
    const res = await agent
      .post('/api/v1/appointments')
      .set('X-Facility-ID', facilityId)
      .send({ slotId });

    expect(res.status).toBe(401);
  });

  // APPT-003: missing slotId → 422
  it('APPT-003: returns 422 VALIDATION_ERROR when slotId is missing', async () => {
    const res = await agent
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // APPT-004: invalid slotId format → 422
  it('APPT-004: returns 422 for non-UUID slotId', async () => {
    const res = await agent
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ slotId: 'not-a-uuid' });

    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/appointments', () => {
  it('APPT-010: returns 200 with data array for authenticated patient', async () => {
    const res = await agent
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});

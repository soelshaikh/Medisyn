// Phase 6 — US4: Inventory Management
// Requires: Docker Compose up + db:migrate + db:seed

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections } from '../setup/db';
import { createTestFacility, createAuthedAdminToken } from '../setup/fixtures';
import { createTestProduct, createTestVariant, setInventoryQuantity } from '../setup/catalogue-fixtures';

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

// ── INV-001: Adjust inventory ─────────────────────────────────────────────
describe('POST /api/v1/catalogue/inventory/products/:productId/adjust', () => {
  it('INV-001: RESTOCK +20 → resultingBalance=20', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-P1-${Date.now()}` });

    const res = await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: 20, reason: 'RESTOCK' });

    expect(res.status).toBe(200);
    expect(res.body.data.resultingBalance).toBe(20);
    expect(res.body.data.quantityDelta).toBe(20);
    expect(res.body.data.reason).toBe('RESTOCK');
    expect(res.body.data.actorId).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('INV-002: RESTOCK, then WRITE_OFF -5 → resultingBalance=15', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-P2-${Date.now()}` });
    await setInventoryQuantity(product.inventoryRecordId, 20);

    const res = await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: -5, reason: 'WRITE_OFF', note: 'Damaged in storage' });

    expect(res.status).toBe(200);
    expect(res.body.data.resultingBalance).toBe(15);
    expect(res.body.data.note).toBe('Damaged in storage');
  });

  it('INV-003: returns 409 INSUFFICIENT_STOCK when delta exceeds stock', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-P3-${Date.now()}` });
    await setInventoryQuantity(product.inventoryRecordId, 5);

    const res = await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: -999, reason: 'MANUAL_ADJUSTMENT' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('INV-004: returns 422 for zero quantityDelta', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-P4-${Date.now()}` });

    const res = await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: 0, reason: 'RESTOCK' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('INV-005: adjusts variant inventory correctly', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `INV-P5-${Date.now()}`,
      variantDimensionLabel: 'Size',
    });
    const variant = await createTestVariant(product.id, facilityId, {
      sku: `INV-V5-${Date.now()}`,
    });

    const res = await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ variantId: variant.id, quantityDelta: 10, reason: 'RESTOCK' });

    expect(res.status).toBe(200);
    expect(res.body.data.variantId).toBe(variant.id);
    expect(res.body.data.resultingBalance).toBe(10);
  });

  it('INV-006: returns 401 without Authorization', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-NOAUTH-${Date.now()}` });

    const res = await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: 5, reason: 'RESTOCK' });

    expect(res.status).toBe(401);
  });
});

// ── INV-010: Get inventory status ─────────────────────────────────────────
describe('GET /api/v1/catalogue/inventory/products/:productId', () => {
  it('INV-010: returns inventory record for product', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-GET-${Date.now()}` });
    await setInventoryQuantity(product.inventoryRecordId, 42);

    const res = await agent
      .get(`/api/v1/catalogue/inventory/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const record = res.body.data.find((r: { variantId: string | null }) => r.variantId === null);
    expect(record).toBeDefined();
    expect(record.quantity).toBe(42);
  });
});

// ── INV-020: Inventory history ────────────────────────────────────────────
describe('GET /api/v1/catalogue/inventory/products/:productId/history', () => {
  it('INV-020: returns transaction history in reverse-chronological order', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-HIST-${Date.now()}` });

    // Make two adjustments
    await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: 10, reason: 'RESTOCK' });

    await agent
      .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ quantityDelta: -3, reason: 'DAMAGED' });

    const res = await agent
      .get(`/api/v1/catalogue/inventory/products/${product.id}/history`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);

    // Most recent first
    const first = new Date(res.body.data[0].createdAt).getTime();
    const second = new Date(res.body.data[1].createdAt).getTime();
    expect(first).toBeGreaterThanOrEqual(second);

    // Each record has required fields
    const record = res.body.data[0];
    expect(record.quantityDelta).toBeDefined();
    expect(record.resultingBalance).toBeDefined();
    expect(record.reason).toBeDefined();
    expect(record.createdAt).toBeDefined();
  });
});

// ── INV-030: Low-stock report ─────────────────────────────────────────────
describe('GET /api/v1/catalogue/inventory/low-stock', () => {
  it('INV-030: returns product with quantity <= lowStockThreshold', async () => {
    const sku = `INV-LOWSTK-${Date.now()}`;
    const product = await createTestProduct(facilityId, {
      sku,
      lowStockThreshold: 10,
    });
    await setInventoryQuantity(product.inventoryRecordId, 3);

    const res = await agent
      .get('/api/v1/catalogue/inventory/low-stock')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const found = res.body.data.find((r: { productId: string }) => r.productId === product.id);
    expect(found).toBeDefined();
    expect(found.quantity).toBe(3);
    expect(found.lowStockThreshold).toBe(10);
  });
});

// ── INV-040: Concurrency safety ───────────────────────────────────────────
describe('Concurrency: SELECT FOR UPDATE prevents lost updates', () => {
  it('INV-040: 10 concurrent +1 adjustments result in balance=10', async () => {
    const product = await createTestProduct(facilityId, { sku: `INV-CONC-${Date.now()}` });
    await setInventoryQuantity(product.inventoryRecordId, 0);

    const adjust = () =>
      agent
        .post(`/api/v1/catalogue/inventory/products/${product.id}/adjust`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Facility-ID', facilityId)
        .send({ quantityDelta: 1, reason: 'RESTOCK' });

    const results = await Promise.all(Array.from({ length: 10 }, adjust));
    const allOk = results.every((r) => r.status === 200);
    expect(allOk).toBe(true);

    // Final balance should be exactly 10 (no lost updates)
    const finalRes = await agent
      .get(`/api/v1/catalogue/inventory/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    const record = finalRes.body.data.find((r: { variantId: string | null }) => r.variantId === null);
    expect(record.quantity).toBe(10);
  }, 15000); // allow 15s for 10 concurrent requests
});

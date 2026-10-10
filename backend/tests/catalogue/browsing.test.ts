// Phase 5 — US1: Product Catalogue Browsing
// Requires: Docker Compose up + db:migrate + db:seed

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections } from '../setup/db';
import { createTestFacility } from '../setup/fixtures';
import {
  createTestProduct,
  createTestCategory,
  setInventoryQuantity,
} from '../setup/catalogue-fixtures';

const app = createApp();
const agent = supertest(app);

let facilityId: string;

beforeAll(async () => {
  const facility = await createTestFacility();
  facilityId = facility.id;
});

afterAll(async () => {
  await closeTestConnections();
});

// ── BRW-001: List products ────────────────────────────────────────────────
describe('GET /api/v1/catalogue/products', () => {
  it('BRW-001: returns paginated list of active products', async () => {
    await createTestProduct(facilityId, { sku: `BRW-P1-${Date.now()}`, name: 'Omega 3' });
    await createTestProduct(facilityId, { sku: `BRW-P2-${Date.now()}`, name: 'Zinc' });

    const res = await agent
      .get('/api/v1/catalogue/products')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
    expect(typeof res.body.pagination.total).toBe('number');

    // Each item should have stockStatus
    const item = res.body.data[0];
    expect(item.id).toBeDefined();
    expect(item.stockStatus).toMatch(/^(in_stock|out_of_stock|low_stock)$/);
  });

  it('BRW-002: does NOT include inactive products', async () => {
    const inactiveSku = `BRW-INACT-${Date.now()}`;
    await createTestProduct(facilityId, { sku: inactiveSku, isActive: false });

    const res = await agent
      .get('/api/v1/catalogue/products')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { sku: string }) => p.sku === inactiveSku);
    expect(found).toBeUndefined();
  });

  it('BRW-003: filters by category_id including subcategory products', async () => {
    const root = await createTestCategory(facilityId, { name: `Root-${Date.now()}` });
    const sub = await createTestCategory(facilityId, {
      name: `Sub-${Date.now()}`,
      parentId: root.id,
    });
    const sku = `BRW-CATFIL-${Date.now()}`;
    await createTestProduct(facilityId, { sku, categoryId: sub.id });

    const res = await agent
      .get(`/api/v1/catalogue/products?category_id=${root.id}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { sku: string }) => p.sku === sku);
    expect(found).toBeDefined();
  });

  it('BRW-004: filters by search keyword using ILIKE', async () => {
    const uniqueTerm = `UniqueVitaminXYZ${Date.now()}`;
    const sku = `BRW-SRCH-${Date.now()}`;
    await createTestProduct(facilityId, { sku, name: uniqueTerm });

    const res = await agent
      .get(`/api/v1/catalogue/products?search=${uniqueTerm.toLowerCase()}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { sku: string }) => p.sku === sku);
    expect(found).toBeDefined();
  });

  it('BRW-005: filters by price_min and price_max', async () => {
    const cheapSku = `BRW-CHEAP-${Date.now()}`;
    const expensiveSku = `BRW-EXP-${Date.now()}`;
    await createTestProduct(facilityId, { sku: cheapSku, price: '5.00' });
    await createTestProduct(facilityId, { sku: expensiveSku, price: '200.00' });

    const res = await agent
      .get('/api/v1/catalogue/products?price_min=10&price_max=100')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const cheap = res.body.data.find((p: { sku: string }) => p.sku === cheapSku);
    const expensive = res.body.data.find((p: { sku: string }) => p.sku === expensiveSku);
    expect(cheap).toBeUndefined();
    expect(expensive).toBeUndefined();
  });

  it('BRW-006: filters in_stock=true — excludes out-of-stock products', async () => {
    const sku = `BRW-OOS-${Date.now()}`;
    await createTestProduct(facilityId, { sku }); // quantity defaults to 0

    const res = await agent
      .get('/api/v1/catalogue/products?in_stock=true')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { sku: string }) => p.sku === sku);
    expect(found).toBeUndefined();
  });

  it('BRW-007: in_stock=true includes product with inventory > 0', async () => {
    const sku = `BRW-INSTOCK-${Date.now()}`;
    const product = await createTestProduct(facilityId, { sku });
    await setInventoryQuantity(product.inventoryRecordId, 10);

    const res = await agent
      .get('/api/v1/catalogue/products?in_stock=true')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    const found = res.body.data.find((p: { sku: string }) => p.sku === sku);
    expect(found).toBeDefined();
  });

  it('BRW-008: returns 400 MISSING_FACILITY_ID without header', async () => {
    const res = await agent.get('/api/v1/catalogue/products');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FACILITY_ID');
  });

  it('BRW-009: pagination works — page 2 has different items', async () => {
    // Create 3 products to ensure we can test pagination
    for (let i = 0; i < 3; i++) {
      await createTestProduct(facilityId, { sku: `BRW-PAG-${Date.now()}-${i}` });
    }

    const page1 = await agent
      .get('/api/v1/catalogue/products?page=1&limit=2')
      .set('X-Facility-ID', facilityId);
    const page2 = await agent
      .get('/api/v1/catalogue/products?page=2&limit=2')
      .set('X-Facility-ID', facilityId);

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.pagination.page).toBe(1);
    expect(page2.body.pagination.page).toBe(2);
    // Items should not overlap
    const ids1 = new Set(page1.body.data.map((p: { id: string }) => p.id));
    for (const item of page2.body.data) {
      expect(ids1.has(item.id)).toBe(false);
    }
  });
});

// ── BRW-010: Product detail ───────────────────────────────────────────────
describe('GET /api/v1/catalogue/products/:id', () => {
  it('BRW-010: returns full detail with stockStatus and quantity', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `BRW-DET-${Date.now()}`,
      name: 'Detail Product',
    });
    await setInventoryQuantity(product.inventoryRecordId, 15);

    const res = await agent
      .get(`/api/v1/catalogue/products/${product.id}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product.id);
    expect(res.body.data.quantity).toBe(15);
    expect(res.body.data.stockStatus).toBe('in_stock');
    expect(res.body.data.variants).toEqual([]);
  });

  it('BRW-011: stockStatus is low_stock when quantity <= lowStockThreshold', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `BRW-LOW-${Date.now()}`,
      lowStockThreshold: 10,
    });
    await setInventoryQuantity(product.inventoryRecordId, 3);

    const res = await agent
      .get(`/api/v1/catalogue/products/${product.id}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.stockStatus).toBe('low_stock');
    expect(res.body.data.quantity).toBe(3);
  });

  it('BRW-012: returns 404 for unknown product id', async () => {
    const res = await agent
      .get('/api/v1/catalogue/products/00000000-0000-0000-0000-000000000000')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

// ── BRW-020: Performance gate (T042) ─────────────────────────────────────
describe('Performance gate', () => {
  it('BRW-020: GET /products responds under 1000ms', async () => {
    const start = performance.now();
    const res = await agent
      .get('/api/v1/catalogue/products')
      .set('X-Facility-ID', facilityId);
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });
});

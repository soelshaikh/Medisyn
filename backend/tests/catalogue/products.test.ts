// Phase 3 — US2: Product Management
// Requires: Docker Compose up + db:migrate + db:seed + db:seed:facilities

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections } from '../setup/db';
import {
  createTestFacility,
  createAuthedAdminToken,
} from '../setup/fixtures';
import {
  createTestProduct,
  createTestVariant,
} from '../setup/catalogue-fixtures';

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

// ── PRD-001: Create product ───────────────────────────────────────────────
describe('POST /api/v1/catalogue/products', () => {
  it('PRD-001: creates a product and returns 201 with id, sku, slug', async () => {
    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        sku: `TEST-SKU-${Date.now()}`,
        name: 'Vitamin C 500mg',
        price: '12.99',
        description: 'High quality vitamin C',
        isFeatured: false,
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.sku).toBeDefined();
    expect(res.body.data.slug).toBe('vitamin-c-500mg');
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('PRD-002: returns 409 SKU_CONFLICT when SKU already exists', async () => {
    const sku = `CONFLICT-SKU-${Date.now()}`;
    await createTestProduct(facilityId, { sku });

    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku, name: 'Another Product', price: '5.99' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SKU_CONFLICT');
  });

  it('PRD-003: returns 409 SLUG_CONFLICT when explicit slug already exists', async () => {
    const existingSlug = `existing-slug-${Date.now()}`;
    await createTestProduct(facilityId, { sku: `PRE-SKU-${Date.now()}`, name: 'Pre-existing' });

    // Create a product with that slug first
    await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku: `SLUG-SKU1-${Date.now()}`, name: 'First', price: '9.99', slug: existingSlug });

    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku: `SLUG-SKU2-${Date.now()}`, name: 'Second', price: '9.99', slug: existingSlug });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_CONFLICT');
  });

  it('PRD-004: returns 422 VALIDATION_ERROR for missing required fields', async () => {
    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'Missing SKU and price' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PRD-005: returns 422 when variants provided without variantDimensionLabel', async () => {
    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        sku: `NOVLABEL-${Date.now()}`,
        name: 'No Label',
        price: '9.99',
        variants: [{ sku: 'V1', dimensionValue: '100mg', price: '9.99' }],
      });

    expect(res.status).toBe(422);
  });

  it('PRD-006: creates product with variants successfully', async () => {
    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        sku: `WITH-VAR-${Date.now()}`,
        name: 'Product With Variants',
        price: '9.99',
        variantDimensionLabel: 'Strength',
        variants: [
          { sku: `VSKU-A-${Date.now()}`, dimensionValue: '100mg', price: '9.99' },
          { sku: `VSKU-B-${Date.now()}`, dimensionValue: '200mg', price: '14.99' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  it('PRD-007: returns 401 without Authorization header', async () => {
    const res = await agent
      .post('/api/v1/catalogue/products')
      .set('X-Facility-ID', facilityId)
      .send({ sku: 'NO-AUTH', name: 'No Auth', price: '9.99' });

    expect(res.status).toBe(401);
  });
});

// ── PRD-010: Update product ───────────────────────────────────────────────
describe('PATCH /api/v1/catalogue/products/:id', () => {
  it('PRD-010: updates a product and returns 200 with updatedAt', async () => {
    const product = await createTestProduct(facilityId, { sku: `UPDATE-SKU-${Date.now()}` });

    const res = await agent
      .patch(`/api/v1/catalogue/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'Updated Name', isFeatured: true });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product.id);
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('PRD-011: returns 404 PRODUCT_NOT_FOUND for unknown id', async () => {
    const res = await agent
      .patch('/api/v1/catalogue/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('PRD-012: returns 409 SKU_CONFLICT when updating to an existing SKU', async () => {
    const sku1 = `SKU-EXIST-${Date.now()}`;
    const sku2 = `SKU-MOVE-${Date.now()}`;
    await createTestProduct(facilityId, { sku: sku1 });
    const product2 = await createTestProduct(facilityId, { sku: sku2 });

    const res = await agent
      .patch(`/api/v1/catalogue/products/${product2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku: sku1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SKU_CONFLICT');
  });
});

// ── PRD-020: Deactivate product ───────────────────────────────────────────
describe('DELETE /api/v1/catalogue/products/:id', () => {
  it('PRD-020: deactivates a product and returns isActive: false', async () => {
    const product = await createTestProduct(facilityId, { sku: `DEAC-${Date.now()}` });

    const res = await agent
      .delete(`/api/v1/catalogue/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.id).toBe(product.id);
  });

  it('PRD-021: returns 409 PRODUCT_ALREADY_INACTIVE on double deactivate', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `DEAC2-${Date.now()}`,
      isActive: false,
    });

    const res = await agent
      .delete(`/api/v1/catalogue/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCT_ALREADY_INACTIVE');
  });
});

// ── PRD-030: Add variant ──────────────────────────────────────────────────
describe('POST /api/v1/catalogue/products/:id/variants', () => {
  it('PRD-030: adds a variant and returns 201 with variant id', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `VAR-PROD-${Date.now()}`,
      variantDimensionLabel: 'Size',
    });

    const res = await agent
      .post(`/api/v1/catalogue/products/${product.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku: `NEW-VAR-${Date.now()}`, dimensionValue: 'Large', price: '19.99' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.sku).toBeDefined();
    expect(res.body.data.dimensionValue).toBe('Large');
  });

  it('PRD-031: returns 422 when product has no variantDimensionLabel', async () => {
    const product = await createTestProduct(facilityId, { sku: `NOVAR-${Date.now()}` });

    const res = await agent
      .post(`/api/v1/catalogue/products/${product.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku: `NV-${Date.now()}`, dimensionValue: 'Small', price: '9.99' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VARIANT_DIMENSION_REQUIRED');
  });

  it('PRD-032: returns 409 VARIANT_SKU_CONFLICT on duplicate variant SKU', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `VAR-DUP-${Date.now()}`,
      variantDimensionLabel: 'Size',
    });
    const dupSku = `DUP-VSKU-${Date.now()}`;
    await createTestVariant(product.id, facilityId, { sku: dupSku });

    const res = await agent
      .post(`/api/v1/catalogue/products/${product.id}/variants`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ sku: dupSku, dimensionValue: 'Medium', price: '12.99' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VARIANT_SKU_CONFLICT');
  });
});

// ── PRD-040: Update variant ───────────────────────────────────────────────
describe('PATCH /api/v1/catalogue/products/:id/variants/:variantId', () => {
  it('PRD-040: updates a variant and returns 200', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `UPVAR-PROD-${Date.now()}`,
      variantDimensionLabel: 'Strength',
    });
    const variant = await createTestVariant(product.id, facilityId, {
      sku: `UPVAR-${Date.now()}`,
    });

    const res = await agent
      .patch(`/api/v1/catalogue/products/${product.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ price: '24.99' });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(variant.id);
  });

  it('PRD-041: returns 404 when variantId does not belong to productId', async () => {
    const product1 = await createTestProduct(facilityId, {
      sku: `P1-${Date.now()}`,
      variantDimensionLabel: 'Strength',
    });
    const product2 = await createTestProduct(facilityId, {
      sku: `P2-${Date.now()}`,
      variantDimensionLabel: 'Strength',
    });
    const variant = await createTestVariant(product1.id, facilityId, { sku: `V-WRONG-${Date.now()}` });

    const res = await agent
      .patch(`/api/v1/catalogue/products/${product2.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ price: '99.99' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VARIANT_NOT_FOUND');
  });
});

// ── PRD-050: Deactivate variant ───────────────────────────────────────────
describe('DELETE /api/v1/catalogue/products/:id/variants/:variantId', () => {
  it('PRD-050: deactivates a variant and returns isActive: false', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `DEACVAR-PROD-${Date.now()}`,
      variantDimensionLabel: 'Strength',
    });
    const variant = await createTestVariant(product.id, facilityId, {
      sku: `DEACVAR-${Date.now()}`,
    });

    const res = await agent
      .delete(`/api/v1/catalogue/products/${product.id}/variants/${variant.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });
});

// ── PRD-060: Get product detail ───────────────────────────────────────────
describe('GET /api/v1/catalogue/products/:id', () => {
  it('PRD-060: returns product detail with stock status', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `GET-PROD-${Date.now()}`,
      name: 'Get Me',
    });

    const res = await agent
      .get(`/api/v1/catalogue/products/${product.id}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(product.id);
    expect(res.body.data.sku).toBe(product.sku);
    expect(res.body.data.stockStatus).toBe('out_of_stock');
    expect(res.body.data.quantity).toBe(0);
  });

  it('PRD-061: returns 404 for inactive product on public endpoint', async () => {
    const product = await createTestProduct(facilityId, {
      sku: `INACT-${Date.now()}`,
      isActive: false,
    });

    const res = await agent
      .get(`/api/v1/catalogue/products/${product.id}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('PRD-062: returns 400 MISSING_FACILITY_ID without header', async () => {
    const product = await createTestProduct(facilityId, { sku: `NOFAC-${Date.now()}` });

    const res = await agent.get(`/api/v1/catalogue/products/${product.id}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FACILITY_ID');
  });
});

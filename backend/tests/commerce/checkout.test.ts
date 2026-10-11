// Phase 10 — US4: Checkout integration tests
// Requires: Docker Compose up + db:migrate + db:seed:facilities

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { closeTestConnections, getSuperAdminTestDb } from '../setup/db';
import {
  createTestFacility,
  createAuthedAdminToken,
} from '../setup/fixtures';
import {
  createTestShippingMethod,
  createTestAuthCart,
  deleteTestOrdersByFacility,
  deleteTestCartsByFacility,
  deleteTestShippingMethodsByFacility,
} from '../setup/commerce-fixtures';
import {
  createTestProduct,
  setInventoryQuantity,
} from '../setup/catalogue-fixtures';
import * as commerceSchema from '@/db/schema/commerce';

const app = createApp();
const agent = supertest(app);

let facilityId: string;
let token: string;
let userId: string;
let cleanupUser: () => Promise<void>;
let shippingMethodId: string;

const shippingAddress = {
  street: '123 Test St',
  city: 'Toronto',
  province: 'ON',
  postalCode: 'M5H 2N2',
  country: 'CA' as const,
};

beforeAll(async () => {
  const facility = await createTestFacility();
  facilityId = facility.id;

  const auth = await createAuthedAdminToken(facilityId);
  token = auth.token;
  userId = auth.userId;
  cleanupUser = auth.cleanup;

  const method = await createTestShippingMethod(facilityId);
  shippingMethodId = method.id;

  // Create a product with inventory
  const product = await createTestProduct(facilityId, { sku: `CHK-${Date.now()}`, price: '25.00' });
  await setInventoryQuantity(product.inventoryRecordId, 10);

  // Create an authenticated cart with one item
  const cart = await createTestAuthCart(facilityId, userId);
  const sa = getSuperAdminTestDb();
  await sa.insert(commerceSchema.cartItems).values({
    cartId: cart.id,
    facilityId,
    productId: product.id,
    variantId: null,
    quantity: 1,
    unitPrice: '25.00',
    productSnapshot: { name: product.name, sku: product.sku },
  });
});

afterAll(async () => {
  await deleteTestOrdersByFacility(facilityId);
  await deleteTestCartsByFacility(facilityId);
  await deleteTestShippingMethodsByFacility(facilityId);
  await cleanupUser();
  await closeTestConnections();
});

describe('POST /api/v1/checkout/preview', () => {
  it('CHK-001: returns 200 with previewToken and totals for valid cart', async () => {
    const res = await agent
      .post('/api/v1/checkout/preview')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ shippingAddress, shippingMethodId });

    expect(res.status).toBe(200);
    expect(res.body.data.previewToken).toBeDefined();
    expect(typeof res.body.data.previewToken).toBe('string');
    expect(res.body.data.subtotal).toBeDefined();
    expect(res.body.data.total).toBeDefined();
  });

  it('CHK-002: returns 401 without auth header', async () => {
    const res = await agent
      .post('/api/v1/checkout/preview')
      .set('X-Facility-ID', facilityId)
      .send({ shippingAddress, shippingMethodId });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/checkout/place', () => {
  it('CHK-010: places order and returns 201 with orderId and status=pending', async () => {
    // Step 1: get a preview token
    const previewRes = await agent
      .post('/api/v1/checkout/preview')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ shippingAddress, shippingMethodId });

    expect(previewRes.status).toBe(200);
    const { previewToken } = previewRes.body.data as { previewToken: string };

    // Step 2: place order
    const res = await agent
      .post('/api/v1/checkout/place')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ previewToken, shippingAddress, shippingMethodId });

    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBeDefined();
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.total).toBeDefined();
  });

  it('CHK-011: returns 422 with invalid previewToken', async () => {
    const res = await agent
      .post('/api/v1/checkout/place')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ previewToken: 'invalid-token', shippingAddress, shippingMethodId });

    expect(res.status).toBe(422);
  });

  it('CHK-012: returns 401 without auth header', async () => {
    const res = await agent
      .post('/api/v1/checkout/place')
      .set('X-Facility-ID', facilityId)
      .send({ previewToken: 'some-token', shippingAddress, shippingMethodId });

    expect(res.status).toBe(401);
  });
});

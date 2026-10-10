// Phase 4 — US3: Category Management
// Requires: Docker Compose up + db:migrate + db:seed

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { getSuperAdminTestDb, closeTestConnections } from '../setup/db';
import { createTestFacility, createAuthedAdminToken } from '../setup/fixtures';
import { createTestProduct, createTestCategory } from '../setup/catalogue-fixtures';
import * as catalogueSchema from '@/db/schema/catalogue';
import { eq } from 'drizzle-orm';

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

// ── CAT-001: Create root category ─────────────────────────────────────────
describe('POST /api/v1/catalogue/categories', () => {
  it('CAT-001: creates root category with auto-generated slug', async () => {
    const res = await agent
      .post('/api/v1/catalogue/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'Vitamins & Supplements', displayOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.slug).toBe('vitamins-supplements');
    expect(res.body.data.name).toBe('Vitamins & Supplements');
  });

  it('CAT-002: creates subcategory with parentId', async () => {
    const parent = await createTestCategory(facilityId, { name: 'Parent Cat' });

    const res = await agent
      .post('/api/v1/catalogue/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'Child Category', parentId: parent.id });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();

    // Verify parent-child relationship in DB
    const sa = getSuperAdminTestDb();
    const [child] = await sa
      .select({ parentId: catalogueSchema.categories.parentId })
      .from(catalogueSchema.categories)
      .where(eq(catalogueSchema.categories.id, res.body.data.id))
      .limit(1);
    expect(child.parentId).toBe(parent.id);
  });

  it('CAT-003: returns 404 PARENT_NOT_FOUND for invalid parentId', async () => {
    const res = await agent
      .post('/api/v1/catalogue/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({
        name: 'Orphan',
        parentId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PARENT_NOT_FOUND');
  });

  it('CAT-004: returns 422 for missing required name', async () => {
    const res = await agent
      .post('/api/v1/catalogue/categories')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ displayOrder: 1 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('CAT-005: returns 401 without Authorization', async () => {
    const res = await agent
      .post('/api/v1/catalogue/categories')
      .set('X-Facility-ID', facilityId)
      .send({ name: 'No Auth' });

    expect(res.status).toBe(401);
  });
});

// ── CAT-010: Update category ──────────────────────────────────────────────
describe('PATCH /api/v1/catalogue/categories/:id', () => {
  it('CAT-010: updates name and returns 200', async () => {
    const cat = await createTestCategory(facilityId, { name: 'Old Name' });

    const res = await agent
      .patch(`/api/v1/catalogue/categories/${cat.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'New Name', displayOrder: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(cat.id);
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('CAT-011: returns 409 CYCLE_DETECTED when parentId creates a cycle', async () => {
    // grandparent → parent → child; then try to set grandparent.parentId = child
    const grandparent = await createTestCategory(facilityId, { name: `GP-${Date.now()}` });
    const parent = await createTestCategory(facilityId, {
      name: `Par-${Date.now()}`,
      parentId: grandparent.id,
    });
    const child = await createTestCategory(facilityId, {
      name: `Child-${Date.now()}`,
      parentId: parent.id,
    });

    // Attempting to set grandparent's parent to child would create a cycle
    const res = await agent
      .patch(`/api/v1/catalogue/categories/${grandparent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ parentId: child.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CYCLE_DETECTED');
  });

  it('CAT-012: returns 404 CATEGORY_NOT_FOUND for unknown id', async () => {
    const res = await agent
      .patch('/api/v1/catalogue/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });
});

// ── CAT-020: Deactivate category ──────────────────────────────────────────
describe('DELETE /api/v1/catalogue/categories/:id', () => {
  it('CAT-020: deactivates a leaf category and returns isActive: false', async () => {
    const cat = await createTestCategory(facilityId, { name: `Leaf-${Date.now()}` });

    const res = await agent
      .delete(`/api/v1/catalogue/categories/${cat.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('CAT-021: returns 409 CATEGORY_HAS_ACTIVE_CHILDREN if has subcategories', async () => {
    const parent = await createTestCategory(facilityId, { name: `HasChild-${Date.now()}` });
    await createTestCategory(facilityId, {
      name: `ActiveChild-${Date.now()}`,
      parentId: parent.id,
    });

    const res = await agent
      .delete(`/api/v1/catalogue/categories/${parent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_HAS_ACTIVE_CHILDREN');
  });

  it('CAT-022: deactivating category does NOT deactivate assigned products', async () => {
    const cat = await createTestCategory(facilityId, { name: `CatForProd-${Date.now()}` });
    const product = await createTestProduct(facilityId, {
      sku: `CATPROD-${Date.now()}`,
      categoryId: cat.id,
    });

    await agent
      .delete(`/api/v1/catalogue/categories/${cat.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Facility-ID', facilityId);

    // Product should still be active
    const sa = getSuperAdminTestDb();
    const [prod] = await sa
      .select({ isActive: catalogueSchema.products.isActive })
      .from(catalogueSchema.products)
      .where(eq(catalogueSchema.products.id, product.id))
      .limit(1);
    expect(prod.isActive).toBe(true);
  });
});

// ── CAT-030: Get category tree ────────────────────────────────────────────
describe('GET /api/v1/catalogue/categories', () => {
  it('CAT-030: returns tree with children nested', async () => {
    const root = await createTestCategory(facilityId, { name: `Tree-Root-${Date.now()}` });
    const child1 = await createTestCategory(facilityId, {
      name: `Tree-Child1-${Date.now()}`,
      parentId: root.id,
    });
    await createTestCategory(facilityId, {
      name: `Tree-Child2-${Date.now()}`,
      parentId: root.id,
    });

    const res = await agent
      .get('/api/v1/catalogue/categories')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Find our root node
    const treeRoot = res.body.data.find((n: { id: string }) => n.id === root.id);
    expect(treeRoot).toBeDefined();
    expect(treeRoot.children.length).toBeGreaterThanOrEqual(2);
    const childNode = treeRoot.children.find((c: { id: string }) => c.id === child1.id);
    expect(childNode).toBeDefined();
  });

  it('CAT-031: returns 400 without X-Facility-ID header', async () => {
    const res = await agent.get('/api/v1/catalogue/categories');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FACILITY_ID');
  });
});

// ── CAT-040: Get category by id ───────────────────────────────────────────
describe('GET /api/v1/catalogue/categories/:id', () => {
  it('CAT-040: returns category with direct children', async () => {
    const root = await createTestCategory(facilityId, { name: `Root-${Date.now()}` });
    const child = await createTestCategory(facilityId, {
      name: `Child-${Date.now()}`,
      parentId: root.id,
    });

    const res = await agent
      .get(`/api/v1/catalogue/categories/${root.id}`)
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(root.id);
    expect(Array.isArray(res.body.data.children)).toBe(true);
    const childEntry = res.body.data.children.find((c: { id: string }) => c.id === child.id);
    expect(childEntry).toBeDefined();
  });

  it('CAT-041: returns 404 CATEGORY_NOT_FOUND for unknown id', async () => {
    const res = await agent
      .get('/api/v1/catalogue/categories/00000000-0000-0000-0000-000000000000')
      .set('X-Facility-ID', facilityId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });
});

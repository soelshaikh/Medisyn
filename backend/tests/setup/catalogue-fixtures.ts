import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getSuperAdminTestDb } from './db';
import * as catalogueSchema from '@/db/schema/catalogue';

// ── createTestCategory ───────────────────────────────────────────────────
// Inserts a category directly via superAdminDb (bypasses RLS).

export async function createTestCategory(
  facilityId: string,
  overrides: Partial<{
    name: string;
    slug: string;
    parentId: string | null;
    isActive: boolean;
    displayOrder: number;
  }> = {},
): Promise<{ id: string; slug: string; name: string }> {
  const sa = getSuperAdminTestDb();
  const name = overrides.name ?? `Test Category ${uuidv4().slice(0, 6)}`;
  const slug = overrides.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const [cat] = await sa
    .insert(catalogueSchema.categories)
    .values({
      facilityId,
      name,
      slug,
      parentId: overrides.parentId ?? null,
      isActive: overrides.isActive ?? true,
      displayOrder: overrides.displayOrder ?? 0,
    })
    .returning({
      id: catalogueSchema.categories.id,
      slug: catalogueSchema.categories.slug,
      name: catalogueSchema.categories.name,
    });

  return cat;
}

// ── createTestProduct ─────────────────────────────────────────────────────
// Inserts a product + one inventory_records row (quantity: 0).

export async function createTestProduct(
  facilityId: string,
  overrides: Partial<{
    sku: string;
    name: string;
    categoryId: string | null;
    price: string;
    isActive: boolean;
    variantDimensionLabel: string | null;
    isFeatured: boolean;
    brand: string | null;
    lowStockThreshold: number;
  }> = {},
): Promise<{ id: string; sku: string; slug: string; name: string; inventoryRecordId: string }> {
  const sa = getSuperAdminTestDb();
  const sku = overrides.sku ?? `SKU-${uuidv4().slice(0, 8).toUpperCase()}`;
  const name = overrides.name ?? `Test Product ${uuidv4().slice(0, 6)}`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const [product] = await sa
    .insert(catalogueSchema.products)
    .values({
      facilityId,
      sku,
      name,
      slug,
      price: overrides.price ?? '9.99',
      categoryId: overrides.categoryId ?? null,
      isActive: overrides.isActive ?? true,
      variantDimensionLabel: overrides.variantDimensionLabel ?? null,
      isFeatured: overrides.isFeatured ?? false,
      brand: overrides.brand ?? null,
      lowStockThreshold: overrides.lowStockThreshold ?? 0,
      images: [],
    })
    .returning({
      id: catalogueSchema.products.id,
      sku: catalogueSchema.products.sku,
      slug: catalogueSchema.products.slug,
      name: catalogueSchema.products.name,
    });

  const [invRec] = await sa
    .insert(catalogueSchema.inventoryRecords)
    .values({ facilityId, productId: product.id, variantId: null, quantity: 0 })
    .returning({ id: catalogueSchema.inventoryRecords.id });

  return { ...product, inventoryRecordId: invRec.id };
}

// ── createTestVariant ─────────────────────────────────────────────────────
// Inserts a product_variants row + one inventory_records row.

export async function createTestVariant(
  productId: string,
  facilityId: string,
  overrides: Partial<{
    sku: string;
    dimensionValue: string;
    price: string;
  }> = {},
): Promise<{ id: string; sku: string; inventoryRecordId: string }> {
  const sa = getSuperAdminTestDb();
  const sku = overrides.sku ?? `VSKU-${uuidv4().slice(0, 8).toUpperCase()}`;

  const [variant] = await sa
    .insert(catalogueSchema.productVariants)
    .values({
      facilityId,
      productId,
      sku,
      dimensionValue: overrides.dimensionValue ?? '100mg',
      price: overrides.price ?? '9.99',
    })
    .returning({ id: catalogueSchema.productVariants.id, sku: catalogueSchema.productVariants.sku });

  const [invRec] = await sa
    .insert(catalogueSchema.inventoryRecords)
    .values({ facilityId, productId, variantId: variant.id, quantity: 0 })
    .returning({ id: catalogueSchema.inventoryRecords.id });

  return { ...variant, inventoryRecordId: invRec.id };
}

// ── setInventoryQuantity ──────────────────────────────────────────────────
// Direct update for test setup — bypasses RLS.

export async function setInventoryQuantity(
  inventoryRecordId: string,
  quantity: number,
): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa
    .update(catalogueSchema.inventoryRecords)
    .set({ quantity, updatedAt: new Date() })
    .where(eq(catalogueSchema.inventoryRecords.id, inventoryRecordId));
}

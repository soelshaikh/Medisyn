import { eq, sql, and, gte, lte, inArray } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import {
  products,
  productVariants,
  inventoryRecords,
} from '@/db/schema/catalogue';
import type { CreateProductInput, CreateVariantInput, UpdateProductInput, UpdateVariantInput } from './product.types';

// ── Conflict lookups ──────────────────────────────────────────────────────

export async function getProductBySku(
  sku: string,
  tx: TenantTransaction,
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);
  return row;
}

export async function getProductBySkuExcluding(
  sku: string,
  excludeId: string,
  tx: TenantTransaction,
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .select({ id: products.id })
    .from(products)
    .where(sql`${products.sku} = ${sku} AND ${products.id} != ${excludeId}`)
    .limit(1);
  return row;
}

export async function getProductBySlug(
  slug: string,
  tx: TenantTransaction,
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return row;
}

export async function getExistingProductSlugs(tx: TenantTransaction): Promise<string[]> {
  const rows = await tx.select({ slug: products.slug }).from(products);
  return rows.map((r) => r.slug);
}

export async function getVariantBySku(
  sku: string,
  tx: TenantTransaction,
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.sku, sku))
    .limit(1);
  return row;
}

export async function getVariantBySkuExcluding(
  sku: string,
  excludeId: string,
  tx: TenantTransaction,
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(sql`${productVariants.sku} = ${sku} AND ${productVariants.id} != ${excludeId}`)
    .limit(1);
  return row;
}

// ── Single-row lookups ────────────────────────────────────────────────────

export async function getProductById(
  id: string,
  tx: TenantTransaction,
): Promise<{
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  brand: string | null;
  images: string[];
  price: string;
  compareAtPrice: string | null;
  categoryId: string | null;
  variantDimensionLabel: string | null;
  lowStockThreshold: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
} | undefined> {
  const [row] = await tx
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      description: products.description,
      shortDescription: products.shortDescription,
      brand: products.brand,
      images: products.images,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      categoryId: products.categoryId,
      variantDimensionLabel: products.variantDimensionLabel,
      lowStockThreshold: products.lowStockThreshold,
      isFeatured: products.isFeatured,
      isActive: products.isActive,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row;
}

export interface VariantWithInventory {
  id: string;
  sku: string;
  dimensionValue: string;
  price: string;
  compareAtPrice: string | null;
  isActive: boolean;
  quantity: number;
  inventoryRecordId: string;
}

export async function getVariantsWithInventory(
  productId: string,
  tx: TenantTransaction,
): Promise<VariantWithInventory[]> {
  const rows = await tx
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      dimensionValue: productVariants.dimensionValue,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      isActive: productVariants.isActive,
      quantity: inventoryRecords.quantity,
      inventoryRecordId: inventoryRecords.id,
    })
    .from(productVariants)
    .innerJoin(
      inventoryRecords,
      eq(inventoryRecords.variantId, productVariants.id),
    )
    .where(eq(productVariants.productId, productId));
  return rows as VariantWithInventory[];
}

export async function getInventoryRecordForProduct(
  productId: string,
  tx: TenantTransaction,
): Promise<{ id: string; quantity: number } | undefined> {
  const [row] = await tx
    .select({ id: inventoryRecords.id, quantity: inventoryRecords.quantity })
    .from(inventoryRecords)
    .where(
      sql`${inventoryRecords.productId} = ${productId} AND ${inventoryRecords.variantId} IS NULL`,
    )
    .limit(1);
  return row;
}

export async function getVariantById(
  variantId: string,
  tx: TenantTransaction,
): Promise<{
  id: string;
  productId: string;
  sku: string;
  dimensionValue: string;
  price: string;
  compareAtPrice: string | null;
  isActive: boolean;
} | undefined> {
  const [row] = await tx
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      dimensionValue: productVariants.dimensionValue,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  return row;
}

// ── Inserts ───────────────────────────────────────────────────────────────

export async function insertProduct(
  facilityId: string,
  userId: string,
  data: CreateProductInput & { slug: string },
  tx: TenantTransaction,
): Promise<{ id: string; sku: string; slug: string; name: string; createdAt: Date }> {
  const [row] = await tx
    .insert(products)
    .values({
      facilityId,
      sku: data.sku,
      name: data.name,
      slug: data.slug,
      price: data.price,
      categoryId: data.categoryId ?? null,
      description: data.description ?? null,
      shortDescription: data.shortDescription ?? null,
      brand: data.brand ?? null,
      images: data.images ?? [],
      compareAtPrice: data.compareAtPrice ?? null,
      variantDimensionLabel: data.variantDimensionLabel ?? null,
      lowStockThreshold: data.lowStockThreshold ?? 0,
      isFeatured: data.isFeatured ?? false,
      isActive: data.isActive ?? true,
      createdById: userId,
      updatedById: userId,
    })
    .returning({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      createdAt: products.createdAt,
    });
  return row;
}

export async function insertInventoryRecordForProduct(
  facilityId: string,
  productId: string,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(inventoryRecords)
    .values({ facilityId, productId, variantId: null, quantity: 0 })
    .returning({ id: inventoryRecords.id });
  return row;
}

export async function insertVariant(
  facilityId: string,
  productId: string,
  data: CreateVariantInput,
  tx: TenantTransaction,
): Promise<{ id: string; sku: string; dimensionValue: string; price: string; createdAt: Date }> {
  const [row] = await tx
    .insert(productVariants)
    .values({
      facilityId,
      productId,
      sku: data.sku,
      dimensionValue: data.dimensionValue,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
    })
    .returning({
      id: productVariants.id,
      sku: productVariants.sku,
      dimensionValue: productVariants.dimensionValue,
      price: productVariants.price,
      createdAt: productVariants.createdAt,
    });
  return row;
}

export async function insertInventoryRecordForVariant(
  facilityId: string,
  productId: string,
  variantId: string,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(inventoryRecords)
    .values({ facilityId, productId, variantId, quantity: 0 })
    .returning({ id: inventoryRecords.id });
  return row;
}

// ── Updates ───────────────────────────────────────────────────────────────

export async function updateProductById(
  id: string,
  userId: string,
  data: Partial<UpdateProductInput & { slug: string }>,
  tx: TenantTransaction,
): Promise<{ id: string; updatedAt: Date }> {
  const [row] = await tx
    .update(products)
    .set({
      ...data,
      updatedById: userId,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning({ id: products.id, updatedAt: products.updatedAt });
  return row;
}

export async function updateVariantById(
  id: string,
  data: UpdateVariantInput,
  tx: TenantTransaction,
): Promise<{ id: string; updatedAt: Date }> {
  const [row] = await tx
    .update(productVariants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(productVariants.id, id))
    .returning({ id: productVariants.id, updatedAt: productVariants.updatedAt });
  return row;
}

// ── listProducts ──────────────────────────────────────────────────────────

export type ProductSortKey = 'created_desc' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export interface ListProductsFilters {
  categoryId?: string;
  brand?: string;
  priceMin?: string;
  priceMax?: string;
  inStock?: boolean;
  featured?: boolean;
  search?: string;
  sort?: ProductSortKey;
  page: number;
  limit: number;
}

export interface ProductListRow {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  brand: string | null;
  categoryId: string | null;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  isFeatured: boolean;
  variantDimensionLabel: string | null;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  createdAt: Date;
}

export async function listProducts(
  filters: ListProductsFilters,
  tx: TenantTransaction,
): Promise<{ rows: ProductListRow[]; total: number }> {
  const { page, limit } = filters;
  const offset = (page - 1) * limit;

  // Resolve category filter: collect all descendant IDs via recursive CTE
  let categoryIds: string[] | undefined;
  if (filters.categoryId) {
    const rows = await tx.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM categories WHERE id = ${filters.categoryId}
        UNION ALL
        SELECT c.id FROM categories c
        JOIN descendants d ON c.parent_id = d.id
      )
      SELECT id FROM descendants
    `);
    categoryIds = (rows as unknown as { id: string }[]).map((r) => r.id);
    if (categoryIds.length === 0) {
      return { rows: [], total: 0 };
    }
  }

  // Build WHERE conditions
  const conditions = [eq(products.isActive, true)];

  if (categoryIds && categoryIds.length > 0) {
    conditions.push(inArray(products.categoryId, categoryIds));
  }
  if (filters.brand) {
    conditions.push(sql`LOWER(${products.brand}) = LOWER(${filters.brand})`);
  }
  if (filters.priceMin) {
    conditions.push(gte(products.price, filters.priceMin));
  }
  if (filters.priceMax) {
    conditions.push(lte(products.price, filters.priceMax));
  }
  if (filters.featured === true) {
    conditions.push(eq(products.isFeatured, true));
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      sql`(${products.name} ILIKE ${term} OR ${products.description} ILIKE ${term})`,
    );
  }
  if (filters.inStock === true) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM inventory_records ir
        WHERE ir.product_id = ${products.id} AND ir.quantity > 0
      )`,
    );
  }

  // ORDER BY mapping
  const orderClause: ReturnType<typeof sql> = (() => {
    switch (filters.sort ?? 'created_desc') {
      case 'price_asc':    return sql`${products.price} ASC`;
      case 'price_desc':   return sql`${products.price} DESC`;
      case 'name_asc':     return sql`${products.name} ASC`;
      case 'name_desc':    return sql`${products.name} DESC`;
      case 'created_desc':
      default:             return sql`${products.createdAt} DESC`;
    }
  })();

  const whereClause = and(...conditions)!;

  // Count query
  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(products)
    .where(whereClause);

  if (count === 0) {
    return { rows: [], total: 0 };
  }

  // Data query
  const rows = await tx
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      slug: products.slug,
      shortDescription: products.shortDescription,
      brand: products.brand,
      categoryId: products.categoryId,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      images: products.images,
      isFeatured: products.isFeatured,
      variantDimensionLabel: products.variantDimensionLabel,
      lowStockThreshold: products.lowStockThreshold,
      createdAt: products.createdAt,
      totalQuantity: sql<number>`COALESCE((
        SELECT SUM(ir.quantity) FROM inventory_records ir WHERE ir.product_id = ${products.id}
      ), 0)::int`,
    })
    .from(products)
    .where(whereClause)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset);

  const result: ProductListRow[] = rows.map((r) => {
    const qty = r.totalQuantity;
    const threshold = r.lowStockThreshold;
    let stockStatus: ProductListRow['stockStatus'];
    if (qty <= 0) stockStatus = 'out_of_stock';
    else if (qty <= threshold) stockStatus = 'low_stock';
    else stockStatus = 'in_stock';

    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      shortDescription: r.shortDescription,
      brand: r.brand,
      categoryId: r.categoryId,
      price: r.price,
      compareAtPrice: r.compareAtPrice,
      images: r.images,
      isFeatured: r.isFeatured,
      variantDimensionLabel: r.variantDimensionLabel,
      stockStatus,
      createdAt: r.createdAt,
    };
  });

  return { rows: result, total: count };
}

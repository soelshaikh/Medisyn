import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { slugify, uniqueSlug } from '@/lib/slugify';
import { createAuditEntry } from '@/core/audit/audit.service';
import {
  getProductBySku,
  getProductBySkuExcluding,
  getProductBySlug,
  getExistingProductSlugs,
  getVariantBySku,
  getVariantBySkuExcluding,
  getProductById,
  getVariantById,
  getVariantsWithInventory,
  getInventoryRecordForProduct,
  insertProduct,
  insertInventoryRecordForProduct,
  insertVariant,
  insertInventoryRecordForVariant,
  updateProductById,
  updateVariantById,
} from './product.queries';
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
} from './product.types';
import type { VariantWithInventory } from './product.queries';

// ── Internal helpers ──────────────────────────────────────────────────────

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

function resolveStockStatus(
  quantity: number,
  lowStockThreshold: number,
): StockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

// ── createProduct ─────────────────────────────────────────────────────────

export interface CreateProductResult {
  id: string;
  sku: string;
  slug: string;
  name: string;
  createdAt: Date;
}

export async function createProduct(
  facilityId: string,
  userId: string,
  input: CreateProductInput,
): Promise<CreateProductResult> {
  return withTenantContext(facilityId, async (tx) => {
    // SKU uniqueness
    const existing = await getProductBySku(input.sku, tx);
    if (existing) {
      throw new AppError('SKU_CONFLICT', `SKU "${input.sku}" already exists in this facility`, 409);
    }

    // Validate variantDimensionLabel required when variants provided
    if (input.variants && input.variants.length > 0 && !input.variantDimensionLabel) {
      throw new AppError(
        'VARIANT_DIMENSION_REQUIRED',
        'variantDimensionLabel is required when variants are provided',
        422,
      );
    }

    // Slug — use provided or auto-generate
    let slug: string;
    if (input.slug) {
      const slugConflict = await getProductBySlug(input.slug, tx);
      if (slugConflict) {
        throw new AppError('SLUG_CONFLICT', `Slug "${input.slug}" already exists in this facility`, 409);
      }
      slug = input.slug;
    } else {
      const existingSlugs = await getExistingProductSlugs(tx);
      slug = uniqueSlug(slugify(input.name), existingSlugs);
    }

    // Variant SKU conflict check (all variants up front)
    if (input.variants) {
      for (const v of input.variants) {
        const vConflict = await getVariantBySku(v.sku, tx);
        if (vConflict) {
          throw new AppError(
            'VARIANT_SKU_CONFLICT',
            `Variant SKU "${v.sku}" already exists in this facility`,
            409,
          );
        }
      }
    }

    // Insert product
    const product = await insertProduct(facilityId, userId, { ...input, slug }, tx);

    // Create inventory record (no variants product) — always created even when variants follow
    await insertInventoryRecordForProduct(facilityId, product.id, tx);

    // Insert variants if provided
    if (input.variants) {
      for (const v of input.variants) {
        const variant = await insertVariant(facilityId, product.id, v, tx);
        await insertInventoryRecordForVariant(facilityId, product.id, variant.id, tx);
      }
    }

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'product.created',
        resourceType: 'product',
        resourceId: product.id,
        metadata: { sku: product.sku, slug: product.slug },
      },
      tx,
    );

    return product;
  });
}

// ── updateProduct ─────────────────────────────────────────────────────────

export interface UpdateProductResult {
  id: string;
  updatedAt: Date;
}

export async function updateProduct(
  facilityId: string,
  userId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<UpdateProductResult> {
  return withTenantContext(facilityId, async (tx) => {
    const product = await getProductById(productId, tx);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    // SKU conflict check (exclude self)
    if (input.sku && input.sku !== product.sku) {
      const skuConflict = await getProductBySkuExcluding(input.sku, productId, tx);
      if (skuConflict) {
        throw new AppError('SKU_CONFLICT', `SKU "${input.sku}" already exists in this facility`, 409);
      }
    }

    // Slug conflict check (exclude self)
    let slug: string | undefined;
    if (input.slug !== undefined) {
      if (input.slug === null) {
        slug = undefined; // keep existing — null slug not allowed on existing product
      } else if (input.slug !== product.slug) {
        const slugConflict = await getProductBySlug(input.slug, tx);
        if (slugConflict) {
          throw new AppError('SLUG_CONFLICT', `Slug "${input.slug}" already exists in this facility`, 409);
        }
        slug = input.slug;
      }
    }

    const updateData = {
      ...(input.sku !== undefined && { sku: input.sku }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(slug !== undefined && { slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.shortDescription !== undefined && { shortDescription: input.shortDescription }),
      ...(input.brand !== undefined && { brand: input.brand }),
      ...(input.images !== undefined && { images: input.images }),
      ...(input.compareAtPrice !== undefined && { compareAtPrice: input.compareAtPrice }),
      ...(input.variantDimensionLabel !== undefined && {
        variantDimensionLabel: input.variantDimensionLabel,
      }),
      ...(input.lowStockThreshold !== undefined && { lowStockThreshold: input.lowStockThreshold }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    };

    const result = await updateProductById(productId, userId, updateData, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'product.updated',
        resourceType: 'product',
        resourceId: productId,
        metadata: { changes: Object.keys(updateData) },
      },
      tx,
    );

    return result;
  });
}

// ── deactivateProduct ─────────────────────────────────────────────────────

export interface DeactivateProductResult {
  id: string;
  isActive: false;
  updatedAt: Date;
}

export async function deactivateProduct(
  facilityId: string,
  userId: string,
  productId: string,
): Promise<DeactivateProductResult> {
  return withTenantContext(facilityId, async (tx) => {
    const product = await getProductById(productId, tx);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }
    if (!product.isActive) {
      throw new AppError('PRODUCT_ALREADY_INACTIVE', 'Product is already inactive', 409);
    }

    const result = await updateProductById(productId, userId, { isActive: false }, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'product.deactivated',
        resourceType: 'product',
        resourceId: productId,
      },
      tx,
    );

    return { id: result.id, isActive: false, updatedAt: result.updatedAt };
  });
}

// ── addVariant ────────────────────────────────────────────────────────────

export interface AddVariantResult {
  id: string;
  sku: string;
  dimensionValue: string;
  price: string;
  createdAt: Date;
}

export async function addVariant(
  facilityId: string,
  userId: string,
  productId: string,
  input: CreateVariantInput,
): Promise<AddVariantResult> {
  return withTenantContext(facilityId, async (tx) => {
    const product = await getProductById(productId, tx);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }
    if (!product.variantDimensionLabel) {
      throw new AppError(
        'VARIANT_DIMENSION_REQUIRED',
        'Product does not support variants — set variantDimensionLabel first',
        422,
      );
    }

    // SKU uniqueness across the facility
    const skuConflict = await getVariantBySku(input.sku, tx);
    if (skuConflict) {
      throw new AppError(
        'VARIANT_SKU_CONFLICT',
        `Variant SKU "${input.sku}" already exists in this facility`,
        409,
      );
    }

    const variant = await insertVariant(facilityId, productId, input, tx);
    await insertInventoryRecordForVariant(facilityId, productId, variant.id, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'product.variant_added',
        resourceType: 'product_variant',
        resourceId: variant.id,
        metadata: { productId, sku: variant.sku },
      },
      tx,
    );

    return variant;
  });
}

// ── updateVariant ─────────────────────────────────────────────────────────

export interface UpdateVariantResult {
  id: string;
  updatedAt: Date;
}

export async function updateVariant(
  facilityId: string,
  userId: string,
  productId: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<UpdateVariantResult> {
  return withTenantContext(facilityId, async (tx) => {
    const variant = await getVariantById(variantId, tx);
    if (!variant || variant.productId !== productId) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found', 404);
    }

    // SKU conflict check (exclude self)
    if (input.sku && input.sku !== variant.sku) {
      const skuConflict = await getVariantBySkuExcluding(input.sku, variantId, tx);
      if (skuConflict) {
        throw new AppError(
          'VARIANT_SKU_CONFLICT',
          `Variant SKU "${input.sku}" already exists in this facility`,
          409,
        );
      }
    }

    const result = await updateVariantById(variantId, input, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'product.variant_updated',
        resourceType: 'product_variant',
        resourceId: variantId,
        metadata: { productId, changes: Object.keys(input) },
      },
      tx,
    );

    return result;
  });
}

// ── deactivateVariant ─────────────────────────────────────────────────────

export async function deactivateVariant(
  facilityId: string,
  userId: string,
  productId: string,
  variantId: string,
): Promise<{ id: string; isActive: false }> {
  return withTenantContext(facilityId, async (tx) => {
    const variant = await getVariantById(variantId, tx);
    if (!variant || variant.productId !== productId) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found', 404);
    }

    await updateVariantById(variantId, { isActive: false }, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: userId,
        actorType: 'user',
        action: 'product.variant_deactivated',
        resourceType: 'product_variant',
        resourceId: variantId,
        metadata: { productId },
      },
      tx,
    );

    return { id: variantId, isActive: false };
  });
}

// ── getProductDetail ──────────────────────────────────────────────────────

export interface ProductDetailResult {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  brand: string | null;
  categoryId: string | null;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  isFeatured: boolean;
  isActive: boolean;
  variantDimensionLabel: string | null;
  lowStockThreshold: number;
  variants: (VariantWithInventory & { stockStatus: StockStatus })[];
  stockStatus: StockStatus | null;
  quantity: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getProductDetail(
  facilityId: string,
  productId: string,
  requireActive = true,
): Promise<ProductDetailResult> {
  return withTenantContext(facilityId, async (tx) => {
    const product = await getProductById(productId, tx);
    if (!product || (requireActive && !product.isActive)) {
      throw new AppError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    const hasVariants = product.variantDimensionLabel !== null;
    let variants: (VariantWithInventory & { stockStatus: StockStatus })[] = [];
    let stockStatus: StockStatus | null = null;
    let quantity: number | null = null;

    if (hasVariants) {
      const rawVariants = await getVariantsWithInventory(productId, tx);
      variants = rawVariants.map((v) => ({
        ...v,
        stockStatus: resolveStockStatus(v.quantity, product.lowStockThreshold),
      }));
    } else {
      const invRecord = await getInventoryRecordForProduct(productId, tx);
      if (invRecord) {
        quantity = invRecord.quantity;
        stockStatus = resolveStockStatus(quantity, product.lowStockThreshold);
      }
    }

    return {
      ...product,
      variants,
      stockStatus,
      quantity,
    };
  });
}

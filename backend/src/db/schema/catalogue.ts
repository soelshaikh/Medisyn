import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';

// ── categories ────────────────────────────────────────────────────────────
// Hierarchical: parent_id self-ref FK added via migration SQL (Drizzle can't
// express a self-reference without a deferred constraint).
// RLS: facility_id = current_facility_id()

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    // Self-referential FK — added manually in migration SQL
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('categories_facility_slug_unique').on(t.facilityId, t.slug),
    index('categories_facility_active_idx').on(t.facilityId, t.isActive),
    index('categories_parent_idx').on(t.parentId),
  ],
);

// ── products ──────────────────────────────────────────────────────────────
// RLS: facility_id = current_facility_id()

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    shortDescription: text('short_description'),
    brand: text('brand'),
    // Ordered list of image CDN URLs. Upload infra deferred to Phase 9.
    images: text('images').array().notNull().default([]),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 10, scale: 2 }),
    // NULL = no variants. If set, product_variants rows exist for this product.
    variantDimensionLabel: text('variant_dimension_label'),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('products_facility_sku_unique').on(t.facilityId, t.sku),
    unique('products_facility_slug_unique').on(t.facilityId, t.slug),
    index('products_facility_active_idx').on(t.facilityId, t.isActive),
    index('products_facility_category_idx').on(t.facilityId, t.categoryId),
    index('products_facility_brand_idx').on(t.facilityId, t.brand),
    index('products_facility_featured_idx').on(t.facilityId, t.isFeatured),
    // GIN trigram indexes for keyword search added in migration SQL
  ],
);

// ── product_variants ──────────────────────────────────────────────────────
// Optional sub-items — single dimension only (e.g., "500mg", "Large").
// RLS: facility_id = current_facility_id()

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    dimensionValue: text('dimension_value').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('product_variants_facility_sku_unique').on(t.facilityId, t.sku),
    index('product_variants_product_idx').on(t.productId),
  ],
);

// ── inventory_records ─────────────────────────────────────────────────────
// One row per (product, variant) pair. variant_id IS NULL for products without variants.
// UNIQUE NULLS NOT DISTINCT constraint added in migration SQL (PG16 required).
// quantity is updated atomically with SELECT FOR UPDATE on each adjustment.
// RLS: facility_id = current_facility_id()

export const inventoryRecords = pgTable(
  'inventory_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // NULL for products with no variants
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(0),
    allowNegative: boolean('allow_negative').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_records_product_idx').on(t.productId),
    index('inventory_records_variant_idx').on(t.variantId),
  ],
);

// ── inventory_transactions ────────────────────────────────────────────────
// Append-only audit trail for every stock change.
// UPDATE and DELETE are REVOKEd at DB level (mirrors audit_log pattern).
// RLS: facility_id = current_facility_id()

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    inventoryRecordId: uuid('inventory_record_id')
      .notNull()
      .references(() => inventoryRecords.id),
    productId: uuid('product_id').notNull().references(() => products.id),
    variantId: uuid('variant_id').references(() => productVariants.id),
    // Positive = added, Negative = removed
    quantityDelta: integer('quantity_delta').notNull(),
    resultingBalance: integer('resulting_balance').notNull(),
    // RESTOCK | DAMAGED | MANUAL_ADJUSTMENT | RETURN | WRITE_OFF | OTHER
    reason: text('reason').notNull(),
    note: text('note'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_tx_record_created_idx').on(t.inventoryRecordId, t.createdAt),
    index('inventory_tx_facility_created_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── coupons ───────────────────────────────────────────────────────────────
// code is always stored UPPERCASE. Unique per facility (case-insensitive enforced in service).
// RLS: facility_id = current_facility_id()

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    // Stored UPPERCASE. Unique within facility.
    code: text('code').notNull(),
    // PERCENTAGE | FIXED_AMOUNT
    type: text('type').notNull(),
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
    // PERCENTAGE coupons only — caps the dollar discount
    maxDiscountAmount: numeric('max_discount_amount', { precision: 10, scale: 2 }),
    minOrderTotal: numeric('min_order_total', { precision: 10, scale: 2 }),
    totalUsageLimit: integer('total_usage_limit'),
    perCustomerUsageLimit: integer('per_customer_usage_limit'),
    totalRedemptionCount: integer('total_redemption_count').notNull().default(0),
    // Array of product UUIDs this coupon applies to (NULL = all products)
    applicableProductIds: uuid('applicable_product_ids').array(),
    applicableCategoryIds: uuid('applicable_category_ids').array(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    internalNotes: text('internal_notes'),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('coupons_facility_code_unique').on(t.facilityId, t.code),
    index('coupons_facility_active_idx').on(t.facilityId, t.isActive),
  ],
);

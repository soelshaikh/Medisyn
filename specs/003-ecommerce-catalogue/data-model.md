# Data Model: Ecommerce Catalogue

**Feature**: Phase 3 — Ecommerce Catalogue
**Date**: 2026-10-09
**Schema file**: `backend/src/db/schema/catalogue.ts`
**Migration**: `backend/drizzle/XXXX_catalogue.sql`

---

## Entity Relationship Summary

```
facilities (existing)
  │
  ├── categories (tree: parent_id → self)
  │     └── products.category_id
  │
  ├── products
  │     ├── product_variants (0..N per product)
  │     ├── inventory_records (1 per product or 1 per variant)
  │     └── inventory_transactions (append-only, N per record)
  │
  └── coupons
```

All tables have `facility_id` referencing `facilities.id` and are protected by Row-Level Security.

---

## Table Definitions (Drizzle ORM)

### `catalogue.ts` — Single schema file for all 6 tables

```typescript
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

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),        // self-referential FK added via migration SQL
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdById: uuid('created_by_id').references(() => users.id),
    updatedById: uuid('updated_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.facilityId, t.slug),
    index('categories_facility_active_idx').on(t.facilityId, t.isActive),
  ],
);

// ── products ──────────────────────────────────────────────────────────────

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
    // Ordered list of image URLs. Upload infra deferred to Phase 9.
    images: text('images').array().notNull().default([]),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 10, scale: 2 }),
    // NULL if no variants. If set, product_variants table has rows for this product.
    variantDimensionLabel: text('variant_dimension_label'),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdById: uuid('created_by_id').references(() => users.id),
    updatedById: uuid('updated_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.facilityId, t.sku),
    unique().on(t.facilityId, t.slug),
    index('products_facility_active_idx').on(t.facilityId, t.isActive),
    index('products_facility_category_idx').on(t.facilityId, t.categoryId),
    index('products_facility_brand_idx').on(t.facilityId, t.brand),
    index('products_facility_featured_idx').on(t.facilityId, t.isFeatured),
    // GIN trigram indexes for keyword search (created in migration SQL, not Drizzle)
  ],
);

// ── product_variants ──────────────────────────────────────────────────────

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
    // e.g., "500mg", "Large", "Blue"
    dimensionValue: text('dimension_value').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.facilityId, t.sku),
    index('product_variants_product_idx').on(t.productId),
  ],
);

// ── inventory_records ─────────────────────────────────────────────────────
// One row per (product, variant) pair. variant_id IS NULL for products without variants.
// quantity is the current stock balance. Updated atomically with SELECT FOR UPDATE.

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
    // Facility-level override to allow negative stock (back-orders). Default false.
    allowNegative: boolean('allow_negative').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // UNIQUE NULLS NOT DISTINCT requires PG15+ — handled in migration SQL
);

// ── inventory_transactions ────────────────────────────────────────────────
// Append-only audit trail. No UPDATE or DELETE permissions granted to app_user.

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
    // Positive = stock added, Negative = stock removed
    quantityDelta: integer('quantity_delta').notNull(),
    // Balance after this adjustment was applied
    resultingBalance: integer('resulting_balance').notNull(),
    // RESTOCK | DAMAGED | MANUAL_ADJUSTMENT | RETURN | WRITE_OFF | OTHER
    reason: text('reason').notNull(),
    note: text('note'),
    actorId: uuid('actor_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_tx_record_idx').on(t.inventoryRecordId, t.createdAt),
    index('inventory_tx_facility_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── coupons ───────────────────────────────────────────────────────────────

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    // Always stored UPPERCASE. Case-insensitive unique per facility.
    code: text('code').notNull(),
    // PERCENTAGE | FIXED_AMOUNT
    type: text('type').notNull(),
    // For PERCENTAGE: 0–100. For FIXED_AMOUNT: dollar value.
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
    // PERCENTAGE only — caps the dollar discount
    maxDiscountAmount: numeric('max_discount_amount', { precision: 10, scale: 2 }),
    // NULL = no minimum
    minOrderTotal: numeric('min_order_total', { precision: 10, scale: 2 }),
    // NULL = unlimited
    totalUsageLimit: integer('total_usage_limit'),
    // NULL = unlimited per customer
    perCustomerUsageLimit: integer('per_customer_usage_limit'),
    // Tracks total redemptions. Incremented at checkout (Phase 4).
    totalRedemptionCount: integer('total_redemption_count').notNull().default(0),
    // NULL = restricted product IDs (JSON array of UUIDs), NULL = all products
    applicableProductIds: uuid('applicable_product_ids').array(),
    // NULL = all categories
    applicableCategoryIds: uuid('applicable_category_ids').array(),
    // NULL = active immediately
    startsAt: timestamp('starts_at', { withTimezone: true }),
    // NULL = never expires
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    internalNotes: text('internal_notes'),
    createdById: uuid('created_by_id').references(() => users.id),
    updatedById: uuid('updated_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.facilityId, t.code),
    index('coupons_facility_active_idx').on(t.facilityId, t.isActive),
  ],
);
```

---

## Migration SQL (key non-Drizzle items)

The Drizzle-generated migration will not handle all constraints. The following must be added manually to the migration file:

```sql
-- 1. Self-referential FK for categories
ALTER TABLE categories
  ADD CONSTRAINT categories_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES categories(id);

-- 2. Unique NULLS NOT DISTINCT for inventory_records
--    Ensures one row per product (when no variants) and one row per variant.
ALTER TABLE inventory_records
  ADD CONSTRAINT inventory_records_product_variant_unique
  UNIQUE NULLS NOT DISTINCT (product_id, variant_id);

-- 3. Trigram indexes for product search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_name_trgm_idx ON products USING GIN (name gin_trgm_ops);
CREATE INDEX products_description_trgm_idx ON products USING GIN (description gin_trgm_ops);

-- 4. Check constraints
ALTER TABLE products
  ADD CONSTRAINT products_price_positive CHECK (price >= 0);
ALTER TABLE coupons
  ADD CONSTRAINT coupons_discount_value_positive CHECK (discount_value > 0);
ALTER TABLE coupons
  ADD CONSTRAINT coupons_percentage_range
    CHECK (type != 'PERCENTAGE' OR (discount_value > 0 AND discount_value <= 100));
ALTER TABLE inventory_records
  ADD CONSTRAINT inventory_records_quantity_floor
    CHECK (allow_negative = true OR quantity >= 0);

-- 5. Row-Level Security — all 6 tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_facility_isolation ON categories
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_facility_isolation ON products
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_variants_facility_isolation ON product_variants
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

ALTER TABLE inventory_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_records_facility_isolation ON inventory_records
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_transactions_facility_isolation ON inventory_transactions
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_facility_isolation ON coupons
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());

-- 6. Append-only enforcement for inventory_transactions
--    (mirrors audit_log pattern from Phase 1)
REVOKE UPDATE, DELETE ON inventory_transactions FROM app_user;
REVOKE UPDATE, DELETE ON inventory_transactions FROM app_super_admin;

-- 7. Grant permissions to app_user (read + write for regular tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  categories, products, product_variants, inventory_records, coupons
TO app_user;
GRANT SELECT, INSERT ON inventory_transactions TO app_user;

-- 8. Grant same to app_super_admin (BYPASSRLS role)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  categories, products, product_variants, inventory_records, coupons
TO app_super_admin;
GRANT SELECT, INSERT ON inventory_transactions TO app_super_admin;
```

---

## State Transitions

### Product lifecycle

```
DRAFT (isActive=false, newly created) → ACTIVE (isActive=true) → INACTIVE (isActive=false)
```
No "draft" concept in spec — products are created as active by default (`isActive: true`). Deactivation is the only lifecycle state change. No hard delete.

### Inventory record

```
CREATED (quantity=0, on product creation) → adjusted (quantity += delta on each transaction)
```
Inventory record is created automatically when a product (or variant) is created. Initial quantity is 0.

### Coupon lifecycle

```
ACTIVE (isActive=true, within date range) → INACTIVE (isActive=false) or EXPIRED (endsAt in past)
```
No hard delete. `totalRedemptionCount` is incremented at checkout (Phase 4, not Phase 3).

---

## New Permissions to Seed

Add to `backend/src/db/seeds/catalogue-permissions.ts`:

```typescript
const cataloguePermissions = [
  { key: 'products.manage',     name: 'Manage Products',    moduleId: ECOMMERCE_MODULE_ID },
  { key: 'categories.manage',   name: 'Manage Categories',  moduleId: ECOMMERCE_MODULE_ID },
  { key: 'inventory.read',      name: 'View Inventory',     moduleId: ECOMMERCE_MODULE_ID },
  { key: 'inventory.adjust',    name: 'Adjust Inventory',   moduleId: ECOMMERCE_MODULE_ID },
  { key: 'coupons.manage',      name: 'Manage Coupons',     moduleId: ECOMMERCE_MODULE_ID },
];
```

The `ECOMMERCE_MODULE_ID` is the UUID of the existing `ecommerce` platform module from the Phase 1 seed.

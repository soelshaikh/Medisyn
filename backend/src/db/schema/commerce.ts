import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';
import { products, productVariants } from './catalogue';

// ── facility_sequences ────────────────────────────────────────────────────
// Per-facility, per-resource_type counter for human-readable sequential IDs.
// Locked with SELECT FOR UPDATE during order placement to ensure no collisions.
// RLS: facility_id = current_facility_id()

export const facilitySequences = pgTable(
  'facility_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    nextVal: integer('next_val').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('facility_sequences_facility_resource_unique').on(t.facilityId, t.resourceType),
  ],
);

// ── shipping_methods ──────────────────────────────────────────────────────
// Admin-managed per-facility shipping options shown during checkout.
// RLS: facility_id = current_facility_id()

export const shippingMethods = pgTable(
  'shipping_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    flatRate: numeric('flat_rate', { precision: 10, scale: 2 }).notNull(),
    estimatedDaysMin: integer('estimated_days_min').notNull().default(0),
    estimatedDaysMax: integer('estimated_days_max').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('shipping_methods_facility_name_unique').on(t.facilityId, t.name),
    index('shipping_methods_facility_active_idx').on(t.facilityId, t.isActive),
  ],
);

// ── carts ─────────────────────────────────────────────────────────────────
// Server-side carts for both guests (cart_token) and authenticated users (user_id).
// UNIQUE NULLS NOT DISTINCT constraints added in migration SQL (PG15+ feature).
// RLS: facility_id = current_facility_id()

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    // NULL for guest carts
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    // NULL for authenticated carts. UUID token stored in HttpOnly cookie.
    cartToken: uuid('cart_token'),
    // Guest carts expire after 30 days
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('carts_user_idx').on(t.facilityId, t.userId),
    index('carts_token_idx').on(t.facilityId, t.cartToken),
  ],
);

// ── cart_items ────────────────────────────────────────────────────────────
// Line items within a cart. price_snapshot captures the price at time of add.
// UNIQUE NULLS NOT DISTINCT on (cart_id, product_id, variant_id) — migration SQL.
// RLS: facility_id = current_facility_id()

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // NULL for products without variants
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'cascade',
    }),
    quantity: integer('quantity').notNull(),
    // Snapshot of price at time item was added (live price shown in cart response via JOIN)
    priceSnapshot: numeric('price_snapshot', { precision: 10, scale: 2 }).notNull(),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    variantLabelSnapshot: text('variant_label_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cart_items_cart_idx').on(t.cartId),
    index('cart_items_product_idx').on(t.productId),
  ],
);

// ── orders ────────────────────────────────────────────────────────────────
// Immutable order header created at checkout/place. Snapshots capture all
// values at time of purchase (prices, shipping, address) — FK references
// are nullable to survive product/method deletions without losing order data.
// DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    orderNumber: text('order_number').notNull(),
    // pending | confirmed | processing | ready | shipped | delivered | cancelled | refunded
    status: text('status').notNull().default('pending'),
    shippingAddress: jsonb('shipping_address').notNull(),
    // Nullable: shipping method may be deleted post-order
    shippingMethodId: uuid('shipping_method_id').references(() => shippingMethods.id, {
      onDelete: 'set null',
    }),
    shippingMethodSnapshot: jsonb('shipping_method_snapshot').notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    taxBreakdown: jsonb('tax_breakdown').notNull(),
    taxTotal: numeric('tax_total', { precision: 10, scale: 2 }).notNull(),
    shippingCost: numeric('shipping_cost', { precision: 10, scale: 2 }).notNull(),
    total: numeric('total', { precision: 10, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('orders_facility_number_unique').on(t.facilityId, t.orderNumber),
    index('orders_facility_patient_idx').on(t.facilityId, t.patientId),
    index('orders_facility_status_idx').on(t.facilityId, t.status),
    index('orders_created_at_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── order_items ───────────────────────────────────────────────────────────
// Immutable line items — snapshot of product at time of purchase.
// FK to products/variants is nullable to survive deletions.
// UPDATE and DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    // Nullable: product/variant may be deleted but order history must survive
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    productName: text('product_name').notNull(),
    variantLabel: text('variant_label'),
    sku: text('sku').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
  ],
);

// ── order_status_history ──────────────────────────────────────────────────
// Append-only audit trail for every order status transition.
// UPDATE and DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    previousStatus: text('previous_status'),
    newStatus: text('new_status').notNull(),
    changedById: uuid('changed_by_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('order_status_history_order_idx').on(t.orderId),
    index('order_status_history_facility_idx').on(t.facilityId, t.createdAt),
  ],
);

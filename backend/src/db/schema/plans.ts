import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  unique,
} from 'drizzle-orm/pg-core';

// ── platform_modules ──────────────────────────────────────────────────────
// Seeded catalog of all modules the platform supports.

export const platformModules = pgTable('platform_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Slug used in code: prescriptions, ecommerce, etc.
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── subscription_plans ────────────────────────────────────────────────────

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  // enum: starter | growth | enterprise
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── plan_modules ──────────────────────────────────────────────────────────
// Which modules are included in which subscription plan.

export const planModules = pgTable(
  'plan_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => platformModules.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.planId, t.moduleId)],
);

// ── plan_entitlements ─────────────────────────────────────────────────────
// Quantitative limits bundled with a plan. -1 = unlimited.

export const planEntitlements = pgTable(
  'plan_entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
    // e.g. staff_seats, api_requests_per_day, storage_gb
    resourceKey: text('resource_key').notNull(),
    // -1 = unlimited
    limitValue: integer('limit_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.planId, t.resourceKey)],
);

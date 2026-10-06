import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';
import { platformModules } from './plans';

// ── permissions ───────────────────────────────────────────────────────────
// Atomic authorization units. Seeded from module definitions.
// key format: {module}:{resource}:{action} or {module}:{action}

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // NULL = platform-level permission (not module-scoped)
  moduleId: uuid('module_id').references(() => platformModules.id),
  // e.g. prescriptions:read, ecommerce:orders:cancel
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── facility_roles ────────────────────────────────────────────────────────
// Named collection of permissions, scoped to one facility.
// System roles (is_system_role = true) cannot be deleted via API.

export const facilityRoles = pgTable(
  'facility_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isSystemRole: boolean('is_system_role').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.facilityId, t.name)],
);

// ── facility_role_permissions ─────────────────────────────────────────────
// facility_id denormalised for RLS policy simplicity.

export const facilityRolePermissions = pgTable(
  'facility_role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Denormalised for RLS — matches facilityRoles.facilityId
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => facilityRoles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.roleId, t.permissionId)],
);

// ── facility_users ────────────────────────────────────────────────────────
// User ↔ facility membership with role. One role per user per facility.
// Patients are facility users with the 'patient' system role.

export const facilityUsers = pgTable(
  'facility_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => facilityRoles.id),
    isActive: boolean('is_active').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.facilityId, t.userId)],
);

// ── facility_module_overrides ─────────────────────────────────────────────
// Super admin can force-add or force-remove modules per facility,
// overriding the subscription plan defaults.

export const facilityModuleOverrides = pgTable(
  'facility_module_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => platformModules.id, { onDelete: 'cascade' }),
    // true = force-add, false = force-remove
    enabled: boolean('enabled').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
  },
  (t) => [unique().on(t.facilityId, t.moduleId)],
);

// ── facility_entitlement_overrides ────────────────────────────────────────
// Per-facility override of a plan's quantitative limit.

export const facilityEntitlementOverrides = pgTable(
  'facility_entitlement_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    resourceKey: text('resource_key').notNull(),
    // -1 = unlimited
    limitValue: integer('limit_value').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
  },
  (t) => [unique().on(t.facilityId, t.resourceKey)],
);

// ── facility_usage_records ────────────────────────────────────────────────
// Current usage counters per facility per resource. Updated transactionally.

export const facilityUsageRecords = pgTable(
  'facility_usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    resourceKey: text('resource_key').notNull(),
    currentUsage: integer('current_usage').notNull().default(0),
    // NULL for non-windowed resources; set for e.g. api_requests_per_day
    periodStart: timestamp('period_start', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.facilityId, t.resourceKey, t.periodStart)],
);

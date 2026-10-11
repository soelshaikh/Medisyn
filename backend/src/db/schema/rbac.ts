import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  unique,
  index,
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
    // References vtech-identity.users.id — app-level only, no DB FK (cross-DB)
    createdBy: uuid('created_by').notNull(),
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
    // References vtech-identity.users.id — app-level only, no DB FK (cross-DB)
    createdBy: uuid('created_by').notNull(),
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

// ═══════════════════════════════════════════════════════════════════════════
// ENTERPRISE IDENTITY LAYER — new tables (co-exist with legacy tables above)
// Legacy tables (facility_users, facility_roles, facility_role_permissions)
// are kept for migration compatibility and will be dropped after migration.
// ═══════════════════════════════════════════════════════════════════════════

// ── Role enum ─────────────────────────────────────────────────────────────

export const facilityRoleEnum = pgEnum('facility_role', [
  'facility_admin',
  'pharmacist',
  'pharmacy_technician',
  'staff',
]);

// ── Permission enum ────────────────────────────────────────────────────────
// Minimal set — seed with exact values, expand via migration later.

export const permissionKeyEnum = pgEnum('permission_key', [
  'prescriptions:read',   'prescriptions:write',   'prescriptions:approve',
  'compounding:read',     'compounding:write',      'compounding:approve',
  'appointments:read',    'appointments:write',     'appointments:manage',
  'orders:read',          'orders:write',           'orders:fulfil',
  'patients:read',        'patients:write',
  'inventory:read',       'inventory:write',
  'reports:read',
  'settings:read',        'settings:write',
  'staff:read',           'staff:write',            'staff:manage',
]);

// ── health_professionals ───────────────────────────────────────────────────
// Facility-scoped identity for every non-patient staff member.
// id = health_professional_id (stable, opaque, facility-scoped).
// user_id = FK to vtech-identity.users.id — enforced at application layer only
// (no DB-level FK possible across databases).
// One user = one facility (user_id is globally unique here).

export const healthProfessionals = pgTable(
  'health_professionals',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    // References vtech-identity.users.id — app-level enforcement only
    userId:     uuid('user_id').notNull().unique(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    isActive:   boolean('is_active').notNull().default(true),
    joinedAt:   timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('hp_facility_idx').on(t.facilityId),
    index('hp_user_idx').on(t.userId),
  ],
);

// ── user_roles — one row per role assignment ───────────────────────────────
// A user can hold multiple roles (e.g. pharmacist + staff).
// Roles can be time-limited via expires_at.

export const userRoles = pgTable(
  'user_roles',
  {
    id:                   uuid('id').primaryKey().defaultRandom(),
    healthProfessionalId: uuid('health_professional_id')
      .notNull()
      .references(() => healthProfessionals.id, { onDelete: 'cascade' }),
    role:                 facilityRoleEnum('role').notNull(),
    // user_id from vtech-identity who granted this role (app-level FK)
    grantedBy:            uuid('granted_by'),
    grantedAt:            timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt:            timestamp('expires_at', { withTimezone: true }),
    isActive:             boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique().on(t.healthProfessionalId, t.role),
    index('user_roles_hp_idx').on(t.healthProfessionalId),
  ],
);

// ── role_permissions — what each role can do (seeded) ─────────────────────
// Global defaults — not per-facility. All pharmacists everywhere get the same
// base permissions from their role. User-level overrides go in user_permissions.

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    role:       facilityRoleEnum('role').notNull(),
    permission: permissionKeyEnum('permission').notNull(),
  },
  (t) => [unique().on(t.role, t.permission)],
);

// ── user_permissions — per-user permission overrides ──────────────────────
// granted = TRUE  → extra permission beyond role grants
// granted = FALSE → explicit deny (overrides role grants)

export const userPermissions = pgTable(
  'user_permissions',
  {
    id:                   uuid('id').primaryKey().defaultRandom(),
    healthProfessionalId: uuid('health_professional_id')
      .notNull()
      .references(() => healthProfessionals.id, { onDelete: 'cascade' }),
    permission:           permissionKeyEnum('permission').notNull(),
    // false = explicit deny — overrides anything the role grants
    granted:              boolean('granted').notNull().default(true),
    // user_id from vtech-identity who granted/denied this (app-level FK)
    grantedBy:            uuid('granted_by'),
    grantedAt:            timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt:            timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    unique().on(t.healthProfessionalId, t.permission),
    index('user_perms_hp_idx').on(t.healthProfessionalId),
  ],
);

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as coreSchema from './schema/core';
import * as plansSchema from './schema/plans';
import * as rbacSchema from './schema/rbac';
import * as auditSchema from './schema/audit';
import * as patientSchema from './schema/patient';

const schema = {
  ...coreSchema,
  ...plansSchema,
  ...rbacSchema,
  ...auditSchema,
  ...patientSchema,
};

// ── Regular pool — app_user role, RLS enforced ────────────────────────────
// Used in withTenantContext() for all facility-scoped queries.

const regularClient = postgres(process.env.DATABASE_URL!, {
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(regularClient, { schema });

// ── Super admin pool — app_super_admin role, BYPASSRLS ────────────────────
// Only importable from src/core/super-admin/ (enforced by ESLint).
// Used in superAdminQuery() for cross-facility operations.

const superAdminClient = postgres(process.env.DATABASE_SUPER_ADMIN_URL!, {
  max: Number(process.env.DB_SUPER_ADMIN_POOL_MAX ?? 3),
  idle_timeout: 20,
  connect_timeout: 10,
});

export const superAdminDb = drizzle(superAdminClient, { schema });

// ── Type exports ──────────────────────────────────────────────────────────

export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type SuperAdminTransaction = Parameters<
  Parameters<typeof superAdminDb.transaction>[0]
>[0];

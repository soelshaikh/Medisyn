import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import * as coreSchema from '@/db/schema/core';
import * as plansSchema from '@/db/schema/plans';
import * as rbacSchema from '@/db/schema/rbac';
import * as auditSchema from '@/db/schema/audit';
import * as patientSchema from '@/db/schema/patient';
import * as catalogueSchema from '@/db/schema/catalogue';
import * as commerceSchema from '@/db/schema/commerce';
import * as healthcareSchema from '@/db/schema/healthcare';
import * as appointmentsSchema from '@/db/schema/appointments';

dotenv.config({ path: '.env.test' });
dotenv.config();

const schema = {
  ...coreSchema,
  ...plansSchema,
  ...rbacSchema,
  ...auditSchema,
  ...patientSchema,
  ...catalogueSchema,
  ...commerceSchema,
  ...healthcareSchema,
  ...appointmentsSchema,
};

// ── Test DB client (regular app_user role) ─────────────────────────────

let _regularClient: ReturnType<typeof postgres> | null = null;
let _regularDb: ReturnType<typeof drizzle> | null = null;

export function getTestDb() {
  if (!_regularDb) {
    _regularClient = postgres(process.env.DATABASE_URL!, { max: 5 });
    _regularDb = drizzle(_regularClient, { schema });
  }
  return _regularDb as ReturnType<typeof drizzle<typeof schema>>;
}

// ── Test DB client (super admin role — BYPASSRLS) ──────────────────────

let _superAdminClient: ReturnType<typeof postgres> | null = null;
let _superAdminDb: ReturnType<typeof drizzle> | null = null;

export function getSuperAdminTestDb() {
  if (!_superAdminDb) {
    _superAdminClient = postgres(process.env.DATABASE_SUPER_ADMIN_URL!, { max: 3 });
    _superAdminDb = drizzle(_superAdminClient, { schema });
  }
  return _superAdminDb as ReturnType<typeof drizzle<typeof schema>>;
}

// ── Raw postgres clients (for direct SQL + set_config tests) ───────────

let _rawRegularClient: ReturnType<typeof postgres> | null = null;
let _rawSuperAdminClient: ReturnType<typeof postgres> | null = null;

export function getRawRegularClient() {
  if (!_rawRegularClient) {
    _rawRegularClient = postgres(process.env.DATABASE_URL!, { max: 3 });
  }
  return _rawRegularClient;
}

export function getRawSuperAdminClient() {
  if (!_rawSuperAdminClient) {
    _rawSuperAdminClient = postgres(process.env.DATABASE_SUPER_ADMIN_URL!, { max: 2 });
  }
  return _rawSuperAdminClient;
}

// ── Cleanup ────────────────────────────────────────────────────────────

export async function cleanupTestData(facilityIds: string[]): Promise<void> {
  if (facilityIds.length === 0) return;
  const sa = getSuperAdminTestDb();
  // Cascade delete removes facility_users, sessions, patient_profiles, etc.
  for (const id of facilityIds) {
    await sa.delete(coreSchema.facilities).where(
      (await import('drizzle-orm')).eq(coreSchema.facilities.id, id),
    );
  }
}

export async function closeTestConnections() {
  await _regularClient?.end();
  await _superAdminClient?.end();
  await _rawRegularClient?.end();
  await _rawSuperAdminClient?.end();
}

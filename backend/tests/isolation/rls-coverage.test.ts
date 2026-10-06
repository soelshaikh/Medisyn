/**
 * RLS Coverage Gate Test
 *
 * Verifies every facility-scoped table has:
 *   - rowsecurity = true (ENABLE ROW LEVEL SECURITY applied)
 *   - At least one RLS policy
 *
 * This test connects as app_user_login (regular pool) and queries
 * PostgreSQL system catalogues.
 *
 * Run: npm run test -- tests/isolation/rls-coverage.test.ts
 */
import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
dotenv.config();

// Tables that MUST have RLS enabled (from data-model.md)
const FACILITY_SCOPED_TABLES = [
  'sessions',
  'facility_module_overrides',
  'facility_entitlement_overrides',
  'facility_usage_records',
  'facility_roles',
  'facility_role_permissions',
  'facility_users',
  'audit_log',
  'patient_profiles',
];

// Platform-global tables that must NOT have RLS
const GLOBAL_TABLES = [
  'facilities',
  'users',
  'platform_modules',
  'subscription_plans',
  'plan_modules',
  'plan_entitlements',
  'permissions',
];

describe('RLS Coverage', () => {
  // Use ADMIN URL for schema inspection (pg_tables is accessible to admin role)
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );

  afterAll(async () => {
    await client.end();
  });

  it('every facility-scoped table has RLS enabled', async () => {
    const rows = await client<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY(${FACILITY_SCOPED_TABLES})
    `;

    const byName = Object.fromEntries(rows.map((r) => [r.tablename, r.rowsecurity]));

    for (const table of FACILITY_SCOPED_TABLES) {
      expect(
        byName[table],
        `Table "${table}" must have RLS enabled (rowsecurity = true)`,
      ).toBe(true);
    }
  });

  it('every facility-scoped table has at least one RLS policy', async () => {
    const rows = await client<{ tablename: string; policycount: number }[]>`
      SELECT
        c.relname AS tablename,
        COUNT(p.polname)::int AS policycount
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_policy p ON p.polrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relname = ANY(${FACILITY_SCOPED_TABLES})
      GROUP BY c.relname
    `;

    const byName = Object.fromEntries(rows.map((r) => [r.tablename, r.policycount]));

    for (const table of FACILITY_SCOPED_TABLES) {
      expect(
        byName[table] ?? 0,
        `Table "${table}" must have at least one RLS policy`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('platform-global tables do not have RLS enabled', async () => {
    const rows = await client<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY(${GLOBAL_TABLES})
    `;

    for (const row of rows) {
      expect(
        row.rowsecurity,
        `Platform-global table "${row.tablename}" must NOT have RLS enabled`,
      ).toBe(false);
    }
  });

  it('audit_log UPDATE and DELETE are revoked for app_user', async () => {
    const rows = await client<{ privilege_type: string }[]>`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'audit_log'
        AND grantee = 'app_user'
        AND privilege_type IN ('UPDATE', 'DELETE')
    `;
    expect(
      rows.length,
      'app_user must not have UPDATE or DELETE on audit_log',
    ).toBe(0);
  });

  it('audit_log UPDATE and DELETE are revoked for app_super_admin', async () => {
    const rows = await client<{ privilege_type: string }[]>`
      SELECT privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name = 'audit_log'
        AND grantee = 'app_super_admin'
        AND privilege_type IN ('UPDATE', 'DELETE')
    `;
    expect(
      rows.length,
      'app_super_admin must not have UPDATE or DELETE on audit_log',
    ).toBe(0);
  });
});

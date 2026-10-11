/**
 * Dev-only data reset script.
 * Truncates all operational tables in both vtech-identity and vtech-core.
 * Preserves seed/reference data: plans, modules, entitlements, permissions.
 *
 * Usage:  npx tsx src/scripts/reset-dev-data.ts
 *         npm run db:reset
 */

import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV ?? 'development';
if (NODE_ENV === 'production') {
  console.error('ERROR: This script must not run in production.');
  process.exit(1);
}

// ── vtech-identity ────────────────────────────────────────────────────────
// Tables: users (sessions cascade)

async function resetIdentityDb(): Promise<void> {
  const url = process.env.IDENTITY_DATABASE_URL;
  if (!url) throw new Error('IDENTITY_DATABASE_URL is not set');

  const sql = postgres(url, { max: 1 });
  try {
    // TRUNCATE CASCADE handles sessions automatically (FK to users)
    await sql`TRUNCATE TABLE users CASCADE`;
    console.log('  [vtech-identity] users + sessions truncated');
  } finally {
    await sql.end();
  }
}

// ── vtech-core ────────────────────────────────────────────────────────────
// Truncates operational tables. Preserves:
//   - subscription_plans, plan_modules, plan_entitlements
//   - platform_modules
//   - permissions, role_permissions
//
// Cascade order: facilities → health_professionals/user_roles/user_permissions/
//   patients/patient_profiles/facility_roles/facility_users/
//   facility_module_overrides/facility_entitlement_overrides/
//   facility_usage_records
// Legacy users → sessions (legacy) / facility_users / patient_profiles

async function resetCoreDb(): Promise<void> {
  const url = process.env.DATABASE_SUPER_ADMIN_URL;
  if (!url) throw new Error('DATABASE_SUPER_ADMIN_URL is not set');

  const sql = postgres(url, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      // Legacy vtech-core auth tables (pre-two-DB architecture)
      await tx`TRUNCATE TABLE sessions CASCADE`;
      console.log('  [vtech-core] sessions (legacy) truncated');

      // Facilities cascade-deletes everything scoped to a facility:
      //   health_professionals → user_roles, user_permissions
      //   patients, patient_profiles
      //   facility_roles → facility_role_permissions
      //   facility_users
      //   facility_module_overrides
      //   facility_entitlement_overrides
      //   facility_usage_records
      await tx`TRUNCATE TABLE facilities CASCADE`;
      console.log('  [vtech-core] facilities + all dependent tables truncated');

      // Legacy users table (cascade-deletes any remaining facility_users, patient_profiles)
      await tx`TRUNCATE TABLE users CASCADE`;
      console.log('  [vtech-core] users (legacy) truncated');

      // audit_log (not cascade-dependent on anything we keep)
      await tx`TRUNCATE TABLE audit_log`;
      console.log('  [vtech-core] audit_log truncated');
    });
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  console.log('=== MediSyn dev data reset ===');
  console.log('Seed data (plans, modules, permissions) is preserved.\n');

  console.log('Resetting vtech-identity...');
  await resetIdentityDb();

  console.log('\nResetting vtech-core...');
  await resetCoreDb();

  console.log('\nDone. Re-run seed scripts if you need default plan data:');
  console.log('  npm run db:seed:plans');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

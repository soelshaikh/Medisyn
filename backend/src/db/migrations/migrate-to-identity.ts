/**
 * One-time data migration: vtech-core → vtech-identity
 *
 * Run AFTER:
 *   1. vtech-identity database created
 *   2. `npm run db:migrate:identity` (applies identity schema)
 *   3. `npm run db:migrate` (applies new vtech-core tables: health_professionals, user_roles, etc.)
 *
 * Run: npm run db:migrate:to-identity
 *
 * Idempotent — safe to re-run. Skips rows already migrated (checked via email uniqueness).
 */

import postgres from 'postgres';
import argon2 from 'argon2';
import * as dotenv from 'dotenv';

dotenv.config();

const IDENTITY_URL = process.env.IDENTITY_DATABASE_URL;
const CORE_ADMIN_URL = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;

if (!IDENTITY_URL || !CORE_ADMIN_URL) {
  console.error('Missing IDENTITY_DATABASE_URL or DATABASE_ADMIN_URL in .env');
  process.exit(1);
}

const ROLE_MAP: Record<string, string> = {
  admin:      'facility_admin',
  pharmacist: 'pharmacist',
  staff:      'staff',
  // patient handled separately — goes to patients table
};

// Normalise username: lowercase, strip non-alphanumeric
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Generate a username from email local part: strip special chars
function usernameFromEmail(email: string): string {
  return normalise(email.split('@')[0] ?? email);
}

// Generate a unique username, appending a counter if taken
async function uniqueUsername(
  identity: postgres.Sql,
  base: string,
  facilityPrefix: string | null,
): Promise<{ username: string; normalizedUsername: string }> {
  const prefixed = facilityPrefix ? `${facilityPrefix}${base}` : base;
  let candidate = normalise(prefixed) || 'user';
  let counter = 0;

  while (true) {
    const slug = counter === 0 ? candidate : `${candidate}${counter}`;
    const [existing] = await identity`
      SELECT id FROM users WHERE normalized_username = ${slug} LIMIT 1
    `;
    if (!existing) return { username: slug, normalizedUsername: slug };
    counter++;
  }
}

async function run() {
  const identity = postgres(IDENTITY_URL!, { max: 1 });
  const core     = postgres(CORE_ADMIN_URL!, { max: 1 });

  console.log('\n=== MediSyn Identity Migration ===\n');

  // ── Step 1: Auto-assign prefix to facilities that don't have one ──────────
  console.log('Step 1: Assigning facility prefixes...');

  const facilities = await core`
    SELECT id, slug, prefix FROM facilities ORDER BY created_at
  `;

  for (const fac of facilities) {
    if (fac.prefix) {
      console.log(`  [skip] ${fac.slug} → prefix already set: ${fac.prefix}`);
      continue;
    }

    // Generate prefix from first 3-5 chars of slug (letters only)
    const letters = fac.slug.replace(/[^a-z]/gi, '').toLowerCase();
    let candidatePrefix = letters.slice(0, 3);

    // Ensure uniqueness
    let counter = 0;
    while (true) {
      const slug = counter === 0 ? candidatePrefix : `${candidatePrefix}${counter}`;
      const [taken] = await core`
        SELECT id FROM facilities WHERE prefix = ${slug} AND id != ${fac.id} LIMIT 1
      `;
      if (!taken) { candidatePrefix = slug; break; }
      counter++;
    }

    await core`UPDATE facilities SET prefix = ${candidatePrefix} WHERE id = ${fac.id}`;
    console.log(`  ${fac.slug} → prefix: ${candidatePrefix}`);
  }

  // ── Step 2: Migrate vtech-core.users → vtech-identity.users ──────────────
  console.log('\nStep 2: Migrating users to vtech-identity...');

  const coreUsers = await core`
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.first_name,
      u.last_name,
      u.is_platform_super_admin,
      u.auth_version,
      u.email_verified,
      u.email_verify_token,
      u.email_verify_expires_at,
      u.password_reset_token,
      u.password_reset_expires_at,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      -- Determine account type from facility_users join
      CASE
        WHEN u.is_platform_super_admin THEN 'super_admin'
        WHEN EXISTS (
          SELECT 1 FROM facility_users fu
          JOIN facility_roles fr ON fr.id = fu.role_id
          WHERE fu.user_id = u.id AND fr.name = 'patient'
        ) THEN 'patient'
        ELSE 'facility_user'
      END AS account_type,
      -- Get facility prefix for non-super-admins
      (
        SELECT f.prefix
        FROM facility_users fu
        JOIN facilities f ON f.id = fu.facility_id
        WHERE fu.user_id = u.id
        LIMIT 1
      ) AS facility_prefix
    FROM users u
    ORDER BY u.created_at
  `;

  let migratedUsers = 0;
  let skippedUsers  = 0;

  for (const u of coreUsers) {
    // Skip if already in identity DB
    const [existing] = await identity`
      SELECT id FROM users WHERE id = ${u.id} LIMIT 1
    `;
    if (existing) { skippedUsers++; continue; }

    const { username, normalizedUsername } = await uniqueUsername(
      identity,
      usernameFromEmail(u.email),
      u.account_type === 'super_admin' ? null : (u.facility_prefix ?? null),
    );

    await identity`
      INSERT INTO users (
        id, email, username, normalized_username, password_hash,
        first_name, last_name, account_type, facility_prefix,
        email_verified, email_verify_token, email_verify_expires_at,
        password_reset_token, password_reset_expires_at,
        is_active, auth_version, last_login_at, created_at, updated_at
      ) VALUES (
        ${u.id},
        ${u.email},
        ${username},
        ${normalizedUsername},
        ${u.password_hash},
        ${u.first_name},
        ${u.last_name},
        ${u.account_type}::account_type,
        ${u.facility_prefix ?? null},
        ${u.email_verified},
        ${u.email_verify_token ?? null},
        ${u.email_verify_expires_at ?? null},
        ${u.password_reset_token ?? null},
        ${u.password_reset_expires_at ?? null},
        true,
        ${u.auth_version},
        ${u.last_login_at ?? null},
        ${u.created_at},
        ${u.updated_at}
      )
    `;
    migratedUsers++;
    console.log(`  [user] ${u.email} → ${username} (${u.account_type})`);
  }

  console.log(`  Done: ${migratedUsers} migrated, ${skippedUsers} already in identity DB.`);

  // ── Step 3: Create health_professionals from facility_users (non-patient) ──
  console.log('\nStep 3: Creating health_professionals...');

  const staffLinks = await core`
    SELECT
      fu.id,
      fu.user_id,
      fu.facility_id,
      fu.is_active,
      fu.joined_at,
      fr.name AS role_name
    FROM facility_users fu
    JOIN facility_roles fr ON fr.id = fu.role_id
    WHERE fr.name != 'patient'
    ORDER BY fu.joined_at
  `;

  let migratedHPs = 0;

  for (const link of staffLinks) {
    const [existing] = await core`
      SELECT id FROM health_professionals WHERE user_id = ${link.user_id} LIMIT 1
    `;
    if (existing) continue;

    await core`
      INSERT INTO health_professionals (user_id, facility_id, is_active, joined_at, updated_at)
      VALUES (${link.user_id}, ${link.facility_id}, ${link.is_active}, ${link.joined_at}, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `;
    migratedHPs++;
  }

  console.log(`  Done: ${migratedHPs} health_professionals created.`);

  // ── Step 4: Create user_roles from facility_users role assignments ─────────
  console.log('\nStep 4: Creating user_roles...');

  let migratedRoles = 0;

  for (const link of staffLinks) {
    const mappedRole = ROLE_MAP[link.role_name];
    if (!mappedRole) {
      console.log(`  [skip] Unknown role: ${link.role_name}`);
      continue;
    }

    const [hp] = await core`
      SELECT id FROM health_professionals WHERE user_id = ${link.user_id} LIMIT 1
    `;
    if (!hp) continue;

    await core`
      INSERT INTO user_roles (health_professional_id, role, is_active, granted_at)
      VALUES (${hp.id}, ${mappedRole}::facility_role, ${link.is_active}, ${link.joined_at})
      ON CONFLICT (health_professional_id, role) DO NOTHING
    `;
    migratedRoles++;
  }

  console.log(`  Done: ${migratedRoles} role rows created.`);

  // ── Step 5: Create patients from facility_users with patient role ──────────
  console.log('\nStep 5: Creating patients...');

  const patientLinks = await core`
    SELECT
      fu.user_id,
      fu.facility_id,
      fu.joined_at,
      pp.date_of_birth,
      pp.health_card_number_encrypted,
      pp.health_card_province,
      pp.address_line1,
      pp.address_line2,
      pp.city,
      pp.province,
      pp.postal_code,
      pp.allergies,
      pp.medical_notes
    FROM facility_users fu
    JOIN facility_roles fr ON fr.id = fu.role_id
    LEFT JOIN patient_profiles pp ON pp.user_id = fu.user_id AND pp.facility_id = fu.facility_id
    WHERE fr.name = 'patient'
    ORDER BY fu.joined_at
  `;

  let migratedPatients = 0;

  for (const p of patientLinks) {
    await core`
      INSERT INTO patients (
        user_id, facility_id,
        date_of_birth, health_card_number_encrypted, health_card_province,
        address_line1, address_line2, city, province, postal_code,
        allergies, medical_notes,
        created_at, updated_at
      ) VALUES (
        ${p.user_id}, ${p.facility_id},
        ${p.date_of_birth ?? null},
        ${p.health_card_number_encrypted ?? null},
        ${p.health_card_province ?? null},
        ${p.address_line1 ?? null}, ${p.address_line2 ?? null},
        ${p.city ?? null}, ${p.province ?? null}, ${p.postal_code ?? null},
        ${p.allergies ?? null}, ${p.medical_notes ?? null},
        ${p.joined_at}, NOW()
      )
      ON CONFLICT (user_id, facility_id) DO NOTHING
    `;
    migratedPatients++;
  }

  console.log(`  Done: ${migratedPatients} patient rows created.`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Migration complete ===');
  console.log(`  Users migrated  : ${migratedUsers}`);
  console.log(`  Users skipped   : ${skippedUsers}`);
  console.log(`  Health profs    : ${migratedHPs}`);
  console.log(`  Roles assigned  : ${migratedRoles}`);
  console.log(`  Patients created: ${migratedPatients}`);
  console.log('\nNext steps:');
  console.log('  1. Verify data in both databases');
  console.log('  2. Update backend to use identityDb for auth');
  console.log('  3. Run smoke tests');
  console.log('  4. Drop legacy tables: facility_users, facility_roles, facility_role_permissions');
  console.log('');

  await identity.end();
  await core.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

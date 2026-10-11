/**
 * Creates a super admin account in vtech-identity.
 *
 * Usage:
 *   npm run create-super-admin
 *   npm run create-super-admin -- --email admin@medisyn.ca --password Admin1234! --firstName Admin --lastName User
 */

import * as argon2 from 'argon2';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { identityUsers } from '../db/schema/identity';
import * as dotenv from 'dotenv';

dotenv.config();

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? (process.argv[idx + 1] ?? fallback) : fallback;
}

async function main() {
  const email     = parseArg('email',     'admin@medisyn.ca');
  const password  = parseArg('password',  'Admin1234!');
  const firstName = parseArg('firstName', 'Admin');
  const lastName  = parseArg('lastName',  'User');

  const url = process.env.IDENTITY_DATABASE_URL;
  if (!url) throw new Error('IDENTITY_DATABASE_URL is not set in .env');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema: { identityUsers } });

  const [existing] = await db
    .select({ id: identityUsers.id, accountType: identityUsers.accountType })
    .from(identityUsers)
    .where(eq(identityUsers.email, email))
    .limit(1);

  if (existing) {
    if (existing.accountType === 'super_admin') {
      console.log(`Super admin already exists: ${email} (id: ${existing.id})`);
    } else {
      console.log(`ERROR: ${email} exists but is not a super_admin (accountType: ${existing.accountType})`);
      console.log('Use db:reset to clear all data and start fresh.');
      process.exit(1);
    }
    await client.end();
    return;
  }

  const passwordHash = await argon2.hash(password);

  // username for super admin = email local part (no facility prefix)
  const emailLocal = email.split('@')[0] ?? email;
  const username   = emailLocal.toLowerCase().replace(/[^a-z0-9]/g, '');

  const [created] = await db
    .insert(identityUsers)
    .values({
      email,
      username,
      normalizedUsername: username,
      passwordHash,
      firstName,
      lastName,
      accountType:   'super_admin',
      facilityPrefix: null,
      emailVerified: true,
    })
    .returning({ id: identityUsers.id });

  console.log(`Super admin created in vtech-identity:`);
  console.log(`  ID:       ${created!.id}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Username: ${username}`);
  console.log(`  Name:     ${firstName} ${lastName}`);
  console.log(`\nLog in at: POST /api/v1/auth/super-admin/login`);
  console.log(`  { "email": "${email}", "password": "${password}" }`);

  await client.end();
}

main().catch((err) => {
  console.error('Failed to create super admin:', err);
  process.exit(1);
});

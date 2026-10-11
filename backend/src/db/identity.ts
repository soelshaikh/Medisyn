import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as identitySchema from './schema/identity';

dotenv.config();

// ── Identity DB — vtech-identity database ─────────────────────────────────
// Stores ALL user accounts + sessions, independent of any facility tenant.
// No RLS — access control is enforced at the application layer.

const identityClient = postgres(process.env.IDENTITY_DATABASE_URL!, {
  max:             Number(process.env.IDENTITY_DB_POOL_MAX ?? 10),
  idle_timeout:    20,
  connect_timeout: 10,
});

export const identityDb = drizzle(identityClient, { schema: identitySchema });

export type IdentityTransaction = Parameters<
  Parameters<typeof identityDb.transaction>[0]
>[0];

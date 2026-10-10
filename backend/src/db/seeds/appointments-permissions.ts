import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { platformModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import * as dotenv from 'dotenv';

dotenv.config();

const APPOINTMENTS_PERMISSIONS = [
  { key: 'appointments.read',   name: 'View Appointments' },
  { key: 'appointments.manage', name: 'Manage Appointments' },
] as const;

export async function seedAppointmentsPermissions() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding appointments permissions...');

  const [apptMod] = await db
    .select({ id: platformModules.id })
    .from(platformModules)
    .where(eq(platformModules.key, 'appointments'))
    .limit(1);

  if (!apptMod) {
    throw new Error('appointments platform module not found — run db:seed first');
  }

  for (const perm of APPOINTMENTS_PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ moduleId: apptMod.id, key: perm.key, name: perm.name })
      .onConflictDoUpdate({
        target: permissions.key,
        set: { name: perm.name },
      });
  }

  console.log('Appointments permissions seeded.');
  await client.end();
}

if (require.main === module) {
  seedAppointmentsPermissions().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { platformModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import * as dotenv from 'dotenv';

dotenv.config();

const REPORTS_PERMISSIONS = [
  { moduleKey: 'platform_admin', key: 'reports.read', name: 'View Reports & Dashboard' },
] as const;

export async function seedReportsPermissions() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding reports permissions...');

  await db
    .insert(platformModules)
    .values({ key: 'platform_admin', name: 'Platform Admin' })
    .onConflictDoUpdate({
      target: platformModules.key,
      set: { name: 'Platform Admin' },
    });

  for (const perm of REPORTS_PERMISSIONS) {
    const [mod] = await db
      .select({ id: platformModules.id })
      .from(platformModules)
      .where(eq(platformModules.key, perm.moduleKey))
      .limit(1);

    if (!mod) {
      throw new Error(`Platform module '${perm.moduleKey}' not found`);
    }

    await db
      .insert(permissions)
      .values({ moduleId: mod.id, key: perm.key, name: perm.name })
      .onConflictDoUpdate({
        target: permissions.key,
        set: { name: perm.name },
      });
  }

  console.log('Reports permissions seeded.');
  await client.end();
}

if (require.main === module) {
  seedReportsPermissions().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

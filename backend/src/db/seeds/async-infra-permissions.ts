import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { platformModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import * as dotenv from 'dotenv';

dotenv.config();

const ASYNC_INFRA_PERMISSIONS = [
  { moduleKey: 'platform_admin', key: 'email_log.read',          name: 'View Email Log' },
  { moduleKey: 'platform_admin', key: 'email_log.retry',         name: 'Retry Failed Emails' },
  { moduleKey: 'platform_admin', key: 'notifications.broadcast', name: 'Broadcast Notifications' },
] as const;

export async function seedAsyncInfraPermissions() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding async-infra permissions...');

  // Ensure the platform_admin module exists (admin tools are not per-facility features)
  await db
    .insert(platformModules)
    .values({ key: 'platform_admin', name: 'Platform Admin' })
    .onConflictDoUpdate({
      target: platformModules.key,
      set: { name: 'Platform Admin' },
    });

  for (const perm of ASYNC_INFRA_PERMISSIONS) {
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

  console.log('Async-infra permissions seeded.');
  await client.end();
}

if (require.main === module) {
  seedAsyncInfraPermissions().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

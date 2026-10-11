import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { platformModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import * as dotenv from 'dotenv';

dotenv.config();

const FILE_STORAGE_PERMISSIONS = [
  { moduleKey: 'platform_admin', key: 'files.upload', name: 'Upload Files' },
  { moduleKey: 'platform_admin', key: 'files.download', name: 'Download / View Files' },
] as const;

export async function seedFileStoragePermissions() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding file storage permissions...');

  await db
    .insert(platformModules)
    .values({ key: 'platform_admin', name: 'Platform Admin' })
    .onConflictDoUpdate({
      target: platformModules.key,
      set: { name: 'Platform Admin' },
    });

  for (const perm of FILE_STORAGE_PERMISSIONS) {
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

  console.log('File storage permissions seeded.');
  await client.end();
}

if (require.main === module) {
  seedFileStoragePermissions().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

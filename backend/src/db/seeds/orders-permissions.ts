import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { platformModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import * as dotenv from 'dotenv';

dotenv.config();

const ORDERS_PERMISSIONS = [
  { key: 'orders.read',                name: 'View Orders' },
  { key: 'orders.manage',              name: 'Manage Orders' },
  { key: 'shipping-methods.manage',    name: 'Manage Shipping Methods' },
] as const;

export async function seedOrdersPermissions() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding orders/shipping permissions...');

  const [ecMod] = await db
    .select({ id: platformModules.id })
    .from(platformModules)
    .where(eq(platformModules.key, 'ecommerce'))
    .limit(1);

  if (!ecMod) {
    throw new Error('ecommerce platform module not found — run db:seed first');
  }

  for (const perm of ORDERS_PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ moduleId: ecMod.id, key: perm.key, name: perm.name })
      .onConflictDoUpdate({
        target: permissions.key,
        set: { name: perm.name },
      });
  }

  console.log('Orders permissions seeded.');
  await client.end();
}

if (require.main === module) {
  seedOrdersPermissions().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

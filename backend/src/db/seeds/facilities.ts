import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { facilities } from '../schema/core';
import { subscriptionPlans } from '../schema/plans';
import * as dotenv from 'dotenv';

dotenv.config();

const TEST_FACILITIES = [
  { name: 'Test Pharmacy', slug: 'test-pharmacy', status: 'active' },
  { name: 'Suspended Pharmacy', slug: 'suspended-pharmacy', status: 'suspended' },
  { name: 'Second Pharmacy', slug: 'second-pharmacy', status: 'active' },
] as const;

export async function seedTestFacilities() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  // Ensure a subscription plan exists (starter plan used by all test facilities)
  await db
    .insert(subscriptionPlans)
    .values({ key: 'starter', name: 'Starter' })
    .onConflictDoUpdate({ target: subscriptionPlans.key, set: { name: 'Starter' } });

  const [starterPlan] = await db
    .select({ id: subscriptionPlans.id })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.key, 'starter'))
    .limit(1);

  if (!starterPlan) throw new Error('Failed to create starter plan');

  for (const f of TEST_FACILITIES) {
    await db
      .insert(facilities)
      .values({
        name: f.name,
        slug: f.slug,
        status: f.status,
        subscriptionPlanId: starterPlan.id,
        settings: {},
      })
      .onConflictDoNothing();
  }

  console.log('Test facilities seeded:', TEST_FACILITIES.map((f) => f.slug).join(', '));
  await client.end();
}

if (require.main === module) {
  seedTestFacilities().catch((err) => {
    console.error('Facility seed failed:', err);
    process.exit(1);
  });
}

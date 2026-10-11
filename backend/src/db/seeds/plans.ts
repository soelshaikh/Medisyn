import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { platformModules, subscriptionPlans, planModules, planEntitlements } from '../schema/plans';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Module catalog ─────────────────────────────────────────────────────────

const MODULES = [
  {
    key: 'ask_pharmacist',
    name: 'Ask a Pharmacist',
    description: 'Async pharmacist consultations via chat',
  },
  {
    key: 'appointments',
    name: 'Appointments',
    description: 'Vaccine and service appointment booking with availability management',
  },
  {
    key: 'compounding',
    name: 'Compounding',
    description: 'Custom compound prescription requests and tracking',
  },
  {
    key: 'ecommerce',
    name: 'Ecommerce',
    description: 'Online product catalogue, cart and order management',
  },
  {
    key: 'minor_ailments',
    name: 'Minor Ailments',
    description: 'Minor ailment assessment and pharmacist-initiated treatment',
  },
  {
    key: 'prescriptions',
    name: 'Prescriptions',
    description: 'Prescription renewal, management and dispensing workflow',
  },
  {
    key: 'stock_management',
    name: 'Stock Management',
    description: 'Inventory tracking, low-stock alerts and near-expiry management',
  },
] as const;

// ── Plan definitions ───────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    description:
      'Core prescription and pharmacist services. Ideal for independent pharmacies getting started with digital workflows.',
    modules: ['prescriptions', 'ask_pharmacist', 'minor_ailments'],
  },
  {
    key: 'growth',
    name: 'Growth',
    description:
      'Full-service platform with ecommerce, compounding and advanced appointment booking for growing pharmacies.',
    modules: [
      'prescriptions',
      'ask_pharmacist',
      'minor_ailments',
      'compounding',
      'appointments',
      'ecommerce',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description:
      'Complete platform access including stock management and all current and future modules.',
    modules: [
      'prescriptions',
      'ask_pharmacist',
      'minor_ailments',
      'compounding',
      'appointments',
      'ecommerce',
      'stock_management',
    ],
  },
] as const;

// ── Seed function ──────────────────────────────────────────────────────────

export async function seedPlans() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding platform modules...');

  for (const mod of MODULES) {
    await db
      .insert(platformModules)
      .values({ key: mod.key, name: mod.name, description: mod.description })
      .onConflictDoUpdate({
        target: platformModules.key,
        set: { name: mod.name, description: mod.description },
      });
  }

  console.log('Seeding subscription plans...');

  for (const plan of PLANS) {
    await db
      .insert(subscriptionPlans)
      .values({ key: plan.key, name: plan.name, description: plan.description })
      .onConflictDoUpdate({
        target: subscriptionPlans.key,
        set: { name: plan.name, description: plan.description },
      });
  }

  const allModules = await db.select().from(platformModules);
  const allPlans   = await db.select().from(subscriptionPlans);

  const moduleByKey = Object.fromEntries(allModules.map((m) => [m.key, m]));
  const planByKey   = Object.fromEntries(allPlans.map((p) => [p.key, p]));

  console.log('Linking plan modules...');

  for (const plan of PLANS) {
    const planRow = planByKey[plan.key];
    if (!planRow) continue;

    for (const moduleKey of plan.modules) {
      const modRow = moduleByKey[moduleKey];
      if (!modRow) continue;
      await db
        .insert(planModules)
        .values({ planId: planRow.id, moduleId: modRow.id })
        .onConflictDoNothing();
    }
  }

  console.log('Seeding plan seat entitlements...');

  const SEAT_ENTITLEMENTS = [
    { resourceKey: 'admin_seats',       limitValue: 1 },
    { resourceKey: 'staff_seats',       limitValue: 5 },
    { resourceKey: 'pharmacist_seats',  limitValue: 5 },
  ] as const;

  for (const plan of allPlans) {
    for (const ent of SEAT_ENTITLEMENTS) {
      await db
        .insert(planEntitlements)
        .values({ planId: plan.id, resourceKey: ent.resourceKey, limitValue: ent.limitValue })
        .onConflictDoUpdate({
          target: [planEntitlements.planId, planEntitlements.resourceKey],
          set: { limitValue: ent.limitValue },
        });
    }
  }

  console.log('');
  console.log('Plans seeded:');
  for (const plan of PLANS) {
    console.log(`  [${plan.key}] ${plan.name} — modules: ${plan.modules.join(', ')}`);
  }
  console.log('  Seat entitlements: 1 admin, 5 staff, 5 pharmacist (per plan)');
  console.log('');
  console.log('Done. You can now create facilities and assign them a plan.');

  await client.end();
}

if (require.main === module) {
  seedPlans().catch((err) => {
    console.error('Plans seed failed:', err);
    process.exit(1);
  });
}

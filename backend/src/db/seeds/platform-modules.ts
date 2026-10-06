import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { platformModules, subscriptionPlans, planModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import * as dotenv from 'dotenv';

dotenv.config();

const MODULES = [
  { key: 'ask_pharmacist', name: 'Ask a Pharmacist' },
  { key: 'appointments', name: 'Appointments' },
  { key: 'compounding', name: 'Compounding' },
  { key: 'ecommerce', name: 'Ecommerce' },
  { key: 'minor_ailments', name: 'Minor Ailments' },
  { key: 'prescriptions', name: 'Prescriptions' },
  { key: 'stock_management', name: 'Stock Management' },
] as const;

const PLANS = [
  { key: 'starter', name: 'Starter' },
  { key: 'growth', name: 'Growth' },
  { key: 'enterprise', name: 'Enterprise' },
] as const;

// Starter includes: prescriptions, ask_pharmacist, minor_ailments
const STARTER_MODULES = ['prescriptions', 'ask_pharmacist', 'minor_ailments'];

// Growth adds: compounding, appointments, ecommerce
const GROWTH_MODULES = [...STARTER_MODULES, 'compounding', 'appointments', 'ecommerce'];

// Enterprise adds: stock_management
const ENTERPRISE_MODULES = [...GROWTH_MODULES, 'stock_management'];

const PLAN_MODULE_MAP: Record<string, string[]> = {
  starter: STARTER_MODULES,
  growth: GROWTH_MODULES,
  enterprise: ENTERPRISE_MODULES,
};

export async function seedPlatformData() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding platform modules...');

  // Seed modules (idempotent)
  for (const mod of MODULES) {
    await db
      .insert(platformModules)
      .values({ key: mod.key, name: mod.name })
      .onConflictDoUpdate({
        target: platformModules.key,
        set: { name: mod.name },
      });
  }

  // Seed plans (idempotent)
  for (const plan of PLANS) {
    await db
      .insert(subscriptionPlans)
      .values({ key: plan.key, name: plan.name })
      .onConflictDoUpdate({
        target: subscriptionPlans.key,
        set: { name: plan.name },
      });
  }

  // Seed plan↔module links (idempotent via ON CONFLICT DO NOTHING)
  const allModules = await db.select().from(platformModules);
  const allPlans = await db.select().from(subscriptionPlans);

  const moduleByKey = Object.fromEntries(allModules.map((m) => [m.key, m]));
  const planByKey = Object.fromEntries(allPlans.map((p) => [p.key, p]));

  for (const [planKey, moduleKeys] of Object.entries(PLAN_MODULE_MAP)) {
    for (const moduleKey of moduleKeys) {
      const plan = planByKey[planKey];
      const mod = moduleByKey[moduleKey];
      if (!plan || !mod) continue;
      await db
        .insert(planModules)
        .values({ planId: plan.id, moduleId: mod.id })
        .onConflictDoNothing();
    }
  }

  // Seed baseline permissions (one per module: read + write)
  for (const mod of allModules) {
    for (const action of ['read', 'write'] as const) {
      const key = `${mod.key}:${action}`;
      await db
        .insert(permissions)
        .values({
          moduleId: mod.id,
          key,
          name: `${mod.name} — ${action}`,
        })
        .onConflictDoUpdate({
          target: permissions.key,
          set: { name: `${mod.name} — ${action}` },
        });
    }
  }

  console.log('Seeding complete.');
  await client.end();
}

// Run if called directly
if (require.main === module) {
  seedPlatformData().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

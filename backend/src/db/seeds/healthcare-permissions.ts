import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { platformModules } from '../schema/plans';
import { permissions } from '../schema/rbac';
import { facilities } from '../schema/core';
import { minorAilmentCatalog } from '../schema/healthcare';
import * as dotenv from 'dotenv';

dotenv.config();

const HEALTHCARE_PERMISSIONS = [
  { key: 'prescriptions.read',       name: 'View Prescriptions' },
  { key: 'prescriptions.manage',     name: 'Manage Prescriptions' },
  { key: 'compounding.read',         name: 'View Compounding Requests' },
  { key: 'compounding.manage',       name: 'Manage Compounding Requests' },
  { key: 'minor-ailments.read',      name: 'View Minor Ailment Assessments' },
  { key: 'minor-ailments.manage',    name: 'Manage Minor Ailments' },
  { key: 'ask-pharmacist.read',      name: 'View Pharmacist Conversations' },
  { key: 'ask-pharmacist.manage',    name: 'Manage Pharmacist Conversations' },
] as const;

// Ontario 19-ailment model
const ONTARIO_AILMENTS = [
  { name: 'Acne',                                     description: 'Inflammatory skin condition affecting the face, back, and chest.', displayOrder: 0 },
  { name: 'Allergic Rhinitis',                        description: 'Nasal symptoms triggered by allergens such as pollen, dust mites, or pet dander.', displayOrder: 1 },
  { name: 'Oral Candidiasis (Thrush)',                description: 'Fungal infection in the mouth causing white patches on the tongue and inner cheeks.', displayOrder: 2 },
  { name: 'Conjunctivitis (Pink Eye)',                description: 'Inflammation or infection of the conjunctiva causing redness and discharge.', displayOrder: 3 },
  { name: 'Contact Dermatitis',                       description: 'Skin inflammation caused by contact with an irritant or allergen.', displayOrder: 4 },
  { name: 'Dysmenorrhea (Menstrual Cramps)',          description: 'Painful menstrual periods not caused by an underlying condition.', displayOrder: 5 },
  { name: 'Gastroesophageal Reflux Disease (GERD)',   description: 'Chronic acid reflux causing heartburn and regurgitation.', displayOrder: 6 },
  { name: 'Hemorrhoids',                              description: 'Swollen veins in the rectum or anus causing discomfort or bleeding.', displayOrder: 7 },
  { name: 'Herpes Labialis (Cold Sores)',             description: 'Viral infection causing blisters on or around the lips.', displayOrder: 8 },
  { name: 'Impetigo',                                 description: 'Highly contagious bacterial skin infection causing sores and crusts.', displayOrder: 9 },
  { name: 'Insect Bites and Stings',                  description: 'Localized reactions from insect bites or stings.', displayOrder: 10 },
  { name: 'Musculoskeletal Sprains and Strains',      description: 'Injuries to muscles, ligaments, or tendons from overuse or sudden movement.', displayOrder: 11 },
  { name: 'Tick Bites',                               description: 'Bites from ticks requiring assessment for Lyme disease risk.', displayOrder: 12 },
  { name: 'Uncomplicated Urinary Tract Infection',    description: 'Bacterial infection of the bladder in women without complicating factors.', displayOrder: 13 },
  { name: 'Urticaria (Hives)',                        description: 'Raised, itchy welts on the skin triggered by allergic reactions or other factors.', displayOrder: 14 },
  { name: 'Herpes Zoster (Shingles)',                 description: 'Painful rash caused by reactivation of the varicella-zoster virus.', displayOrder: 15 },
  { name: 'Nausea and Vomiting of Pregnancy',        description: 'Morning sickness and associated symptoms during pregnancy.', displayOrder: 16 },
  { name: 'Pinworms/Threadworms',                     description: 'Intestinal parasitic infection causing perianal itching.', displayOrder: 17 },
  { name: 'Eczema (Atopic Dermatitis)',               description: 'Chronic inflammatory skin condition causing dry, itchy patches.', displayOrder: 18 },
] as const;

export async function seedHealthcarePermissions() {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  console.log('Seeding healthcare permissions...');

  const [hcMod] = await db
    .select({ id: platformModules.id })
    .from(platformModules)
    .where(eq(platformModules.key, 'healthcare'))
    .limit(1);

  if (!hcMod) {
    throw new Error('healthcare platform module not found — run db:seed first');
  }

  for (const perm of HEALTHCARE_PERMISSIONS) {
    await db
      .insert(permissions)
      .values({ moduleId: hcMod.id, key: perm.key, name: perm.name })
      .onConflictDoUpdate({
        target: permissions.key,
        set: { name: perm.name },
      });
  }

  console.log('Healthcare permissions seeded.');

  // Seed Ontario 19 ailments for each existing facility
  console.log('Seeding Ontario minor ailment catalog for all facilities...');

  const allFacilities = await db
    .select({ id: facilities.id })
    .from(facilities);

  for (const facility of allFacilities) {
    for (const ailment of ONTARIO_AILMENTS) {
      await db
        .insert(minorAilmentCatalog)
        .values({
          facilityId: facility.id,
          name: ailment.name,
          description: ailment.description,
          isActive: true,
          displayOrder: ailment.displayOrder,
        })
        .onConflictDoNothing();
    }
  }

  console.log(`Minor ailment catalog seeded for ${allFacilities.length} facility/facilities.`);
  await client.end();
}

if (require.main === module) {
  seedHealthcarePermissions().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

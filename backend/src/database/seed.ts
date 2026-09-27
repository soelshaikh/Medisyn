import "dotenv/config";
import mongoose from "mongoose";
import argon2 from "argon2";
import { config } from "@/config";
import { PermissionModel } from "@/modules/permissions/permissions.schema";
import { RoleModel } from "@/modules/roles/roles.schema";
import { UserModel } from "@/modules/users/users.schema";
import { PERMISSION_CATALOG, ALL_PERMISSION_KEYS } from "@/modules/permissions/permissions.catalog";
import { VaccineServiceModel } from "@/modules/vaccine-services/vaccine-services.schema";
import { AilmentCatalogModel } from "@/modules/minor-ailments/ailment-catalog.schema";
import { AskPharmacistTopicModel } from "@/modules/ask-pharmacist/ask-pharmacist-topics.schema";

async function seed() {
  console.log("🌱  Connecting to MongoDB...");
  await mongoose.connect(config.MONGODB_URI, { dbName: "Medisyn" });
  console.log("✅  Connected");

  /* ── 1. Seed permissions ── */
  console.log("🔑  Seeding permissions...");
  for (const perm of PERMISSION_CATALOG) {
    await PermissionModel.updateOne({ key: perm.key }, { $set: perm }, { upsert: true });
  }
  console.log(`   ${PERMISSION_CATALOG.length} permissions seeded`);

  /* ── 2. Seed default roles ── */
  console.log("👥  Seeding roles...");

  const roles = [
    {
      slug: "admin",
      name: "Admin",
      description: "Full platform access",
      permissions: ALL_PERMISSION_KEYS,
      isSystem: true,
    },
    {
      slug: "pharmacist",
      name: "Pharmacist",
      description: "Pharmacist — manage prescriptions, compounding, appointments",
      permissions: [
        "prescriptions.read", "prescriptions.update", "prescriptions.status.update",
        "prescriptions.files.read", "prescriptions.assign", "prescriptions.notes",
        "compounding.read", "compounding.update", "compounding.status.update",
        "compounding.files.read", "compounding.assign", "compounding.notes",
        "ask-pharmacist.read", "ask-pharmacist.respond", "ask-pharmacist.status.update",
        "ask-pharmacist.assign", "ask-pharmacist.notes",
        "minor-ailments.requests.read", "minor-ailments.requests.update",
        "appointments.read", "appointments.update", "appointments.status.update",
        "appointments.availability.read",
        "orders.read", "orders.status.update",
        "users.read",
        "notifications.read",
      ],
      isSystem: true,
    },
    {
      slug: "staff",
      name: "Staff",
      description: "General staff — order management, basic operations",
      permissions: [
        "orders.read", "orders.update", "orders.status.update",
        "prescriptions.read", "prescriptions.status.update",
        "compounding.read", "compounding.status.update",
        "appointments.read", "appointments.status.update",
        "users.read",
        "products.read", "inventory.read",
        "notifications.read",
      ],
      isSystem: true,
    },
    {
      slug: "content_manager",
      name: "Content Manager",
      description: "Manage website content, FAQs, pages",
      permissions: [
        "content.faqs.read", "content.faqs.manage",
        "content.pages.manage",
        "products.read", "categories.read",
      ],
      isSystem: true,
    },
  ];

  for (const role of roles) {
    await RoleModel.updateOne({ slug: role.slug }, { $set: role }, { upsert: true });
  }
  console.log(`   ${roles.length} roles seeded`);

  /* ── 3. Seed admin user ── */
  if (config.SEED_ADMIN_EMAIL && config.SEED_ADMIN_PASSWORD) {
    console.log("👤  Seeding admin user...");
    const adminRole = await RoleModel.findOne({ slug: "admin" });
    const exists = await UserModel.findOne({ email: config.SEED_ADMIN_EMAIL });

    const passwordHash = await argon2.hash(config.SEED_ADMIN_PASSWORD);
    if (!exists) {
      await UserModel.create({
        email:         config.SEED_ADMIN_EMAIL,
        passwordHash,
        fullName:      config.SEED_ADMIN_NAME ?? "MediSyn Admin",
        role:          "patient",
        roles:         adminRole ? [adminRole._id] : [],
        status:        "active",
        emailVerified: true,
      });
      console.log(`   Admin created: ${config.SEED_ADMIN_EMAIL}`);
    } else {
      await UserModel.findByIdAndUpdate(exists._id, { passwordHash, status: "active", emailVerified: true, roles: adminRole ? [adminRole._id] : exists.roles });
      console.log(`   Admin password updated: ${config.SEED_ADMIN_EMAIL}`);
    }
  }

  /* ── 4. Seed vaccine services ── */
  console.log("💉  Seeding vaccine services...");
  const vaccines = [
    {
      name:             "COVID-19",
      slug:             "covid-19",
      description:      "COVID-19 vaccine (updated formulation). Protects against severe illness and complications.",
      eligibilityNotes: "Free for everyone aged 6 months and older who lives, works, or goes to school in Ontario. Provincial health card accepted. Bring your immunization record if available.",
      durationMinutes:  15,
      sortOrder:        0,
      status:           "active",
    },
    {
      name:             "Influenza (Flu)",
      slug:             "influenza-flu",
      description:      "Annual seasonal flu vaccine. Recommended every year to protect against the most current influenza strains.",
      eligibilityNotes: "Free for everyone aged 2 and older. Provincial health card accepted. Not recommended if you have a severe egg allergy — speak with the pharmacist first.",
      durationMinutes:  15,
      sortOrder:        1,
      status:           "active",
    },
    {
      name:             "Shingles",
      slug:             "shingles",
      description:      "Vaccine that protects against shingles (herpes zoster) and its painful complications, including post-herpetic neuralgia.",
      eligibilityNotes: "Free for adults 65–70, but administered through a primary care provider or public health unit. Pharmacists may administer with a prescription for a fee. Two-dose series required.",
      durationMinutes:  20,
      sortOrder:        2,
      status:           "active",
    },
    {
      name:             "RSV (Respiratory Syncytial Virus)",
      slug:             "rsv-respiratory-syncytial-virus",
      description:      "Vaccine that protects against RSV, a common respiratory virus that can be serious for older adults and high-risk individuals.",
      eligibilityNotes: "Free for those 75+ and eligible high-risk groups, but administered by primary care providers or public health units. Pharmacists do not administer the publicly-funded version — a prescription and fee are required for private administration.",
      durationMinutes:  15,
      sortOrder:        3,
      status:           "active",
    },
    {
      name:             "Hepatitis A & B",
      slug:             "hepatitis-a-b",
      description:      "Combined vaccine providing protection against both Hepatitis A and Hepatitis B. Three-dose schedule (0, 1, and 6 months).",
      eligibilityNotes: "Requires a prescription and payment of a fee. Suitable for adults 18 and older. Commonly recommended for travellers and high-risk individuals.",
      durationMinutes:  20,
      sortOrder:        4,
      status:           "active",
    },
    {
      name:             "Pneumococcal (Pneumonia)",
      slug:             "pneumococcal-pneumonia",
      description:      "Protects against pneumococcal bacteria, which can cause pneumonia, meningitis, and bloodstream infections.",
      eligibilityNotes: "Free for adults 65+ through a primary care provider. Pharmacists may administer with a prescription for a fee. Also recommended for adults 18+ with certain medical conditions.",
      durationMinutes:  15,
      sortOrder:        5,
      status:           "active",
    },
  ];

  for (const vaccine of vaccines) {
    await VaccineServiceModel.updateOne(
      { slug: vaccine.slug },
      { $set: vaccine },
      { upsert: true },
    );
  }
  console.log(`   ${vaccines.length} vaccine services seeded`);

  /* ── 5. Seed minor ailment catalog ── */
  console.log("🩺  Seeding minor ailment catalog...");
  const ailments = [
    { name: "Impetigo",                                   description: "A highly contagious bacterial skin infection causing red sores or blisters, most common in children.",           sortOrder: 0 },
    { name: "Atopic dermatitis (eczema)",                 description: "A chronic inflammatory skin condition causing itchy, dry, and inflamed skin patches.",                          sortOrder: 1 },
    { name: "Diaper dermatitis",                          description: "Skin irritation and rash in the diaper area caused by prolonged exposure to moisture and friction.",            sortOrder: 2 },
    { name: "Acne",                                       description: "A common skin condition where hair follicles become clogged with oil and dead skin cells, causing pimples.",    sortOrder: 3 },
    { name: "Tick bite",                                  description: "Skin reaction following a tick bite, which may require assessment for possible tick-borne illness.",            sortOrder: 4 },
    { name: "Threadworms and pinworms",                   description: "A common intestinal parasitic infection, particularly in children, causing anal itching.",                      sortOrder: 5 },
    { name: "Allergic rhinitis (hay fever)",              description: "An allergic response to airborne substances such as pollen, causing sneezing, runny nose, and itchy eyes.",     sortOrder: 6 },
    { name: "Cold sores",                                 description: "Fluid-filled blisters around the lips caused by the herpes simplex virus (HSV-1).",                            sortOrder: 7 },
    { name: "Pink eye (eye infection, conjunctivitis)",   description: "Inflammation of the conjunctiva causing redness, discharge, and irritation of one or both eyes.",              sortOrder: 8 },
    { name: "Oral thrush",                                description: "A fungal infection of the mouth caused by Candida yeast, producing white patches on the tongue and cheeks.",   sortOrder: 9 },
    { name: "Canker sores",                               description: "Small, shallow ulcers inside the mouth that cause pain and discomfort when eating or talking.",                 sortOrder: 10 },
    { name: "Heartburn, acid-reflux (GERD)",              description: "A digestive condition where stomach acid flows back into the esophagus, causing a burning sensation in the chest.", sortOrder: 11 },
    { name: "Mild COVID",                                 description: "Assessment and guidance for mild COVID-19 symptoms including sore throat, runny nose, cough, and fatigue.",     sortOrder: 12 },
    { name: "Nausea & vomiting in pregnancy",             description: "Management of morning sickness and nausea during early pregnancy.",                                             sortOrder: 13 },
    { name: "Hemorrhoids",                                description: "Swollen veins in the rectum or anus causing discomfort, bleeding, and itching.",                               sortOrder: 14 },
    { name: "Urinary tract infection (UTI)",              description: "A bacterial infection affecting the bladder or urethra, causing burning urination and frequent urge to urinate.", sortOrder: 15 },
    { name: "Painful menstrual periods (dysmenorrhea)",   description: "Cramping pain in the lower abdomen occurring during menstruation, sometimes accompanied by nausea.",           sortOrder: 16 },
    { name: "Vaginal candidiasis (yeast infection)",      description: "A fungal infection of the vagina causing itching, burning, and abnormal discharge.",                            sortOrder: 17 },
    { name: "Smoking cessation",                          description: "Pharmacist-guided support and prescription assistance to help patients quit smoking.",                           sortOrder: 18 },
    { name: "Sprains & strains",                          description: "Minor musculoskeletal injuries to ligaments or muscles, typically from overuse or sudden movement.",            sortOrder: 19 },
  ];

  for (const ailment of ailments) {
    const slug = ailment.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    await AilmentCatalogModel.updateOne(
      { slug },
      { $setOnInsert: { ...ailment, slug, isActive: true } },
      { upsert: true },
    );
  }
  console.log(`   ${ailments.length} minor ailment services seeded`);

  /* ── 6. Seed ask-pharmacist topic catalog ── */
  console.log("💬  Seeding ask-pharmacist topics...");
  const pharmacistTopics = [
    { name: "Erectile Dysfunction Compounds",   sortOrder: 0 },
    { name: "Hormone Therapy",                   sortOrder: 1 },
    { name: "Veterinary Compounds",              sortOrder: 2 },
    { name: "Dermatological Compounds",          sortOrder: 3 },
    { name: "Topical Pain Compounds",            sortOrder: 4 },
    { name: "Pediatric Compounds",               sortOrder: 5 },
    { name: "Podiatry and Chiropody Compounds",  sortOrder: 6 },
    { name: "Braces and Supports",               sortOrder: 7 },
    { name: "Thyroid Support",                   sortOrder: 8 },
    { name: "Compression Garments",              sortOrder: 9 },
  ];

  for (const topic of pharmacistTopics) {
    const slug = topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await AskPharmacistTopicModel.updateOne(
      { slug },
      { $setOnInsert: { ...topic, slug, isActive: true } },
      { upsert: true },
    );
  }
  console.log(`   ${pharmacistTopics.length} ask-pharmacist topics seeded`);

  console.log("✅  Seed complete");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});

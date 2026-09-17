import "dotenv/config";
import mongoose from "mongoose";
import argon2 from "argon2";
import { config } from "@/config";
import { PermissionModel } from "@/modules/permissions/permissions.schema";
import { RoleModel } from "@/modules/roles/roles.schema";
import { UserModel } from "@/modules/users/users.schema";
import { PERMISSION_CATALOG, ALL_PERMISSION_KEYS } from "@/modules/permissions/permissions.catalog";

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

    if (!exists) {
      const passwordHash = await argon2.hash(config.SEED_ADMIN_PASSWORD);
      await UserModel.create({
        email:         config.SEED_ADMIN_EMAIL,
        passwordHash,
        fullName:      config.SEED_ADMIN_NAME ?? "MediSyn Admin",
        role:          "patient",             // base role — access is via adminRole
        roles:         adminRole ? [adminRole._id] : [],
        status:        "active",
        emailVerified: true,
      });
      console.log(`   Admin created: ${config.SEED_ADMIN_EMAIL}`);
    } else {
      console.log(`   Admin already exists: ${config.SEED_ADMIN_EMAIL}`);
    }
  }

  console.log("✅  Seed complete");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});

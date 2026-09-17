import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users, faqs } from "../src/db/schema";

const ADMIN_EMAIL = "admin@medisyncompounding.ca";
const ADMIN_PASSWORD = "MediSynAdmin123!";

async function main() {
  const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      adminRole: "super_admin",
      fullName: "MediSyn Super Admin",
      phone: "1-877-433-1234",
      status: "active",
      emailVerified: true,
    });
    console.log(`Seeded admin account: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log("Admin account already exists, skipping.");
  }

  const faqCount = await db.select({ id: faqs.id }).from(faqs);
  if (faqCount.length === 0) {
    await db.insert(faqs).values([
      {
        question: "What is compounding, and who is it for?",
        answer:
          "Compounding is the process of preparing a medication uniquely for a single patient — adjusting strength, combining ingredients, changing the form, or removing allergens. It's ideal for patients who can't take commercially available medications as-is.",
        category: "Prescriptions",
        sortOrder: 1,
      },
      {
        question: "How fast can I get my compounded medication?",
        answer:
          "Most non-sterile compounds are prepared within 24 hours of pharmacist approval. Complex formulations may take 2-3 business days.",
        category: "Prescriptions",
        sortOrder: 2,
      },
      {
        question: "Do you deliver outside of Ontario?",
        answer:
          "Yes — MediSyn Compounding ships prescription and over-the-counter orders across Canada. Delivery is free on orders over $49.",
        category: "Delivery",
        sortOrder: 3,
      },
      {
        question: "How do I create a patient account?",
        answer:
          "Click Register on the login page, fill in your details, and verify your email. Once verified you can log in immediately — no manual approval required for patients.",
        category: "Account",
        sortOrder: 4,
      },
      {
        question: "Why do clinic and pharmacy partner accounts need approval?",
        answer:
          "Clinic and pharmacy partner accounts access sensitive workflows, so every application is verified by email and manually reviewed by a MediSyn administrator before activation.",
        category: "Account",
        sortOrder: 5,
      },
      {
        question: "Is my information kept private and secure?",
        answer:
          "Yes. All personal health information is stored and transmitted securely in compliance with Canadian privacy regulations (PHIPA).",
        category: "Privacy",
        sortOrder: 6,
      },
    ]);
    console.log("Seeded FAQs.");
  } else {
    console.log("FAQs already exist, skipping.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

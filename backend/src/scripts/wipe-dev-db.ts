/**
 * Full database wipe — development only.
 *
 * Lists every collection with its document count, then drops the entire
 * database. The UHID and invoice number counters are reset automatically
 * because they live in the same database.
 *
 * GUARDS:
 *   • Refuses to run if NODE_ENV === "production"
 *   • Requires --confirm flag (prevents accidental runs)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/wipe-dev-db.ts --confirm
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../config";

/* ─── Guards ─────────────────────────────────────────────────────────────── */

if (config.NODE_ENV === "production") {
  console.error("\n✗  REFUSED: This script will not run in production.\n");
  process.exit(1);
}

if (!process.argv.includes("--confirm")) {
  console.error(
    "\n✗  Pass --confirm to execute the wipe:\n" +
    "   npx ts-node -r tsconfig-paths/register src/scripts/wipe-dev-db.ts --confirm\n",
  );
  process.exit(1);
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

async function run(): Promise<void> {
  console.log(`\n[wipe-dev-db] Connecting to MongoDB (${config.NODE_ENV})…`);
  await mongoose.connect(config.MONGODB_URI);
  console.log("[wipe-dev-db] Connected.\n");

  const db = mongoose.connection.db!;

  /* List all collections + document counts before wiping */
  const collections = await db.listCollections().toArray();

  if (collections.length === 0) {
    console.log("[wipe-dev-db] Database is already empty. Nothing to do.\n");
    await mongoose.disconnect();
    return;
  }

  console.log("Collections to be deleted:");
  console.log("─".repeat(44));

  let totalDocs = 0;
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    totalDocs += count;
    console.log(`  ${col.name.padEnd(36)} ${String(count).padStart(6)} docs`);
  }

  console.log("─".repeat(44));
  console.log(`  ${"TOTAL".padEnd(36)} ${String(totalDocs).padStart(6)} docs`);
  console.log();

  /* Drop the entire database */
  console.log("[wipe-dev-db] Dropping database…");
  await db.dropDatabase();
  console.log(`[wipe-dev-db] ✓ Database wiped. ${collections.length} collections and ${totalDocs} documents removed.\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[wipe-dev-db] Fatal:", err);
  process.exit(1);
});

/**
 * Development data reset script.
 *
 * Deletes ALL documents from the invoice, payment, order, and user collections.
 * Safe-guarded: only runs when NODE_ENV !== "production" AND --confirm flag is passed.
 *
 * Usage:
 *   npx ts-node src/scripts/reset-dev-data.ts --confirm
 *   npx ts-node src/scripts/reset-dev-data.ts --confirm --collections=invoices,orders
 *
 * Available collection groups:
 *   invoices  — invoices, invoice_line_items, invoice_line_item_histories,
 *               payment_transactions, payment_allocations, invoicecounters
 *   orders    — orders
 *   users     — users (non-admin roles only, unless --include-admins is set)
 *   all       — all of the above (default)
 */

import mongoose from "mongoose";
import { config } from "../config";

const CONFIRMED = process.argv.includes("--confirm");
const INCLUDE_ADMINS = process.argv.includes("--include-admins");

/* Parse optional --collections=a,b flag; default to "all" */
const collectionsArg =
  process.argv.find((a) => a.startsWith("--collections="))?.split("=")[1] ?? "all";
const GROUPS = collectionsArg === "all"
  ? ["invoices", "orders", "users"]
  : collectionsArg.split(",").map((s) => s.trim());

/* ─── Guards ────────────────────────────────────────────────────────────────── */

if (!CONFIRMED) {
  console.error(
    "\nERROR: Pass --confirm to run this script.\n" +
    "  npx ts-node src/scripts/reset-dev-data.ts --confirm\n",
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error("\nERROR: This script refuses to run in production.\n");
  process.exit(1);
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */

async function run(): Promise<void> {
  console.log(`\n[reset-dev-data] Connecting to MongoDB…`);
  await mongoose.connect(config.mongoUri);
  console.log(`[reset-dev-data] Connected.\n`);

  const db = mongoose.connection.db!;
  const results: Array<{ collection: string; deleted: number }> = [];

  const drop = async (name: string, filter: Record<string, unknown> = {}) => {
    const coll = db.collection(name);
    const { deletedCount } = await coll.deleteMany(filter);
    results.push({ collection: name, deleted: deletedCount });
    console.log(`  ✓ ${name}: deleted ${deletedCount}`);
  };

  if (GROUPS.includes("invoices")) {
    console.log("── Invoice collections ──────────────────────────────────");
    await drop("invoices");
    await drop("invoice_line_items");
    await drop("invoice_line_item_histories");
    await drop("payment_transactions");
    await drop("payment_allocations");
    await drop("invoicecounters");
    console.log();
  }

  if (GROUPS.includes("orders")) {
    console.log("── Order collections ────────────────────────────────────");
    await drop("orders");
    console.log();
  }

  if (GROUPS.includes("users")) {
    console.log("── User collections ─────────────────────────────────────");
    if (INCLUDE_ADMINS) {
      await drop("users");
    } else {
      /* Keep admin users by default — only delete patients, clinics, partners */
      await drop("users", { role: { $in: ["patient", "clinic", "pharmacy_partner"] } });
    }
    await drop("patientprofiles");
    await drop("clinicprofiles");
    await drop("pharmacypartnerprofiles");
    await drop("sessions");
    console.log();
  }

  const total = results.reduce((s, r) => s + r.deleted, 0);
  console.log(`[reset-dev-data] Done. ${total} documents deleted across ${results.length} collections.\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[reset-dev-data] Fatal error:", err);
  process.exit(1);
});

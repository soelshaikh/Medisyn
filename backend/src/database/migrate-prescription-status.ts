/**
 * One-time migration: update prescriptions that have legacy status values
 * from the old schema (active | expired | cancelled) to the new workflow
 * statuses (submitted | received | verified | dispensed | cancelled).
 *
 * Mapping:
 *   active  → received   (already being processed by pharmacy)
 *   expired → cancelled  (terminal — expired prescriptions cannot be worked on)
 *
 * Run once:
 *   npx ts-node -r tsconfig-paths/register src/database/migrate-prescription-status.ts
 */

import mongoose from "mongoose";
import { connectDatabase } from "./connection";
import { PrescriptionModel } from "@/modules/prescriptions/prescriptions.schema";
import { logger } from "@/common/utils/logger";

async function run() {
  await connectDatabase();

  const activeResult = await PrescriptionModel.updateMany(
    { status: "active" },
    {
      $set: { status: "received" },
      $push: {
        statusHistory: {
          status:    "received",
          changedAt: new Date(),
          changedBy: null,
          note:      "Migrated from legacy status 'active'",
        },
      },
    },
  );
  logger.info(`Migrated ${activeResult.modifiedCount} 'active' → 'received'`);

  const expiredResult = await PrescriptionModel.updateMany(
    { status: "expired" },
    {
      $set: { status: "cancelled" },
      $push: {
        statusHistory: {
          status:    "cancelled",
          changedAt: new Date(),
          changedBy: null,
          note:      "Migrated from legacy status 'expired'",
        },
      },
    },
  );
  logger.info(`Migrated ${expiredResult.modifiedCount} 'expired' → 'cancelled'`);

  logger.info("Migration complete");
  await mongoose.disconnect();
}

run().catch((err) => {
  logger.error("Migration failed", err);
  process.exit(1);
});

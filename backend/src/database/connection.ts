import mongoose from "mongoose";
import { config } from "@/config";
import { logger } from "@/common/utils/logger";

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB error", { err }));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  await mongoose.connect(config.MONGODB_URI, {
    dbName: "Medisyn",
  });
}

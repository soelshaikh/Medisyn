import http from "http";
import mongoose from "mongoose";
import { config } from "./config";
import { app } from "./app";
import { connectDatabase } from "./database/connection";
import { logger } from "./common/utils/logger";

async function bootstrap() {
  await connectDatabase();

  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info(`MediSyn API running on http://localhost:${config.PORT}`);
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Health:      http://localhost:${config.PORT}/health`);
    logger.info(`API Docs:    http://localhost:${config.PORT}/api/docs`);
  });

  /* ── Graceful shutdown ── */
  async function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      logger.info("HTTP server closed");
      try {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed");
      } catch (err) {
        logger.error("Error closing MongoDB connection", err);
      }
      process.exit(0);
    });

    /* Force exit if graceful shutdown takes too long */
    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 15_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { reason });
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { err });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});

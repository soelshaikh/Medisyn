import { config } from "./config";
import { app } from "./app";
import { connectDatabase } from "./database/connection";
import { logger } from "./common/utils/logger";

async function bootstrap() {
  await connectDatabase();

  app.listen(config.PORT, () => {
    logger.info(`🚀  MediSyn API running on http://localhost:${config.PORT}`);
    logger.info(`   Environment: ${config.NODE_ENV}`);
    logger.info(`   Health:      http://localhost:${config.PORT}/health`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server", { err });
  process.exit(1);
});

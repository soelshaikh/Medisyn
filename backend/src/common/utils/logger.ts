import winston from "winston";
import { config } from "@/config";

const { combine, timestamp, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: config.NODE_ENV === "production" ? "info" : "debug",
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format:
        config.NODE_ENV === "development"
          ? combine(colorize(), simple())
          : combine(timestamp(), json()),
    }),
  ],
});

import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV:   z.enum(["development", "test", "production"]).default("development"),
  PORT:       z.coerce.number().default(4000),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_ACCESS_SECRET:   z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET:  z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_EXPIRES_IN:  z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_URL:    z.string().url().default("http://localhost:3001"),

  EMAIL_FROM:      z.string().email().default("noreply@medisyn.ca"),
  EMAIL_PROVIDER:  z.string().default("smtp"),

  FILE_STORAGE_PROVIDER: z.string().default("local"),

  SEED_ADMIN_EMAIL:    z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME:     z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment configuration:");
  parsed.error.issues.forEach((issue) => {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  });
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;

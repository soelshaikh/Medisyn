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
  EMAIL_FROM_NAME: z.string().default("MediSyn"),

  /* Brevo (primary) */
  BREVO_API_KEY: z.string().optional(),

  /* Resend (fallback) */
  RESEND_API_KEY: z.string().optional(),

  /* SendGrid (fallback) */
  SENDGRID_API_KEY: z.string().optional(),

  /* Custom SMTP (last resort) */
  EMAIL_HOST:     z.string().optional(),
  EMAIL_PORT:     z.string().optional(),
  EMAIL_USER:     z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),

  FILE_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),

  /* S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO) */
  S3_ENDPOINT:          z.string().url().optional(),   /* required for non-AWS providers */
  S3_REGION:            z.string().default("auto"),
  S3_BUCKET:            z.string().optional(),
  S3_ACCESS_KEY_ID:     z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /* Public CDN/bucket URL for public objects — e.g. https://pub-xxx.r2.dev */
  S3_PUBLIC_URL:        z.string().url().optional(),

  SEED_ADMIN_EMAIL:    z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME:     z.string().optional(),

  APP_TIMEZONE:               z.string().default("America/Toronto"),
  INVOICE_GUEST_TOKEN_TTL_DAYS: z.coerce.number().default(30),
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

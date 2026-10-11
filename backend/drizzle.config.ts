import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Super admin role bypasses RLS — required for Drizzle Studio and migrations
    url: process.env.DATABASE_SUPER_ADMIN_URL ?? process.env.DATABASE_URL!,
  },
} satisfies Config;

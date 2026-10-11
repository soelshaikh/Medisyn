import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema:  './src/db/schema/identity.ts',
  out:     './src/db/migrations/identity',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.IDENTITY_DATABASE_URL!,
  },
} satisfies Config;

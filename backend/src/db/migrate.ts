import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function runMigrations() {
  const client = postgres(process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!, {
    max: 1,
  });

  const db = drizzle(client);

  console.log('Running migrations...');
  await migrate(db, {
    migrationsFolder: path.join(__dirname, 'migrations'),
  });
  console.log('Migrations complete.');

  await client.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

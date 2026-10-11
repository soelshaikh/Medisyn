import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { fileStorage } from '@/lib/file-storage/file-storage.service';
import { MIME_TO_EXT } from '@/lib/file-storage/file-storage.types';
import * as dotenv from 'dotenv';

dotenv.config();

interface FileRow extends Record<string, unknown> {
  id: string;
  facility_id: string;
  file_reference: string;
  table_name: string;
}

async function run(): Promise<void> {
  const client = postgres(
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  const db = drizzle(client);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const tables = ['prescription_requests', 'compounding_requests'] as const;
  const moduleMap: Record<string, string> = {
    prescription_requests: 'prescriptions',
    compounding_requests: 'compounding',
  };

  for (const tableName of tables) {
    const rows = await db.execute<FileRow>(sql`
      SELECT id, facility_id, file_reference, ${tableName} AS table_name
      FROM ${sql.raw(tableName)}
      WHERE file_reference IS NOT NULL
        AND (file_keys = '{}' OR file_keys IS NULL)
    `);

    console.log(`[${tableName}] Found ${rows.length} row(s) to migrate.`);

    for (const row of rows as unknown as FileRow[]) {
      try {
        const raw = row.file_reference;

        // Only handle base64 data URIs — skip plain path strings
        if (!raw.startsWith('data:')) {
          console.warn(`  [SKIP] id=${row.id} — file_reference is not a base64 data URI, skipping`);
          skipped++;
          continue;
        }

        // Parse data URI: data:<mime>;base64,<data>
        const commaIdx = raw.indexOf(',');
        if (commaIdx === -1) {
          console.warn(`  [SKIP] id=${row.id} — malformed data URI`);
          skipped++;
          continue;
        }

        const header = raw.slice(5, commaIdx); // e.g. "image/jpeg;base64"
        const mimeType = header.split(';')[0]!.trim();
        const base64Data = raw.slice(commaIdx + 1);
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length === 0) {
          console.warn(`  [SKIP] id=${row.id} — decoded buffer is empty`);
          skipped++;
          continue;
        }

        const ext = MIME_TO_EXT[mimeType] ?? '.bin';
        const module = moduleMap[tableName]!;

        const fileKey = await fileStorage.uploadFile(buffer, mimeType, `${row.facility_id}/${module}`, ext);

        await db.execute(sql`
          UPDATE ${sql.raw(tableName)}
          SET file_keys = ARRAY[${fileKey}]::text[],
              file_reference = NULL
          WHERE id = ${row.id}
        `);

        console.log(`  [OK] id=${row.id} → ${fileKey}`);
        migrated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  [FAIL] id=${row.id} — ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\nMigration complete: migrated=${migrated}, skipped=${skipped}, failed=${failed}`);
  await client.end();
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
}

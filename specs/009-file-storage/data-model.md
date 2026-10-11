# Data Model: File Storage

**Feature**: 009-file-storage  
**Date**: 2026-10-11

---

## Schema Changes

No new tables. Two existing tables are modified by adding a `file_keys` column. No columns are dropped in this phase.

---

### Table: `prescription_requests` (MODIFIED)

**Change**: Add `file_keys text[] NOT NULL DEFAULT '{}'`

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | `uuid` | PK | Unchanged |
| `patient_id` | `uuid` | FK → users | Unchanged |
| `facility_id` | `uuid` | FK → facilities | Unchanged — RLS via `current_facility_id()` |
| `file_reference` | `text` | nullable | **DEPRECATED** — kept null after migration; not dropped this phase |
| **`file_keys`** | **`text[]`** | **NOT NULL DEFAULT '{}'** | **NEW — array of S3 file keys** |
| `status` | `text` | not null | Unchanged |
| ... | ... | ... | All other columns unchanged |

**Migration SQL**:
```sql
ALTER TABLE prescription_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';
```

**Drizzle schema** (in `backend/src/db/schema/healthcare.ts`):
```typescript
fileReference: text('file_reference'),          // deprecated — will be null post-migration
fileKeys: text('file_keys').array().notNull().default([]),
```

---

### Table: `compounding_requests` (MODIFIED)

**Change**: Add `file_keys text[] NOT NULL DEFAULT '{}'`

| Column | Type | Constraint | Notes |
|--------|------|-----------|-------|
| `id` | `uuid` | PK | Unchanged |
| `patient_id` | `uuid` | FK → users | Unchanged |
| `facility_id` | `uuid` | FK → facilities | Unchanged — RLS via `current_facility_id()` |
| `file_reference` | `text` | nullable | **DEPRECATED** — kept null after migration; not dropped this phase |
| **`file_keys`** | **`text[]`** | **NOT NULL DEFAULT '{}'** | **NEW — array of S3 file keys** |
| `status` | `text` | not null | Unchanged |
| ... | ... | ... | All other columns unchanged |

**Migration SQL**:
```sql
ALTER TABLE compounding_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';
```

---

## Key Design Entities (Runtime — no DB table)

### FileStorageService

Pure I/O abstraction. No DB table. Instantiated once at startup.

| Method | Signature | Returns |
|--------|-----------|---------|
| `uploadFile` | `(buffer: Buffer, mimeType: string, folder: string, ext: string) → Promise<string>` | `fileKey` string |
| `getSignedUrl` | `(fileKey: string, expirySeconds?: number) → Promise<string>` | Signed URL string |
| `deleteFile` | `(fileKey: string) → Promise<void>` | void |

### File Key Format

Pattern: `{facilityId}/{module}/{uuid}.{ext}`

| Segment | Example | Notes |
|---------|---------|-------|
| `facilityId` | `fac_abc123` | From `auth.facilityId` |
| `module` | `prescriptions` or `compounding` | Literal string |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` | Server-generated `uuidv4()` |
| `ext` | `.pdf`, `.jpg`, `.png`, `.gif`, `.webp` | Derived from validated MIME type |

### File Upload Result (TypeScript type)

```typescript
export interface FileUploadResult {
  fileKey: string;    // the stored key — persisted in DB
  mimeType: string;   // validated MIME type
  sizeBytes: number;  // file size in bytes
}
```

---

## Drizzle Migration File

**Path**: `backend/drizzle/migrations/0007_file_keys.sql`

```sql
ALTER TABLE prescription_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';

ALTER TABLE compounding_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';
```

The migration is additive only. `file_reference` is left in place for backward-compatibility during the transition. It is cleared to `null` by the migration script for all migrated rows.

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AWS_S3_REGION` | `auto` | Region (`auto` for Cloudflare R2) |
| `AWS_S3_BUCKET` | — | S3/R2 bucket name |
| `AWS_S3_ENDPOINT` | — | Blank for AWS; `https://<accountid>.r2.cloudflarestorage.com` for R2 |
| `AWS_S3_ACCESS_KEY_ID` | — | Access key |
| `AWS_S3_SECRET_ACCESS_KEY` | — | Secret key |
| `FILE_SIGNED_URL_EXPIRY_SECONDS` | `900` | Signed URL validity (15 minutes) |
| `FILE_MAX_SIZE_BYTES` | `10485760` | Max upload size (10 MB) |

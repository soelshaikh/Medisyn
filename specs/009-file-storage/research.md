# Research: File Storage

**Feature**: 009-file-storage  
**Date**: 2026-10-11  
**Purpose**: Resolve all technical unknowns before implementation begins

---

## Decision 1: AWS SDK Version and R2 Compatibility

**Decision**: Use `@aws-sdk/client-s3` v3 + `@aws-sdk/s3-request-presigner` v3 (modular AWS SDK).

**Rationale**: The `@aws-sdk/client-s3` package works against any S3-compatible endpoint, including Cloudflare R2. The provider is selected purely by configuration: for R2, set `endpoint: 'https://<accountid>.r2.cloudflarestorage.com'` and `region: 'auto'`. For AWS S3, omit `endpoint` and set `region` normally. Switching providers requires only environment variable changes — no code changes.

**Alternatives considered**:
- `aws-sdk` v2 (legacy monolith) — rejected: deprecated, larger bundle, v3 is current standard
- `minio` SDK — rejected: not needed; `@aws-sdk` works against MinIO too

**Environment variables required**:
```
AWS_S3_REGION=auto                              # 'auto' for R2, e.g. 'us-east-1' for S3
AWS_S3_BUCKET=medisyn-files
AWS_S3_ENDPOINT=                                # blank for AWS S3, https://... for R2
AWS_S3_ACCESS_KEY_ID=
AWS_S3_SECRET_ACCESS_KEY=
FILE_SIGNED_URL_EXPIRY_SECONDS=900              # 15 minutes default
FILE_MAX_SIZE_BYTES=10485760                    # 10 MB default
```

---

## Decision 2: Multipart Upload Parsing

**Decision**: Use `multer` with `memoryStorage()`. File buffer is held in memory and passed directly to the S3 `PutObjectCommand`.

**Rationale**: `multer` integrates cleanly as Express middleware. `memoryStorage()` keeps the file as `req.file.buffer` (a `Buffer`), which is passed to the AWS SDK `Body` parameter. For files ≤10 MB, memory storage is safe and avoids disk I/O.

**Size enforcement**: `multer({ storage: memoryStorage(), limits: { fileSize: FILE_MAX_SIZE_BYTES } })` — multer rejects oversized files before the handler runs, returning a `MulterError` with `code: 'LIMIT_FILE_SIZE'`.

**Field name**: `file` (single file per upload request). Clients send `Content-Type: multipart/form-data` with one `file` field.

**Alternatives considered**:
- `busboy` (lower-level stream parser) — rejected: more boilerplate, multer is sufficient for ≤10 MB
- Streaming directly to S3 (no buffer) — deferred: needed for large files; not required at ≤10 MB threshold

---

## Decision 3: Schema Change — file_reference → file_keys

**Decision**: Add a `file_keys text[] NOT NULL DEFAULT '{}'::text[]` column to `prescription_requests` and `compounding_requests`. Keep the existing nullable `file_reference text` column during the transition; the migration script clears it after copying to `file_keys`.

**Rationale**: The spec assumption says "DB stores an array of keys" (multi-file support). The existing `file_reference: text()` column is a single nullable field. Adding a new `file_keys text[]` column:
- Supports multiple files per request (per spec assumption)
- Does not break existing queries that read `file_reference` (they remain during transition)
- Is safe to add in a non-destructive migration (adding a column with a default is instant in PostgreSQL)

The `file_reference` column is set to `null` for all migrated rows. It is NOT dropped in this phase (dropped in a future cleanup migration).

**Drizzle schema change**:
```typescript
// Before
fileReference: text('file_reference'),

// After (keep fileReference for migration; add fileKeys)
fileReference: text('file_reference'),      // deprecated — will be null after migration
fileKeys: text('file_keys').array().notNull().default([]),
```

**Migration SQL** (new file `drizzle/migrations/0007_file_keys.sql`):
```sql
ALTER TABLE prescription_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';

ALTER TABLE compounding_requests
  ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';
```

---

## Decision 4: FileStorageService Architecture

**Decision**: `FileStorageService` is a singleton class instantiated once at application startup (in `src/lib/file-storage/file-storage.service.ts`). It is imported and called by service layer functions that run inside `withTenantContext`.

**Interface**:
```typescript
class FileStorageService {
  uploadFile(buffer: Buffer, mimeType: string, folder: string, ext: string): Promise<string> // returns fileKey
  getSignedUrl(fileKey: string, expirySeconds?: number): Promise<string>
  deleteFile(fileKey: string): Promise<void>
}
```

`folder` = `{facilityId}/{module}` (passed from the service layer, not constructed inside `FileStorageService` — keeps the service infrastructure-agnostic).

**Rationale**: Keeping `FileStorageService` as a pure I/O abstraction means it has no DB access and no tenant context awareness. Tenant context (facilityId) is injected by the calling service layer — satisfying §I without coupling `FileStorageService` to the RLS pattern.

---

## Decision 5: File Key Format

**Decision**: `{facilityId}/{module}/{uuid}.{ext}`

**Examples**:
- `fac_abc123/prescriptions/550e8400-e29b-41d4-a716-446655440000.pdf`
- `fac_abc123/compounding/550e8400-e29b-41d4-a716-446655440001.jpg`

**Extension derivation**: Extension is derived from the validated MIME type using a fixed map (not from `req.file.originalname`) to prevent path traversal. Map: `image/jpeg → .jpg`, `image/png → .png`, `image/gif → .gif`, `image/webp → .webp`, `application/pdf → .pdf`.

**UUID**: Generated server-side using the existing `uuid` package (`v4()`).

---

## Decision 6: File Type Validation

**Decision**: Validate BOTH `req.file.mimetype` (from multer) AND the extension of `req.file.originalname`. Both must be on the allowlist. If either fails, reject with 422.

**Allowlist**:
```typescript
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
]);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']);
```

**Rationale**: MIME sniffing (reading file bytes) is out of scope. Dual validation (MIME + extension) reduces risk from renamed files and browser MIME-type guessing.

**Zero-byte check**: `if (req.file.size === 0)` → reject with 422 `FILE_EMPTY` before storage.

---

## Decision 7: Signed URL — Patient vs. Admin Access

**Decision**: Two access paths:
1. **Admin users**: Require `files.download` RBAC permission → call `getSignedUrl` for any file in their facility.
2. **Patient users**: Require that the record's `patientId === auth.userId` → ownership check inside `withTenantContext`.

**Rationale**: Admins need cross-patient access for case review. Patients must only access their own files. The same endpoint handles both; the authorization logic branches on role.

**No pre-validation of file existence**: The API generates a signed URL without checking if the object exists in S3. If the key does not exist, the storage provider returns 403/404 when the URL is accessed. Pre-validation would require an extra `HeadObjectCommand` call per request — deferred until needed.

---

## Decision 8: Permissions

**Decision**: Two new permissions, seeded on the `platform_admin` module:
- `files.upload` — required to upload files to any healthcare record
- `files.download` — required to generate signed URLs for admin access

**Rationale**: Granular permissions allow pharmacists to view files without having upload access (or vice versa). Follows the permissions-based RBAC pattern established in earlier phases.

**Seed file**: `backend/src/db/seeds/file-storage-permissions.ts` — same pattern as `reports-permissions.ts`.

---

## Decision 9: Audit Log Entries

**Decision**: Write to `audit_log` inside `withTenantContext` for both operations:
- `file.upload`: `{ action: 'file.upload', entityType: 'prescription' | 'compounding', entityId: recordId, metadata: { fileKey, mimeType, sizeBytes } }`
- `file.sign_url`: `{ action: 'file.sign_url', entityType: 'prescription' | 'compounding', entityId: recordId, metadata: { fileKey, expirySeconds } }`

**Rationale**: §IV of the constitution requires auditing all PHI access. Prescription file downloads are explicitly listed as PHI access events.

---

## Decision 10: Upload Endpoint Design

**Decision**: Dedicated upload endpoints (`POST /{resource}/{id}/files`) separate from resource creation. Prescription/compounding submission remains a JSON endpoint. File upload is a separate HTTP request after the record exists.

**Rationale**: Mixing multipart form data and JSON in the same request requires additional parsing complexity. Two-step flow (create record → attach file) is simpler and allows retrying file uploads independently.

**Return shape**:
```json
{ "data": { "fileKey": "fac_abc123/prescriptions/uuid.pdf" } }
```

---

## Decision 11: Migration Script Access Pattern

**Decision**: The migration script (`src/scripts/migrate-base64-files.ts`) uses `workerDb` (BYPASSRLS, `app_super_admin` role) to read all non-null `file_reference` rows across all facilities, upload to S3, write the key to `file_keys`, and clear `file_reference`.

**Idempotency**: A row is skipped if `file_keys` is already non-empty (`file_keys != '{}'`). This makes re-running the script safe.

**Error handling**: Per-row try/catch — a failure on one row logs the error and continues. Script exits 0 with a summary. Exit code 1 only if the DB connection fails.

**Rationale**: Migration must be cross-facility (needs BYPASSRLS). Using `workerDb` is the established pattern for super-admin cross-facility operations (§I: only via `app_super_admin` role through `workerDb`).

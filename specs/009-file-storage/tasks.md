---

description: "Task list template for feature implementation"
---

# Tasks: File Storage

**Input**: Design documents from `specs/009-file-storage/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/files.md ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: US1 (Prescription Upload, P1) and US2 (Signed URL, P1) are first-priority; US3 (Compounding, P2) and US4 (Migration, P2) follow. US2 depends on US1 (adds to the same prescription service/router).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install packages, create new shared files, apply schema migration. All can run in parallel.

- [X] T001 [P] Add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer`, and `@types/multer` to `backend/package.json` dependencies — run `npm install` in `backend/` to install; verify `node_modules/@aws-sdk/client-s3` exists
- [X] T002 [P] Create `backend/src/lib/file-storage/file-storage.types.ts` — export interfaces: `FileStorageConfig { region: string; bucket: string; endpoint?: string; accessKeyId: string; secretAccessKey: string; signedUrlExpiry: number; maxFileSizeBytes: number; }`, `FileUploadResult { fileKey: string; mimeType: string; sizeBytes: number; }`; export constants: `ALLOWED_MIME_TYPES = new Set(['image/jpeg','image/png','image/gif','image/webp','application/pdf'])`, `ALLOWED_EXTENSIONS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.pdf'])`, `MIME_TO_EXT: Record<string, string> = { 'image/jpeg':'.jpg', 'image/png':'.png', 'image/gif':'.gif', 'image/webp':'.webp', 'application/pdf':'.pdf' }`
- [X] T003 [P] Create Drizzle migration `backend/drizzle/migrations/0007_file_keys.sql` with content: `ALTER TABLE prescription_requests ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';` and `ALTER TABLE compounding_requests ADD COLUMN IF NOT EXISTS file_keys text[] NOT NULL DEFAULT '{}';`
- [X] T004 [P] Update `backend/src/db/schema/healthcare.ts` — in `prescription_requests` table definition add `fileKeys: text('file_keys').array().notNull().default([])` after the existing `fileReference` column; repeat the same for `compounding_requests` table; do NOT remove `fileReference` (it is kept as deprecated nullable for backward compatibility)
- [X] T005 [P] Create `backend/src/db/seeds/file-storage-permissions.ts` — same pattern as `backend/src/db/seeds/reports-permissions.ts`: upsert `platform_admin` platform module (`INSERT INTO platform_modules ... ON CONFLICT DO NOTHING`), then insert two permissions: `{ key: 'files.upload', name: 'Upload Files', moduleId }` and `{ key: 'files.download', name: 'Download / View Files', moduleId }` both with `ON CONFLICT DO NOTHING`; export `seedFileStoragePermissions()` async function; add `if (require.main === module)` runner block

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create `FileStorageService` and run DB migration before any endpoint work begins.

**⚠️ CRITICAL**: No user story work can begin until T006 is complete.

- [X] T006 Create `backend/src/lib/file-storage/file-storage.service.ts` — export class `FileStorageService` (singleton pattern: `export const fileStorage = new FileStorageService()`); constructor reads env vars: `AWS_S3_REGION` (default `'auto'`), `AWS_S3_BUCKET` (required), `AWS_S3_ENDPOINT` (optional, for R2), `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `FILE_SIGNED_URL_EXPIRY_SECONDS` (default 900), `FILE_MAX_SIZE_BYTES` (default 10485760); initialize `S3Client` from `@aws-sdk/client-s3` with `{ region, bucket, endpoint, credentials: { accessKeyId, secretAccessKey } }` (only set `endpoint` if env var is non-empty); implement `uploadFile(buffer: Buffer, mimeType: string, folder: string, ext: string): Promise<string>` — generate `fileKey = \`${folder}/${v4()}${ext}\`` using `uuid` package; send `PutObjectCommand({ Bucket, Key: fileKey, Body: buffer, ContentType: mimeType, ACL: 'private' })`; return `fileKey`; implement `getSignedUrl(fileKey: string, expirySeconds?: number): Promise<string>` — use `getSignedUrl` from `@aws-sdk/s3-request-presigner` with `GetObjectCommand({ Bucket, Key: fileKey })` and `{ expiresIn: expirySeconds ?? this.config.signedUrlExpiry }`; implement `deleteFile(fileKey: string): Promise<void>` — send `DeleteObjectCommand({ Bucket, Key: fileKey })`; wrap all S3 calls in try/catch — rethrow S3 connectivity errors as `new AppError(503, 'STORAGE_UNAVAILABLE', 'File storage is temporarily unavailable')`
- [ ] T007 Run `npm run db:migrate` in `backend/` to apply migration `0007_file_keys.sql` — verify command exits 0 and columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'prescription_requests' AND column_name = 'file_keys'` returns a row (requires running PostgreSQL)
- [ ] T008 Run the permission seed: `npx tsx backend/src/db/seeds/file-storage-permissions.ts` — verify it exits 0 and `files.upload` + `files.download` rows exist in `permissions` table (requires running PostgreSQL)

**Checkpoint**: `FileStorageService` is importable and DB columns exist — user story work can now begin.

---

## Phase 3: User Story 1 — Patient Uploads a Prescription File (Priority: P1) 🎯 MVP

**Goal**: `POST /api/v1/prescriptions/:id/files` validates a file upload, stores it in S3/R2, and appends the key to the prescription record's `file_keys` array.

**Independent Test**: Quickstart Scenarios 1, 2, 3 from `specs/009-file-storage/quickstart.md`

### Implementation

- [X] T009 [US1] Add `uploadPrescriptionFile(auth: AuthContext, prescriptionId: string, file: Express.Multer.File): Promise<{ fileKey: string }>` to `backend/src/modules/healthcare/prescriptions/prescription.service.ts` — inside `withTenantContext(auth.facilityId, async (tx) => {...})`: (1) load prescription record by `prescriptionId` from `prescription_requests` where `patientId = auth.userId` OR admin with `files.upload` permission — throw `AppError(404, 'NOT_FOUND')` if not found; (2) validate ownership: if `auth.role !== 'admin'` (or lacks `files.upload` permission) and `record.patientId !== auth.userId` throw `AppError(403, 'FORBIDDEN')`; (3) validate file: if `!ALLOWED_MIME_TYPES.has(file.mimetype)` or extension of `file.originalname` not in `ALLOWED_EXTENSIONS` throw `AppError(422, 'FILE_TYPE_NOT_ALLOWED', 'File type not allowed')`; if `file.size === 0` throw `AppError(422, 'FILE_EMPTY', 'File is empty')`; (4) derive ext from `MIME_TO_EXT[file.mimetype]`; (5) call `fileStorage.uploadFile(file.buffer, file.mimetype, \`${auth.facilityId}/prescriptions\`, ext)` → `fileKey`; (6) update DB: `UPDATE prescription_requests SET file_keys = array_append(file_keys, fileKey) WHERE id = prescriptionId`; (7) insert audit_log row: `{ facilityId: auth.facilityId, userId: auth.userId, action: 'file.upload', entityType: 'prescription', entityId: prescriptionId, metadata: JSON.stringify({ fileKey, mimeType: file.mimetype, sizeBytes: file.size }) }`; (8) return `{ fileKey }`
- [X] T010 [US1] Add multer upload middleware and `POST /:id/files` route to `backend/src/modules/healthcare/prescriptions/prescription.router.ts` — add `import multer from 'multer'` and `import { fileStorage } from '@/lib/file-storage/file-storage.service'`; create `const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.FILE_MAX_SIZE_BYTES ?? 10_485_760) } })`; add route: `router.post('/:id/files', ...authMiddleware, upload.single('file'), async (req, res, next) => { try { if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } }); const result = await uploadPrescriptionFile(auth, req.params.id, req.file); res.status(201).json({ data: result }); } catch (err: unknown) { if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(422).json({ error: { code: 'FILE_TOO_LARGE', message: 'File exceeds maximum allowed size' } }); next(err); } })`

**Checkpoint**: `POST /api/v1/prescriptions/:id/files` is live. Run quickstart Scenarios 1, 2, 3.

---

## Phase 4: User Story 2 — Admin Views a Stored File via Signed URL (Priority: P1)

**Goal**: `GET /api/v1/prescriptions/:id/files/:fileKey/url` generates a 15-minute signed URL for a stored prescription file, with ownership/RBAC check and audit log entry.

**Independent Test**: Quickstart Scenarios 4, 5, 6 from `specs/009-file-storage/quickstart.md`

### Implementation

- [X] T011 [US2] Add `getPrescriptionFileUrl(auth: AuthContext, prescriptionId: string, fileKey: string): Promise<{ url: string; expiresIn: number }>` to `backend/src/modules/healthcare/prescriptions/prescription.service.ts` — inside `withTenantContext(auth.facilityId, async (tx) => {...})`: (1) load prescription record — throw `AppError(404, 'NOT_FOUND')` if not found; (2) check ownership/permission: patient must own record (`record.patientId === auth.userId`) OR auth must have `files.download` permission — throw `AppError(403, 'FORBIDDEN')` if neither; (3) validate `fileKey` is present in `record.fileKeys` array — throw `AppError(403, 'FORBIDDEN', 'File not associated with this record')` if not found; (4) call `fileStorage.getSignedUrl(fileKey)` → `url`; (5) insert audit_log row: `{ action: 'file.sign_url', entityType: 'prescription', entityId: prescriptionId, metadata: JSON.stringify({ fileKey, expirySeconds: 900 }) }`; (6) return `{ url, expiresIn: Number(process.env.FILE_SIGNED_URL_EXPIRY_SECONDS ?? 900) }`
- [X] T012 [US2] Add `GET /:id/files/:fileKey/url` route to `backend/src/modules/healthcare/prescriptions/prescription.router.ts` — `router.get('/:id/files/:fileKey/url', ...authMiddleware, async (req, res, next) => { try { const fileKey = decodeURIComponent(req.params.fileKey); const result = await getPrescriptionFileUrl(auth, req.params.id, fileKey); res.json({ data: result }); } catch (err) { next(err); } })`

**Checkpoint**: `GET /api/v1/prescriptions/:id/files/:fileKey/url` is live. Run quickstart Scenarios 4, 5, 6.

---

## Phase 5: User Story 3 — Compounding Request Attachments (Priority: P2)

**Goal**: Compounding requests support the same file upload and signed URL pattern as prescriptions. Identical contract — different entity.

**Independent Test**: Quickstart Scenario 7 from `specs/009-file-storage/quickstart.md`

### Implementation

- [X] T013 [US3] Add `uploadCompoundingFile(auth: AuthContext, compoundingId: string, file: Express.Multer.File): Promise<{ fileKey: string }>` to `backend/src/modules/healthcare/compounding/compounding.service.ts` — same pattern as `uploadPrescriptionFile` in T009: load compounding record, check ownership/permission, validate file type + size, call `fileStorage.uploadFile(file.buffer, file.mimetype, \`${auth.facilityId}/compounding\`, ext)`, `array_append` result key to `compounding_requests.file_keys`, insert audit_log with `entityType: 'compounding'`, return `{ fileKey }`
- [X] T014 [US3] Add multer middleware and `POST /:id/files` route to `backend/src/modules/healthcare/compounding/compounding.router.ts` — identical structure to the prescription route in T010; change service call to `uploadCompoundingFile`; keep the same multer config reference (or duplicate `const upload = multer(...)` locally — no shared instance needed)
- [X] T015 [US3] Add `getCompoundingFileUrl(auth: AuthContext, compoundingId: string, fileKey: string): Promise<{ url: string; expiresIn: number }>` to `backend/src/modules/healthcare/compounding/compounding.service.ts` — same pattern as `getPrescriptionFileUrl` in T011; audit_log `entityType: 'compounding'`
- [X] T016 [US3] Add `GET /:id/files/:fileKey/url` route to `backend/src/modules/healthcare/compounding/compounding.router.ts` — identical structure to the prescription signed URL route in T012; change service call to `getCompoundingFileUrl`

**Checkpoint**: `POST /api/v1/compounding/:id/files` and `GET /api/v1/compounding/:id/files/:fileKey/url` are live. Run quickstart Scenario 7.

---

## Phase 6: User Story 4 — Migrate Existing Base64 Files (Priority: P2)

**Goal**: One-shot idempotent script that reads all rows with non-null `file_reference`, uploads each to S3/R2, writes the key to `file_keys`, and clears `file_reference`.

**Independent Test**: Quickstart Scenario 8 from `specs/009-file-storage/quickstart.md`

### Implementation

- [X] T017 [US4] Create `backend/src/scripts/migrate-base64-files.ts` — import `workerDb` from `@/db`; import `fileStorage` from `@/lib/file-storage/file-storage.service`; query both `prescription_requests` and `compounding_requests` using `workerDb` (BYPASSRLS — needed to read across all facilities); for each row where `file_reference IS NOT NULL` AND `array_length(file_keys, 1) IS NULL` (i.e. `file_keys = '{}'`): try { (1) decode `file_reference` value — if it starts with `data:` it's base64 (`data:mime;base64,<data>`), extract mime + buffer; if not base64, treat as a legacy file path and skip with a warning; (2) derive ext from mime via `MIME_TO_EXT`; (3) call `fileStorage.uploadFile(buffer, mime, \`${row.facility_id}/<module>\`, ext)` → key; (4) `UPDATE <table> SET file_keys = ARRAY[key], file_reference = NULL WHERE id = row.id`; (5) increment `migrated` counter } catch (err) { log row id + error; increment `failed` counter }; rows with `file_reference IS NULL` are skipped (increment `skipped`); print summary at end: `console.log(\`Migration complete: migrated=${migrated}, skipped=${skipped}, failed=${failed}\`)`; exit code 0 always (per spec SC-006); add `if (require.main === module)` runner block

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Typecheck, lint, and full quickstart validation.

- [X] T018 Run `npm run typecheck` in `backend/` — verify 0 TypeScript errors across all new and modified files: `file-storage.types.ts`, `file-storage.service.ts`, updated `healthcare.ts` schema, `prescription.service.ts`, `prescription.router.ts`, `compounding.service.ts`, `compounding.router.ts`, `migrate-base64-files.ts`, `file-storage-permissions.ts`
- [X] T019 Run `npm run lint` in `backend/` — verify 0 ESLint errors; confirm `fileStorage` is never imported from outside `src/lib/file-storage/` (it must be used via the service layer functions, which are called from the router — constitution §I)
- [ ] T020 Run quickstart.md Scenarios 1–9 against a running backend — verify all expected response shapes and HTTP status codes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T005 all independent — run in parallel immediately
- **Foundational (Phase 2)**: T006 can start after T002 (types file needed for imports); T007 depends on T003 + T004; T008 depends on T005 — all require running PostgreSQL
- **Phase 3 (US1)**: Depends on T006 (FileStorageService) + T007 (migration applied); T009 before T010 (service before router)
- **Phase 4 (US2)**: Depends on Phase 3 complete (adds to same service.ts and router.ts); T011 before T012
- **Phase 5 (US3)**: Depends on T006 (FileStorageService) — independent of Phase 3/4; T013 before T014, T015 before T016
- **Phase 6 (US4)**: Depends on T006 (FileStorageService) + T007 (migration columns must exist)
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on T006 + T007 — creates new service function + route
- **US2 (P1)**: Depends on US1 complete — adds to the same service.ts and router.ts created by US1
- **US3 (P2)**: Depends on T006 + T007 — independent of US1/US2
- **US4 (P2)**: Depends on T006 + T007 — standalone script

### Within Each User Story

- Service function (T009, T011, T013, T015) before its router task (T010, T012, T014, T016)
- DB migration (T007) before any service function that writes `file_keys`

### Parallel Opportunities

- T001–T005 (Phase 1): all fully independent — run simultaneously
- T013/T015 (US3 service functions): can run in parallel (different functions in same file)
- T014/T016 (US3 router additions): sequential (same router file) — T014 then T016

---

## Parallel Example: Phase 1 Setup

```bash
# All five Phase 1 tasks are independent files:
Task T001: "Install packages in backend/"
Task T002: "Create file-storage.types.ts"
Task T003: "Create 0007_file_keys.sql migration"
Task T004: "Update healthcare.ts schema"
Task T005: "Create file-storage-permissions.ts seed"
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1)

1. Complete Phase 1: T001–T005 (parallel)
2. Complete Phase 2: T006 → T007 → T008 (sequential; T007/T008 require running DB)
3. Complete Phase 3: T009 → T010 (Prescription Upload live)
4. Complete Phase 4: T011 → T012 (Prescription Signed URL live)
5. **STOP and VALIDATE**: Quickstart Scenarios 1–6

### Incremental Delivery

1. Phase 1 + 2 → Infrastructure ready
2. Phase 3 → Prescription upload live (MVP P1)
3. Phase 4 → Signed URL live (MVP P1 complete)
4. Phase 5 → Compounding files live (P2)
5. Phase 6 → Migration script (P2)
6. Phase 7 → Typecheck + lint + full validation

---

## Notes

- T006 (`FileStorageService`) is the single most critical task — all US tasks depend on it
- The `fileStorage` singleton is imported ONLY inside service layer functions (`prescription.service.ts`, `compounding.service.ts`, `migrate-base64-files.ts`); it MUST NOT be imported directly in router files — constitution §I
- `workerDb` in T017 is the only legitimate use of BYPASSRLS here — it is a migration script, not a request handler
- `file_reference` column is NOT dropped in this phase — kept null after migration; it can be dropped in a future cleanup
- For T007/T008 (DB ops): if PostgreSQL is not running locally, mark as deferred (same pattern as Phase 8 T004)
- `multer.MulterError` with `LIMIT_FILE_SIZE` code is the standard way to catch oversized uploads from multer middleware

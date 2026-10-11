# Implementation Plan: File Storage

**Branch**: `009-file-storage` | **Date**: 2026-10-11 | **Spec**: [specs/009-file-storage/spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-file-storage/spec.md`

## Summary

Replace all base64/text file storage in database rows with private S3-compatible object storage (AWS S3 or Cloudflare R2). New uploads for prescription requests and compounding requests are validated (JPEG/PNG/GIF/WebP/PDF, ≤10 MB), stored via a `FileStorageService` abstraction, and referenced by a key string stored in the database. Existing base64 data (if any) is migrated via an idempotent one-shot script. Files are served exclusively via 15-minute signed URLs — file bytes never pass through the application server.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict, no `.js` application files)

**Primary Dependencies**:
- Existing: Express.js 4.x, Drizzle ORM 0.38, PostgreSQL (`postgres` driver), Zod 3.x, `uuid`
- New (to install): `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer`, `@types/multer`

**Storage**: PostgreSQL (file keys as `text[]` column), S3-compatible object storage (file bytes)

**Testing**: None requested

**Target Platform**: Node.js 22, Linux server

**Project Type**: web-service backend (Express.js REST API)

**Performance Goals**: File upload ≤5 MB completes in <3s; signed URL generation <200ms

**Constraints**: ≤10 MB per file; allowlist: JPEG, PNG, GIF, WebP, PDF; signed URL expiry default 15 minutes (configurable via `FILE_SIGNED_URL_EXPIRY_SECONDS`); files MUST be private (no public-read ACL); tenant-scoped key namespace

**Scale/Scope**: One S3 bucket per environment; tenant separation via key prefix; ~hundreds of prescription files at launch

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement | Status |
|------|-------------|--------|
| §I — Tenant Isolation | Upload endpoints use `withTenantContext`; file keys namespaced `{facilityId}/...` — tenant separation at key level | PASS |
| §II — Explicit Auth | Upload + signed URL routes chain JWT → session → RBAC before any DB transaction | PASS |
| §III — PG source of truth | File keys stored in PostgreSQL; S3 is storage layer only; no durable state in S3 alone | PASS |
| §IV — Audit all PHI access | `file.upload` and `file.sign_url` operations MUST be written to `audit_log` (FR-012) | PASS — required |
| §V — Phase-gated | spec-kit workflow used; predecessor phases complete | PASS |

Post-design re-check: No new violations. `FileStorageService` is pure I/O — it does not access the DB. It is called from within service layer functions that operate inside `withTenantContext`, satisfying §I. Audit writes happen inside the same `withTenantContext` transaction.

## Project Structure

### Documentation (this feature)

```text
specs/009-file-storage/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── files.md
└── tasks.md             ← /speckit-tasks output (not yet created)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── lib/
│   │   └── file-storage/
│   │       ├── file-storage.service.ts     ← FileStorageService class (S3 SDK)
│   │       └── file-storage.types.ts       ← FileUploadResult, FileStorageConfig
│   ├── modules/
│   │   └── healthcare/
│   │       ├── prescriptions/
│   │       │   ├── prescription.service.ts ← add uploadPrescriptionFile(), getPrescriptionFileUrl()
│   │       │   └── prescription.router.ts  ← add POST /:id/files, GET /:id/files/:fileKey/url
│   │       └── compounding/
│   │           ├── compounding.service.ts  ← add uploadCompoundingFile(), getCompoundingFileUrl()
│   │           └── compounding.router.ts   ← add POST /:id/files, GET /:id/files/:fileKey/url
│   ├── db/
│   │   ├── schema/
│   │   │   └── healthcare.ts               ← change file_reference: text() → file_keys: text().array()
│   │   └── seeds/
│   │       └── file-storage-permissions.ts ← seed files.upload + files.download
│   └── scripts/
│       └── migrate-base64-files.ts         ← one-shot idempotent migration script (uses workerDb)
├── drizzle/
│   └── migrations/                         ← new migration: 0007_file_keys.sql
└── package.json                            ← add @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, multer, @types/multer
```

**Structure Decision**: `FileStorageService` lives in `src/lib/file-storage/` (infrastructure layer, shared across modules), not inside a feature module. The migration script lives in `src/scripts/` as a standalone executable using `workerDb` (BYPASSRLS) to read across all facility rows.

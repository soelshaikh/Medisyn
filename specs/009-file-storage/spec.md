# Feature Specification: File Storage

**Feature Branch**: `009-file-storage`

**Created**: 2026-10-11

**Status**: Draft

**Input**: Phase 9 — replace in-database base64 file storage with private S3-compatible object storage (AWS S3 or Cloudflare R2) and serve files via short-lived signed URLs. Applies to prescription uploads, compounding request attachments, and any user-uploaded documents across the platform.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Patient Uploads a Prescription File (Priority: P1)

A patient submitting a prescription request attaches one or more files (images or PDFs) of their prescription. The files are stored securely in private cloud storage — not in the database — and the patient receives confirmation that their files were received.

**Why this priority**: Prescription files contain PHI. Storing them as base64 blobs in the database violates the CONFIRMED architectural constraint and poses a storage/performance risk. Fixing this is a prerequisite for all file-related features.

**Independent Test**: Submit a prescription request with a valid image attachment → response includes a `fileKey` reference, not raw base64. The database row contains only a storage key, not file bytes. Fetching the file via a signed URL returns the original bytes within the signed URL's validity window.

**Acceptance Scenarios**:

1. **Given** a patient is authenticated, **When** they upload a prescription file (JPEG, PNG, or PDF, ≤10 MB), **Then** the file is stored in private cloud storage and the prescription record contains only a storage key (no base64, no raw bytes in the DB row).
2. **Given** a patient uploads a file type not on the allowed list (e.g. `.exe`, `.sh`), **When** the upload is attempted, **Then** the server rejects the upload with a clear error message before the file reaches storage.
3. **Given** a file larger than the configured maximum size, **When** the upload is attempted, **Then** the server rejects it with a file-size error before the file reaches storage.
4. **Given** a successful upload, **When** an admin requests to view the prescription, **Then** the API returns a short-lived signed URL (valid for 15 minutes) that serves the file directly from storage without exposing storage credentials.

---

### User Story 2 — Admin Views a Stored File via Signed URL (Priority: P1)

An admin reviewing a prescription request or compounding submission needs to view the attached files. They receive a time-limited signed URL that lets them download or preview the file directly without the file bytes ever passing through the application server.

**Why this priority**: Admins cannot review and approve healthcare requests without being able to view attachments. This is the read path for all file-related workflows.

**Independent Test**: Admin calls `GET /prescriptions/:id/files/:fileKey/url` → response contains a signed URL. GETting that URL returns the file with the correct `Content-Type` header. After 15 minutes, the same URL returns an access-denied response.

**Acceptance Scenarios**:

1. **Given** an admin with the correct RBAC permission, **When** they request a signed URL for a stored file, **Then** the response contains a URL valid for exactly 15 minutes that serves the original file bytes.
2. **Given** a patient attempting to request a signed URL for another patient's file, **When** they make the request, **Then** the API returns 403 — file ownership is validated before a signed URL is issued.
3. **Given** a signed URL that has expired, **When** a browser GETs it, **Then** the storage provider returns an access-denied response (no re-validation needed on the application server).
4. **Given** an admin requests a URL for a file key that does not exist in storage, **When** the signed URL is generated and accessed, **Then** the storage provider returns a 404/403. The API does not need to pre-validate file existence before signing.

---

### User Story 3 — Compounding Request Attachments (Priority: P2)

A patient submitting a compounding request can attach supporting documents (lab results, physician notes). These follow the same private storage + signed URL pattern as prescription files, handled by the same underlying file storage service.

**Why this priority**: Compounding is a separate module (CONFIRMED). Its file handling must be consistent with prescriptions but is lower priority because prescription uploads are more common.

**Independent Test**: Submit a compounding request with an attached PDF → the compounding request record stores only a file key. Fetching the signed URL returns the PDF with `Content-Type: application/pdf`.

**Acceptance Scenarios**:

1. **Given** a patient submits a compounding request with an attachment, **When** the request is processed, **Then** the attachment is stored in private cloud storage and only a key reference is stored in the compounding_requests table.
2. **Given** an admin reviews the compounding request, **When** they request a signed URL for the attachment, **Then** the file is accessible via a 15-minute signed URL.

---

### User Story 4 — Migrate Existing Base64 Files (Priority: P2)

Any prescription or compounding request records that currently store files as base64 in the database must be migrated to private cloud storage. After migration, the database columns contain storage keys, not raw bytes.

**Why this priority**: New uploads are clean from Phase 9 onwards. Existing data must also be migrated to remove PHI from the database. Migration can run as a one-shot script without downtime — records are few.

**Independent Test**: Run the migration script → every prescription_requests row that previously had a non-null base64 `file_data` column now has a `file_key` value and `file_data` is null. Fetching a signed URL for a migrated key returns the original file bytes.

**Acceptance Scenarios**:

1. **Given** existing database rows with base64 file data, **When** the migration script runs, **Then** each file is uploaded to private storage, the storage key is written to the record, and the base64 column is cleared.
2. **Given** a row where the base64 column is already null (no file attached), **When** the migration script runs, **Then** the row is skipped without error.
3. **Given** a migration failure on a single row (e.g. corrupted base64), **When** the script encounters it, **Then** the row is logged and skipped — the script does not abort the entire migration.

---

### Edge Cases

- What if storage is unreachable during upload? → Return 503 SERVICE_UNAVAILABLE; do not save a partial record.
- What if the same file is uploaded twice? → Each upload gets a unique key (include UUID or timestamp in the key path); no deduplication.
- What if a record is deleted? → File deletion from storage is out of scope for this phase — keys become orphaned but storage cleanup is deferred to a future data-retention phase.
- What if the file is zero bytes? → Reject with a validation error before upload.
- What happens to signed URLs after a user account is deactivated? → Signed URLs already issued remain valid until expiry; no revocation mechanism in this phase.
- What file types are accepted? → JPEG, PNG, GIF, WebP (images) and PDF (documents). All other types rejected.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a `FileStorageService` abstraction that supports at minimum: `uploadFile(buffer, mimeType, folder) → fileKey`, `getSignedUrl(fileKey, expirySeconds) → url`, and `deleteFile(fileKey)` operations.
- **FR-002**: The FileStorageService implementation MUST connect to an S3-compatible storage provider (AWS S3 or Cloudflare R2). The provider is selected by configuration, not by code changes — switching providers requires only an environment variable change.
- **FR-003**: All stored files MUST be private — no public-read ACL. Files are accessible only via signed URLs issued by the application.
- **FR-004**: Upload endpoints MUST validate file type against an allowlist (JPEG, PNG, GIF, WebP, PDF). Any other MIME type or file extension MUST be rejected before the file is sent to storage.
- **FR-005**: Upload endpoints MUST enforce a maximum file size of 10 MB per file. Files exceeding this limit MUST be rejected before upload.
- **FR-006**: Signed URLs MUST expire after a configurable duration (default: 15 minutes). The expiry is set at URL generation time and cannot be extended.
- **FR-007**: File keys MUST be namespaced by facility and module (e.g. `{facilityId}/prescriptions/{uuid}.pdf`) so files are logically separated per tenant and per domain.
- **FR-008**: The prescription request module MUST use FileStorageService for all file uploads. Prescription records MUST store only the `fileKey` string, not file bytes.
- **FR-009**: The compounding request module MUST use FileStorageService for all file uploads. Compounding records MUST store only the `fileKey` string, not file bytes.
- **FR-010**: A one-shot migration script MUST be provided that reads all existing prescription_requests rows with base64 file data, uploads each to storage, writes the resulting key back, and clears the base64 column. The script MUST be idempotent (safe to run twice without duplicating uploads for already-migrated rows).
- **FR-011**: Signed URL generation MUST enforce ownership — the requesting user must own or be authorized to access the record the file belongs to (RBAC permission check for admin users; ownership check for patient users).
- **FR-012**: All file upload and download operations MUST be logged in the audit log with user ID, file key, and operation type.

### Key Entities

- **FileStorageService**: Application-layer abstraction over S3/R2 — upload, sign, delete operations.
- **File Key**: A stable storage path string (`{facilityId}/{module}/{uuid}.{ext}`) stored in DB records instead of file bytes.
- **Signed URL**: A time-limited URL generated by the storage provider that grants temporary read access to a private object.
- **Migration Script**: A one-shot Node.js script that moves base64 blobs from the database to cloud storage.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After Phase 9 is deployed, zero prescription_requests rows contain non-null base64 file data — all files are referenced by key.
- **SC-002**: File upload (≤5 MB) completes in under 3 seconds on a standard connection.
- **SC-003**: Signed URL generation (no file content transferred) completes in under 200ms.
- **SC-004**: Uploading a disallowed file type (e.g. `.exe`) returns a 422 error — the file never reaches cloud storage.
- **SC-005**: A signed URL accessed after its expiry returns an access-denied response from the storage provider (not from the application server).
- **SC-006**: The migration script processes all existing records and completes with an exit code of 0 and a summary log of rows migrated, rows skipped, and rows failed.

---

## Assumptions

- The storage provider is AWS S3 or Cloudflare R2 — both are S3-compatible and the same SDK (`@aws-sdk/client-s3`) works for both.
- File size limit is 10 MB per file; this covers all expected healthcare document sizes (prescriptions, lab PDFs) without exceeding typical S3 multipart upload thresholds.
- Signed URL expiry default is 15 minutes, configurable via environment variable. This balances usability (admin can view file while reviewing a case) with security (URL does not remain valid indefinitely).
- File type validation is performed on MIME type AND file extension — both must be on the allowlist. MIME sniffing (reading file bytes to confirm type) is out of scope for this phase.
- The migration script is run manually by an operator after deployment; it is not triggered automatically.
- Deleting files from storage when records are deleted is out of scope — orphan cleanup belongs in a future data-retention phase.
- There is only one storage bucket per environment (not per facility). Tenant separation is achieved by the key namespace prefix (`{facilityId}/...`).
- No CDN or caching layer is needed for this phase — signed URLs point directly to the storage provider.
- Multi-file uploads (multiple files per prescription) are supported — each file gets its own key. The database stores an array of keys.

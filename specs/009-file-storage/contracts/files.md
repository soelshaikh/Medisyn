# API Contracts: File Storage

**Feature**: 009-file-storage  
**Date**: 2026-10-11  
**Base path**: `/api/v1`

All routes require authentication (JWT). Authorization details are noted per route.

---

## Prescription File Routes

### POST `/prescriptions/:id/files`

Upload a file to an existing prescription request.

**Authorization**: Authenticated patient who owns the prescription (`patientId === auth.userId`) OR admin with `files.upload` permission.

**Request**:
- `Content-Type: multipart/form-data`
- Field: `file` (binary — required)

**Constraints** (validated before upload reaches S3):
- MIME type must be one of: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`
- File extension (from `originalname`) must be one of: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.pdf`
- File size must be > 0 bytes and ≤ `FILE_MAX_SIZE_BYTES` (default 10 MB)

**Success — 201 Created**:
```json
{
  "data": {
    "fileKey": "fac_abc123/prescriptions/550e8400-e29b-41d4-a716-446655440000.pdf"
  }
}
```

**Error responses**:

| HTTP | Code | Condition |
|------|------|-----------|
| 400 | `NO_FILE` | No file field in request body |
| 404 | `NOT_FOUND` | Prescription record not found (or belongs to different facility) |
| 403 | `FORBIDDEN` | Patient does not own this prescription; or lacks `files.upload` |
| 422 | `FILE_TYPE_NOT_ALLOWED` | MIME type or extension not on allowlist |
| 422 | `FILE_TOO_LARGE` | File exceeds max size |
| 422 | `FILE_EMPTY` | File is zero bytes |
| 503 | `STORAGE_UNAVAILABLE` | S3/R2 unreachable |

**Side effects**:
- File key appended to `prescription_requests.file_keys` array
- Audit log entry written: `{ action: 'file.upload', entityType: 'prescription', entityId: id, metadata: { fileKey, mimeType, sizeBytes } }`

---

### GET `/prescriptions/:id/files/:fileKey/url`

Generate a short-lived signed URL for reading a prescription file.

**Authorization**: Authenticated patient who owns the prescription (`patientId === auth.userId`) OR admin with `files.download` permission.

**Path params**:
- `id` — prescription request UUID
- `fileKey` — the full file key string (e.g. `fac_abc123/prescriptions/uuid.pdf`) — URL-encoded

**Success — 200 OK**:
```json
{
  "data": {
    "url": "https://medisyn-files.s3.amazonaws.com/fac_abc123/prescriptions/uuid.pdf?X-Amz-Signature=...",
    "expiresIn": 900
  }
}
```

**Error responses**:

| HTTP | Code | Condition |
|------|------|-----------|
| 404 | `NOT_FOUND` | Prescription record not found |
| 403 | `FORBIDDEN` | Patient does not own; or lacks `files.download`; or fileKey not in record's `file_keys` |
| 503 | `STORAGE_UNAVAILABLE` | S3/R2 unreachable |

**Side effects**:
- Audit log entry written: `{ action: 'file.sign_url', entityType: 'prescription', entityId: id, metadata: { fileKey, expirySeconds } }`

**Note**: The API does not pre-validate that the object exists in S3 before generating the signed URL. If the key is absent in storage, the storage provider returns 403/404 when the URL is accessed.

---

## Compounding File Routes

### POST `/compounding/:id/files`

Upload a file to an existing compounding request. Same contract as prescription upload.

**Authorization**: Authenticated patient who owns the compounding request (`patientId === auth.userId`) OR admin with `files.upload` permission.

**Request / Constraints / Errors**: Identical to `POST /prescriptions/:id/files` — replace entity name.

**Success — 201 Created**:
```json
{
  "data": {
    "fileKey": "fac_abc123/compounding/550e8400-e29b-41d4-a716-446655440001.jpg"
  }
}
```

**Side effects**:
- File key appended to `compounding_requests.file_keys` array
- Audit log entry written: `{ action: 'file.upload', entityType: 'compounding', entityId: id, metadata: { fileKey, mimeType, sizeBytes } }`

---

### GET `/compounding/:id/files/:fileKey/url`

Generate a short-lived signed URL for reading a compounding file. Same contract as prescription signed URL.

**Authorization**: Authenticated patient who owns the compounding request OR admin with `files.download` permission.

**Success / Errors / Side effects**: Identical to `GET /prescriptions/:id/files/:fileKey/url` — replace entity name.

---

## Shared Validation Rules

| Rule | Value | Error Code |
|------|-------|-----------|
| Allowed MIME types | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf` | `FILE_TYPE_NOT_ALLOWED` |
| Allowed extensions | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.pdf` | `FILE_TYPE_NOT_ALLOWED` |
| Max file size | 10 MB (configurable via `FILE_MAX_SIZE_BYTES`) | `FILE_TOO_LARGE` |
| Min file size | > 0 bytes | `FILE_EMPTY` |
| Signed URL TTL | 900 seconds (configurable via `FILE_SIGNED_URL_EXPIRY_SECONDS`) | — |

---

## Permission Requirements

| Operation | Permission | Patient Override |
|-----------|-----------|-----------------|
| Upload file | `files.upload` | Patient owns the record |
| Get signed URL | `files.download` | Patient owns the record |

---

## File Key Ownership Validation

Before generating a signed URL, the server checks that `fileKey` is present in the record's `file_keys` array. A valid key not in the record's array returns `403 FORBIDDEN`. This prevents a user from requesting a signed URL for a file key they fabricated or obtained from another record.

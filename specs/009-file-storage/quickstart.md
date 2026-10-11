# Quickstart: File Storage

**Feature**: 009-file-storage  
**Date**: 2026-10-11  
**Purpose**: End-to-end validation scenarios to confirm the feature works before sign-off

---

## Prerequisites

- Backend running locally (`npm run dev` in `backend/`)
- `.env` includes: `AWS_S3_BUCKET`, `AWS_S3_ACCESS_KEY_ID`, `AWS_S3_SECRET_ACCESS_KEY`, `AWS_S3_REGION`, and optionally `AWS_S3_ENDPOINT` (for R2)
- Migration `0007_file_keys.sql` applied: `npm run db:migrate` in `backend/`
- Permissions seeded: `npx tsx backend/src/db/seeds/file-storage-permissions.ts`
- A seeded patient user JWT: `PATIENT_TOKEN`
- A seeded admin user JWT with `files.upload` + `files.download` permissions: `ADMIN_TOKEN`
- A seeded prescription record owned by the patient: `PRESCRIPTION_ID`
- A seeded compounding record owned by the patient: `COMPOUNDING_ID`
- A small test PDF at `/tmp/test.pdf` and a small JPEG at `/tmp/test.jpg`

---

## Scenario 1 — Upload a Valid Prescription File (Happy Path)

**Goal**: Patient uploads a PDF to their prescription. Response contains a file key. DB stores the key.

```bash
curl -X POST "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -F "file=@/tmp/test.pdf"
```

**Expected**:
- HTTP 201
- Body: `{ "data": { "fileKey": "fac_.../prescriptions/...uuid....pdf" } }`
- DB check: `SELECT file_keys FROM prescription_requests WHERE id = '$PRESCRIPTION_ID'` returns non-empty array containing the key

---

## Scenario 2 — Upload an Unsupported File Type

**Goal**: Server rejects a `.exe` file before it reaches storage.

```bash
# Create a dummy .exe file
echo "MZ" > /tmp/test.exe

curl -X POST "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -F "file=@/tmp/test.exe"
```

**Expected**:
- HTTP 422
- Body: `{ "error": { "code": "FILE_TYPE_NOT_ALLOWED", ... } }`
- S3/R2 receives zero requests (file is rejected before upload)

---

## Scenario 3 — Upload Exceeding Size Limit

**Goal**: Server rejects a file larger than 10 MB.

```bash
# Create an 11 MB dummy file
dd if=/dev/zero of=/tmp/big.pdf bs=1M count=11

curl -X POST "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -F "file=@/tmp/big.pdf"
```

**Expected**:
- HTTP 422
- Body: `{ "error": { "code": "FILE_TOO_LARGE", ... } }`

---

## Scenario 4 — Get a Signed URL (Happy Path)

**Goal**: After a successful upload, the patient requests a signed URL and it returns the original file bytes.

```bash
# Use the fileKey from Scenario 1 result
FILE_KEY="fac_.../prescriptions/...uuid....pdf"
ENCODED_KEY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FILE_KEY', safe=''))")

curl -X GET "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files/$ENCODED_KEY/url" \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```

**Expected**:
- HTTP 200
- Body: `{ "data": { "url": "https://...", "expiresIn": 900 } }`
- GETting the returned URL in a browser or with curl returns the original PDF with `Content-Type: application/pdf`

---

## Scenario 5 — Admin Access via Signed URL

**Goal**: Admin with `files.download` permission can get a signed URL for any prescription in their facility.

```bash
curl -X GET "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files/$ENCODED_KEY/url" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected**:
- HTTP 200
- Same response shape as Scenario 4

---

## Scenario 6 — Patient Cannot Access Another Patient's File

**Goal**: A patient cannot get a signed URL for a prescription they do not own.

```bash
# PATIENT_TOKEN_2 = JWT for a different patient
curl -X GET "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files/$ENCODED_KEY/url" \
  -H "Authorization: Bearer $PATIENT_TOKEN_2"
```

**Expected**:
- HTTP 403
- Body: `{ "error": { "code": "FORBIDDEN" } }`

---

## Scenario 7 — Compounding Request File Upload

**Goal**: Compounding file upload follows the same path as prescriptions.

```bash
curl -X POST "http://localhost:3000/api/v1/compounding/$COMPOUNDING_ID/files" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -F "file=@/tmp/test.jpg"
```

**Expected**:
- HTTP 201
- `fileKey` contains `.../compounding/...uuid....jpg`
- DB check: `SELECT file_keys FROM compounding_requests WHERE id = '$COMPOUNDING_ID'` contains the key

---

## Scenario 8 — Migration Script (One-Shot)

**Goal**: Any rows with non-null `file_reference` are migrated to S3; `file_keys` is populated; `file_reference` is cleared.

```bash
# First run
npx tsx backend/src/scripts/migrate-base64-files.ts

# Second run (idempotent — should skip all rows, process 0)
npx tsx backend/src/scripts/migrate-base64-files.ts
```

**Expected (first run)**:
- Exit code 0
- Console log: summary with `migrated: N, skipped: 0, failed: 0` (or failed count if any rows had corrupted data)
- DB check: `SELECT COUNT(*) FROM prescription_requests WHERE file_reference IS NOT NULL` returns 0
- DB check: `SELECT COUNT(*) FROM prescription_requests WHERE array_length(file_keys, 1) > 0` equals the count of rows that had `file_reference`

**Expected (second run)**:
- Exit code 0
- `migrated: 0, skipped: N` (all rows already have empty `file_reference`)

---

## Scenario 9 — Zero-Byte File Rejection

**Goal**: An empty file is rejected before upload.

```bash
touch /tmp/empty.pdf

curl -X POST "http://localhost:3000/api/v1/prescriptions/$PRESCRIPTION_ID/files" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -F "file=@/tmp/empty.pdf"
```

**Expected**:
- HTTP 422
- Body: `{ "error": { "code": "FILE_EMPTY" } }`

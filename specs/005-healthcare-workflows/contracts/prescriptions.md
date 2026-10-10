# API Contract: Prescription Requests

Base path: `/api/v1`  
All requests require `X-Facility-ID: <facilityId>` header.

---

## POST /prescriptions — Submit Prescription Request (Patient)

**Auth**: `authMiddleware` (patient)

**Request Body**:
```json
{
  "type": "refill",
  "medicationName": "Metformin",
  "dosage": "500mg twice daily",
  "prescriberName": "Dr. Jane Smith",
  "prescriberFax": "416-555-0100",
  "fileReference": "prescriptions/abc123.pdf"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | yes | enum: `refill`, `transfer`, `new` |
| `medicationName` | string | yes | min 1, max 200 chars |
| `dosage` | string | no | max 100 chars |
| `prescriberName` | string | no | max 200 chars |
| `prescriberFax` | string | no | max 30 chars |
| `fileReference` | string | no | any string — no URL validation in Phase 5 |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "type": "refill",
    "medicationName": "Metformin",
    "dosage": "500mg twice daily",
    "prescriberName": "Dr. Jane Smith",
    "prescriberFax": "416-555-0100",
    "fileReference": "prescriptions/abc123.pdf",
    "status": "submitted",
    "dispenseNotes": null,
    "createdAt": "2026-10-10T12:00:00Z",
    "updatedAt": "2026-10-10T12:00:00Z"
  }
}
```

Note: `internalNotes` is NEVER present in patient-facing responses.

**Errors**: `422 VALIDATION_ERROR`

---

## GET /prescriptions — List Patient's Own Requests

**Auth**: `authMiddleware` (patient — sees only own requests)

**Query Params**: `status?`, `page?` (default 1), `limit?` (default 20, max 100)

**Response 200**:
```json
{
  "data": [ { ...prescription summary... } ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

## GET /prescriptions/:id — Patient Request Detail

**Auth**: `authMiddleware` — returns 404 if not owned by patient

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "type": "refill",
    "medicationName": "Metformin",
    "dosage": "500mg twice daily",
    "prescriberName": "Dr. Jane Smith",
    "prescriberFax": "416-555-0100",
    "fileReference": "prescriptions/abc123.pdf",
    "status": "approved",
    "dispenseNotes": "Ready for pickup after 3pm",
    "statusHistory": [
      { "previousStatus": null, "newStatus": "submitted", "changedByName": null, "note": null, "createdAt": "..." },
      { "previousStatus": "submitted", "newStatus": "approved", "changedByName": "Pharmacist Ali", "note": null, "createdAt": "..." }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors**: `404 PRESCRIPTION_REQUEST_NOT_FOUND`

---

## GET /admin/prescriptions — Admin List (All Patients)

**Auth**: `authMiddleware` + `requirePermission('prescriptions.read')`

**Query Params**: `status?`, `patientId?`, `type?`, `dateFrom?`, `dateTo?`, `page?`, `limit?`, `sort?` (createdAt:asc|desc)

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "patientName": "John Doe",
      "type": "refill",
      "medicationName": "Metformin",
      "status": "submitted",
      "createdAt": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

## GET /admin/prescriptions/:id — Admin Detail (Includes Internal Notes)

**Auth**: `authMiddleware` + `requirePermission('prescriptions.read')`

**Response 200**: Full prescription object including `internalNotes` and `patientName` + `patientEmail`.

---

## PATCH /admin/prescriptions/:id/status — Change Status

**Auth**: `authMiddleware` + `requirePermission('prescriptions.manage')`

**Request Body**:
```json
{
  "newStatus": "approved",
  "dispenseNotes": "Ready for pickup tomorrow after 2pm",
  "internalNotes": "Called prescriber to confirm",
  "note": "Verified with prescriber office"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `newStatus` | string | yes | must be valid transition from current status |
| `dispenseNotes` | string | no | patient-visible |
| `internalNotes` | string | no | staff-only |
| `note` | string | no | appended to status history entry |

**Response 200**: `{ "data": { "success": true } }`

**Errors**: `404 PRESCRIPTION_REQUEST_NOT_FOUND`, `422 HEALTHCARE_INVALID_STATUS_TRANSITION`

# API Contract: Compounding Requests

Base path: `/api/v1`  
All requests require `X-Facility-ID: <facilityId>` header.

---

## POST /compounding — Submit Compounding Request (Patient)

**Auth**: `authMiddleware` (patient)

**Request Body**:
```json
{
  "compoundName": "Progesterone Cream",
  "strength": "100mg/mL",
  "form": "cream",
  "quantity": "60g",
  "specialInstructions": "Fragrance-free base, no parabens",
  "prescriberName": "Dr. Kim Lee",
  "fileReference": "compounding/rx456.pdf"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `compoundName` | string | yes | min 1, max 200 |
| `strength` | string | no | max 100 |
| `form` | string | yes | enum: `tablet`, `capsule`, `liquid`, `cream`, `suppository`, `other` |
| `quantity` | string | yes | min 1, max 100 |
| `specialInstructions` | string | no | max 1000 |
| `prescriberName` | string | no | max 200 |
| `fileReference` | string | no | |

**Response 201**: Created compounding request (patient view — no `internalNotes`).

---

## GET /compounding — List Patient's Own Requests

**Auth**: `authMiddleware`

**Query Params**: `status?`, `page?`, `limit?`

**Response 200**: Paginated list of patient's own compounding requests.

---

## GET /compounding/:id — Patient Detail

**Auth**: `authMiddleware` — 404 if not owned by patient

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "compoundName": "Progesterone Cream",
    "strength": "100mg/mL",
    "form": "cream",
    "quantity": "60g",
    "specialInstructions": "Fragrance-free base, no parabens",
    "prescriberName": "Dr. Kim Lee",
    "fileReference": "compounding/rx456.pdf",
    "quotedPrice": "45.00",
    "quotedTurnaroundDays": 5,
    "status": "quoted",
    "statusHistory": [ ... ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Note: `internalNotes` NEVER in patient response.

**Errors**: `404 COMPOUNDING_REQUEST_NOT_FOUND`

---

## POST /compounding/:id/accept — Patient Accepts Quote

**Auth**: `authMiddleware` (patient — must own the request)

Transitions: `quoted → accepted`

**Request Body**: none required (or optional `note`)

**Response 200**: `{ "data": { "success": true } }`

**Errors**: `404 COMPOUNDING_REQUEST_NOT_FOUND`, `422 HEALTHCARE_INVALID_STATUS_TRANSITION`

---

## POST /compounding/:id/decline — Patient Declines Quote

**Auth**: `authMiddleware` (patient — must own the request)

Transitions: `quoted → patient_declined`

**Request Body**:
```json
{ "note": "Price is too high, will look elsewhere" }
```

**Response 200**: `{ "data": { "success": true } }`

**Errors**: `404 COMPOUNDING_REQUEST_NOT_FOUND`, `422 HEALTHCARE_INVALID_STATUS_TRANSITION`

---

## GET /admin/compounding — Admin List

**Auth**: `authMiddleware` + `requirePermission('compounding.read')`

**Query Params**: `status?`, `patientId?`, `form?`, `dateFrom?`, `dateTo?`, `page?`, `limit?`, `sort?`

**Response 200**: Paginated list including `patientName`.

---

## GET /admin/compounding/:id — Admin Detail

**Auth**: `authMiddleware` + `requirePermission('compounding.read')`

**Response 200**: Full detail including `internalNotes`, `patientName`, `patientEmail`.

---

## PATCH /admin/compounding/:id/status — Change Status (Admin)

**Auth**: `authMiddleware` + `requirePermission('compounding.manage')`

**Request Body**:
```json
{
  "newStatus": "quoted",
  "quotedPrice": 45.00,
  "quotedTurnaroundDays": 5,
  "internalNotes": "Used standard base formula #3",
  "note": "Quote sent to patient"
}
```

| Field | Type | Required When |
|-------|------|---------------|
| `newStatus` | string | always |
| `quotedPrice` | number | when `newStatus = "quoted"` |
| `quotedTurnaroundDays` | integer | when `newStatus = "quoted"` |
| `internalNotes` | string | never required |
| `note` | string | never required |

**Response 200**: `{ "data": { "success": true } }`

**Errors**: `404 COMPOUNDING_REQUEST_NOT_FOUND`, `422 HEALTHCARE_INVALID_STATUS_TRANSITION`, `422 VALIDATION_ERROR` (quotedPrice/quotedTurnaroundDays required when newStatus = quoted)

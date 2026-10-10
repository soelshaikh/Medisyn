# API Contract: Minor Ailments

Base path: `/api/v1`  
All requests require `X-Facility-ID: <facilityId>` header.

---

## GET /minor-ailments/catalog — List Active Ailments (Public)

**Auth**: None required (public — patients need to know what's available)

**Response 200**:
```json
{
  "data": [
    { "id": "uuid", "name": "Allergic Rhinitis", "description": "Seasonal or year-round nasal symptoms...", "displayOrder": 0 },
    { "id": "uuid", "name": "Conjunctivitis", "description": "Pink eye symptoms...", "displayOrder": 1 }
  ]
}
```

Only `is_active = true` ailments are returned. No pagination (small list, ≤50 items expected).

---

## POST /minor-ailments/assessments — Submit Assessment (Patient)

**Auth**: `authMiddleware` (patient)

**Request Body**:
```json
{
  "ailmentId": "uuid",
  "symptoms": "Runny nose, sneezing, itchy eyes for the past week",
  "duration": "1 week",
  "currentMedications": "Vitamin D 1000IU daily",
  "healthHistory": "No known drug allergies, no chronic conditions"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `ailmentId` | uuid | yes | must be active ailment in facility catalog |
| `symptoms` | string | yes | min 10 chars |
| `duration` | string | yes | min 1, max 200 chars |
| `currentMedications` | string | no | |
| `healthHistory` | string | no | |

**Response 201**: Created assessment (patient view — no `internalNotes`).

**Errors**: `422 AILMENT_NOT_FOUND`, `422 AILMENT_INACTIVE`

---

## GET /minor-ailments/assessments — List Patient's Own Assessments

**Auth**: `authMiddleware`

**Query Params**: `status?`, `page?`, `limit?`

**Response 200**: Paginated list of patient's own assessments.

---

## GET /minor-ailments/assessments/:id — Patient Assessment Detail

**Auth**: `authMiddleware` — 404 if not owned

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "ailmentId": "uuid",
    "ailmentName": "Allergic Rhinitis",
    "symptoms": "Runny nose, sneezing, itchy eyes for the past week",
    "duration": "1 week",
    "currentMedications": "Vitamin D 1000IU daily",
    "healthHistory": "No known drug allergies",
    "treatmentNote": "Recommended Reactine 10mg OTC once daily for 2 weeks",
    "status": "treated",
    "statusHistory": [ ... ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Note: `internalNotes` NEVER in patient response. `treatmentNote` IS visible (patient-facing clinical outcome).

---

## GET /admin/minor-ailments/catalog — Admin Catalog List (All Ailments)

**Auth**: `authMiddleware` + `requirePermission('minor-ailments.manage')`

Returns all ailments including inactive ones.

---

## POST /admin/minor-ailments/catalog — Create Ailment

**Auth**: `authMiddleware` + `requirePermission('minor-ailments.manage')`

**Request Body**:
```json
{
  "name": "Eczema (Atopic Dermatitis)",
  "description": "Chronic skin condition...",
  "displayOrder": 19
}
```

**Response 201**: Created ailment.

**Errors**: `409 AILMENT_NAME_EXISTS`

---

## PATCH /admin/minor-ailments/catalog/:id — Update Ailment

**Auth**: `authMiddleware` + `requirePermission('minor-ailments.manage')`

**Request Body**: Any subset of `name`, `description`, `isActive`, `displayOrder`.

**Response 200**: Updated ailment.

---

## GET /admin/minor-ailments/assessments — Admin List

**Auth**: `authMiddleware` + `requirePermission('minor-ailments.read')`

**Query Params**: `status?`, `ailmentId?`, `patientId?`, `dateFrom?`, `dateTo?`, `page?`, `limit?`

**Response 200**: Paginated list including `patientName` and `ailmentName`.

---

## GET /admin/minor-ailments/assessments/:id — Admin Detail

**Auth**: `authMiddleware` + `requirePermission('minor-ailments.read')`

**Response 200**: Full detail including `internalNotes`, `patientName`, `patientEmail`.

---

## PATCH /admin/minor-ailments/assessments/:id/status — Change Status (Admin)

**Auth**: `authMiddleware` + `requirePermission('minor-ailments.manage')`

**Request Body**:
```json
{
  "newStatus": "treated",
  "treatmentNote": "Recommended Reactine 10mg OTC once daily for 2 weeks. Follow up if no improvement.",
  "internalNotes": "Reviewed for drug interactions — none found",
  "note": "Treated via OTC recommendation"
}
```

| Field | Required When |
|-------|---------------|
| `newStatus` | always |
| `treatmentNote` | when `newStatus = "treated"` |
| `internalNotes` | never required |
| `note` | never required |

**Response 200**: `{ "data": { "success": true } }`

**Errors**: `404 AILMENT_NOT_FOUND` (assessment), `422 HEALTHCARE_INVALID_STATUS_TRANSITION`

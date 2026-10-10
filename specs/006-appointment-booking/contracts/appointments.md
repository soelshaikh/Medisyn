# API Contract: Appointments

**Base path**: `/api/v1`

---

## GET /appointments/availability

Query available slots for a service on a date. Returns only active, future, non-full slots. No auth required (uses resolveFacility).

**Middleware**: `resolveFacility`

**Query params**:
| Param | Type | Required | Description |
|---|---|---|---|
| serviceId | UUID | yes | Filter by service |
| date | YYYY-MM-DD | yes | Target date |

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "serviceId": "uuid",
      "serviceName": "Flu Vaccine",
      "slotDate": "2026-10-15",
      "startTime": "10:00",
      "endTime": "10:15",
      "remaining": 3
    }
  ]
}
```

**Notes**:
- `remaining` = `MAX(0, capacity - bookedCount)` — OPEN overbooking buffer is never exposed
- Slots where `remaining = 0` are excluded
- Past dates return empty array

---

## POST /appointments

Patient books an appointment. Concurrency-safe (SELECT FOR UPDATE on slot).

**Middleware**: `authMiddleware`

**Request body**:
```json
{
  "slotId": "uuid",
  "reason": "Annual flu shot"
}
```

**Validation**:
- `slotId`: UUID, required
- `reason`: string, max 500, optional

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "slotId": "uuid",
    "serviceId": "uuid",
    "serviceName": "Flu Vaccine",
    "slotDate": "2026-10-15",
    "startTime": "10:00",
    "endTime": "10:15",
    "reason": "Annual flu shot",
    "status": "scheduled",
    "createdAt": "2026-10-10T10:00:00Z"
  }
}
```

**Errors**:
- `404 SLOT_NOT_FOUND`
- `422 SLOT_INACTIVE`: slot is deactivated
- `409 SLOT_FULL`: capacity reached (STRICT or OPEN limit)
- `409 APPOINTMENT_DUPLICATE_BOOKING`: patient already has active booking for this slot

---

## GET /appointments

List the authenticated patient's own appointments.

**Middleware**: `authMiddleware`

**Query params**:
| Param | Type | Description |
|---|---|---|
| status | 'scheduled'\|'completed'\|'cancelled'\|'no_show' (optional) | Filter |
| page | integer, default 1 | |
| limit | integer, default 20, max 100 | |

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "serviceName": "Flu Vaccine",
      "slotDate": "2026-10-15",
      "startTime": "10:00",
      "endTime": "10:15",
      "status": "scheduled",
      "reason": "Annual flu shot",
      "createdAt": "2026-10-10T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3 }
}
```

---

## GET /appointments/:id

Patient appointment detail. `internal_notes` is structurally absent.

**Middleware**: `authMiddleware`

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "serviceName": "Flu Vaccine",
    "durationMinutes": 15,
    "eligibilityNotes": "Ages 6 months and older",
    "slotDate": "2026-10-15",
    "startTime": "10:00",
    "endTime": "10:15",
    "reason": "Annual flu shot",
    "status": "scheduled",
    "statusHistory": [
      {
        "previousStatus": null,
        "newStatus": "scheduled",
        "note": null,
        "createdAt": "2026-10-10T10:00:00Z"
      }
    ],
    "createdAt": "2026-10-10T10:00:00Z"
  }
}
```

**Error 404 APPOINTMENT_NOT_FOUND**

---

## POST /appointments/:id/cancel

Patient cancels their own scheduled appointment.

**Middleware**: `authMiddleware`

**Request body** (optional):
```json
{ "note": "Change of plans" }
```

**Response 200**: `{ "data": { "success": true } }`

**Errors**:
- `404 APPOINTMENT_NOT_FOUND`
- `422 APPOINTMENT_INVALID_STATUS_TRANSITION`: appointment is not in `scheduled` status

---

## GET /admin/appointments

Admin list with filters.

**Middleware**: `authMiddleware`, `requirePermission('appointments.read')`

**Query params**:
| Param | Type | Description |
|---|---|---|
| serviceId | UUID (optional) | Filter by service |
| slotId | UUID (optional) | Filter by specific slot |
| patientId | UUID (optional) | Filter by patient |
| status | enum (optional) | Filter by status |
| dateFrom | YYYY-MM-DD (optional) | Slot date range start |
| dateTo | YYYY-MM-DD (optional) | Slot date range end |
| page | integer, default 1 | |
| limit | integer, default 20, max 100 | |
| sort | 'slotDate:asc'\|'slotDate:desc'\|'createdAt:desc', default 'slotDate:asc' | |

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "patientName": "Jane Doe",
      "patientEmail": "jane@example.com",
      "serviceName": "Flu Vaccine",
      "slotDate": "2026-10-15",
      "startTime": "10:00",
      "status": "scheduled",
      "createdAt": "2026-10-10T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12 }
}
```

---

## GET /admin/appointments/:id

Admin appointment detail. Includes `internal_notes`, patient info.

**Middleware**: `authMiddleware`, `requirePermission('appointments.read')`

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "patientId": "uuid",
    "patientName": "Jane Doe",
    "patientEmail": "jane@example.com",
    "serviceName": "Flu Vaccine",
    "durationMinutes": 15,
    "slotDate": "2026-10-15",
    "startTime": "10:00",
    "endTime": "10:15",
    "reason": "Annual flu shot",
    "internalNotes": "Patient has egg allergy — confirmed safe for this vaccine",
    "status": "scheduled",
    "statusHistory": [
      {
        "previousStatus": null,
        "newStatus": "scheduled",
        "changedByName": null,
        "note": null,
        "createdAt": "2026-10-10T10:00:00Z"
      }
    ],
    "createdAt": "2026-10-10T10:00:00Z"
  }
}
```

---

## PATCH /admin/appointments/:id/status

Admin changes appointment status (complete, no-show, cancel).

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Request body**:
```json
{
  "newStatus": "completed",
  "note": "Vaccine administered successfully"
}
```

**Validation**:
- `newStatus`: `'completed'` | `'cancelled'` | `'no_show'`, required
- `note`: string, max 500, optional

**Valid transitions**: `scheduled` → `completed` | `cancelled` | `no_show`

**Response 200**: `{ "data": { "success": true } }`

**Errors**:
- `404 APPOINTMENT_NOT_FOUND`
- `422 APPOINTMENT_INVALID_STATUS_TRANSITION`

---

## PATCH /admin/appointments/:id/notes

Admin updates internal notes (never exposed to patient).

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Request body**:
```json
{ "notes": "Patient has egg allergy — confirmed safe for this vaccine" }
```

**Validation**: `notes`: string, max 2000, required

**Response 200**: `{ "data": { "success": true } }`

**Error 404 APPOINTMENT_NOT_FOUND**

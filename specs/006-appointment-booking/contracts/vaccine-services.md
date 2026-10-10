# API Contract: Vaccine Services

**Base path**: `/api/v1`

---

## GET /vaccine-services/catalog

Public endpoint (no auth). Returns all active services for the facility.

**Middleware**: `resolveFacility` (reads `X-Facility-ID` header → `res.locals.facilityId`)

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Flu Vaccine",
      "description": "Annual influenza vaccine",
      "durationMinutes": 15,
      "eligibilityNotes": "Ages 6 months and older",
      "doseNumber": "Dose 1"
    }
  ]
}
```

---

## GET /admin/vaccine-services

Auth required. Returns all services (active + inactive).

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Flu Vaccine",
      "description": "Annual influenza vaccine",
      "durationMinutes": 15,
      "eligibilityNotes": "Ages 6 months and older",
      "doseNumber": "Dose 1",
      "isActive": true,
      "createdAt": "2026-10-10T10:00:00Z",
      "updatedAt": "2026-10-10T10:00:00Z"
    }
  ]
}
```

---

## POST /admin/vaccine-services

Create a new vaccine service.

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Request body**:
```json
{
  "name": "Flu Vaccine",
  "description": "Annual influenza vaccine",
  "durationMinutes": 15,
  "eligibilityNotes": "Ages 6 months and older",
  "doseNumber": "Dose 1"
}
```

**Validation**:
- `name`: string, min 1, max 200, required
- `description`: string, optional
- `durationMinutes`: integer, min 1, required
- `eligibilityNotes`: string, optional
- `doseNumber`: string, max 50, optional

**Response 201**: `{ "data": { ...service } }`

**Error 422 VACCINE_SERVICE_NAME_EXISTS**: Duplicate name at this facility.

---

## PATCH /admin/vaccine-services/:id

Update an existing service (including activate/deactivate).

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Request body** (all fields optional):
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "durationMinutes": 20,
  "eligibilityNotes": "Ages 12 and older",
  "doseNumber": "Booster",
  "isActive": false
}
```

**Validation**: Same as POST but all fields optional.

**Response 200**: `{ "data": { ...updatedService } }`

**Error 404 VACCINE_SERVICE_NOT_FOUND**
**Error 422 VACCINE_SERVICE_NAME_EXISTS**: Duplicate name (different service, same facility).

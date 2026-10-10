# API Contract: Availability Slots

**Base path**: `/api/v1`

---

## GET /admin/availability-slots

List all slots for a facility. Supports filtering by service and date.

**Middleware**: `authMiddleware`, `requirePermission('appointments.read')`

**Query params**:
| Param | Type | Description |
|---|---|---|
| serviceId | UUID (optional) | Filter by service |
| date | YYYY-MM-DD (optional) | Filter by specific date |
| dateFrom | YYYY-MM-DD (optional) | Range start |
| dateTo | YYYY-MM-DD (optional) | Range end |
| isActive | boolean (optional) | Filter by active status |
| page | integer, default 1 | |
| limit | integer, default 20, max 100 | |

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
      "capacity": 5,
      "bookingType": "STRICT",
      "openCapacity": null,
      "bookedCount": 2,
      "remaining": 3,
      "isActive": true,
      "createdAt": "2026-10-10T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

---

## POST /admin/availability-slots

Create a new availability slot.

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Request body**:
```json
{
  "serviceId": "uuid",
  "slotDate": "2026-10-15",
  "startTime": "10:00",
  "endTime": "10:15",
  "capacity": 5,
  "bookingType": "STRICT"
}
```

For OPEN slots:
```json
{
  "serviceId": "uuid",
  "slotDate": "2026-10-15",
  "startTime": "14:00",
  "endTime": "14:30",
  "capacity": 10,
  "bookingType": "OPEN",
  "openCapacity": 15
}
```

**Validation**:
- `serviceId`: UUID, required — service must exist and be active
- `slotDate`: YYYY-MM-DD, required — must be today or future
- `startTime`: HH:MM (24h), required
- `endTime`: HH:MM (24h), required — must be after startTime
- `capacity`: integer >= 1, required
- `bookingType`: `'STRICT'` | `'OPEN'`, required
- `openCapacity`: integer, required when bookingType=`'OPEN'`, must be >= capacity

**Response 201**: `{ "data": { ...slot } }`

**Errors**:
- `422 VALIDATION_ERROR`: end_time <= start_time, openCapacity < capacity
- `404 VACCINE_SERVICE_NOT_FOUND`
- `422 VACCINE_SERVICE_INACTIVE`

---

## PATCH /admin/availability-slots/:id

Update a slot (deactivate, adjust capacity).

**Middleware**: `authMiddleware`, `requirePermission('appointments.manage')`

**Request body** (all fields optional):
```json
{
  "capacity": 8,
  "openCapacity": 12,
  "isActive": false
}
```

**Validation**:
- `capacity`: integer >= 1, optional — must be >= current bookedCount
- `openCapacity`: integer, optional — must be >= new/existing capacity
- `isActive`: boolean, optional

**Response 200**: `{ "data": { ...updatedSlot } }`

**Errors**:
- `404 SLOT_NOT_FOUND`
- `422 SLOT_CAPACITY_BELOW_BOOKED`: capacity set below current booked_count

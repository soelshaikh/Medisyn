# Data Model: Appointment Booking

**Feature**: 006-appointment-booking
**Date**: 2026-10-10

---

## Entities

### 1. vaccine_services

Represents a bookable pharmacy service offered at a facility.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| facility_id | UUID | FK → facilities RESTRICT, NOT NULL | RLS scope |
| name | TEXT | NOT NULL | Max 200 chars |
| description | TEXT | nullable | |
| duration_minutes | INTEGER | NOT NULL, CHECK > 0 | Appointment length |
| eligibility_notes | TEXT | nullable | e.g. "Ages 6 months and older" |
| dose_number | TEXT | nullable | e.g. "Dose 1", "Dose 2", "Booster" |
| is_active | BOOLEAN | NOT NULL DEFAULT true | Controls patient visibility |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Unique Constraint**: `UNIQUE INDEX vaccine_services_facility_name_unique ON vaccine_services (facility_id, LOWER(name))` — enforced in migration SQL (case-insensitive name deduplication per facility).

**RLS**: `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY facility_isolation USING (facility_id = current_facility_id())`

---

### 2. availability_slots

A specific bookable time window for a vaccine service.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| facility_id | UUID | FK → facilities RESTRICT, NOT NULL | RLS scope |
| service_id | UUID | FK → vaccine_services RESTRICT, NOT NULL | |
| slot_date | DATE | NOT NULL | Calendar date of the slot |
| start_time | TIME | NOT NULL | Time of day (no timezone) |
| end_time | TIME | NOT NULL | Must be > start_time |
| capacity | INTEGER | NOT NULL, CHECK > 0 | Max bookings (hard cap for STRICT) |
| booking_type | TEXT | NOT NULL, CHECK IN ('STRICT','OPEN') | |
| open_capacity | INTEGER | nullable | Required + >= capacity when type=OPEN |
| booked_count | INTEGER | NOT NULL DEFAULT 0, CHECK >= 0 | Maintained by application |
| is_active | BOOLEAN | NOT NULL DEFAULT true | When false: no new bookings |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Check Constraints**:
- `CHECK (end_time > start_time)`
- `CHECK (booking_type = 'STRICT' OR (open_capacity IS NOT NULL AND open_capacity >= capacity))`
- `CHECK (booked_count >= 0)`
- `CHECK (booked_count <= CASE WHEN booking_type = 'STRICT' THEN capacity ELSE open_capacity END)` — belt-and-suspenders DB guard

**Indexes**:
- `(facility_id, service_id, slot_date)` — availability queries
- `(facility_id, is_active)` — admin slot listing
- `(facility_id, slot_date)` — date-range queries

**RLS**: Same facility isolation policy.

---

### 3. appointments

A patient's confirmed booking of an availability slot.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| facility_id | UUID | FK → facilities RESTRICT, NOT NULL | RLS scope |
| patient_id | UUID | FK → users RESTRICT, NOT NULL | |
| slot_id | UUID | FK → availability_slots RESTRICT, NOT NULL | |
| service_id | UUID | FK → vaccine_services RESTRICT, NOT NULL | Denormalized for display |
| reason | TEXT | nullable | Patient-provided booking reason |
| internal_notes | TEXT | nullable | Staff-only; structurally absent from patient types |
| status | TEXT | NOT NULL DEFAULT 'scheduled', CHECK IN ('scheduled','completed','cancelled','no_show') | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Unique Constraint** (partial): `CREATE UNIQUE INDEX appointments_slot_patient_active_unique ON appointments (slot_id, patient_id) WHERE status != 'cancelled'` — prevents duplicate active bookings; allows re-booking after cancellation.

**Indexes**:
- `(facility_id, patient_id)` — patient list
- `(facility_id, slot_id)` — slot-level admin queries
- `(facility_id, status)` — admin filtered lists

**RLS**: Same facility isolation policy. REVOKE DELETE from app_user (soft-delete via status only).

---

### 4. appointment_status_history

Append-only record of every status transition for an appointment.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| appointment_id | UUID | FK → appointments RESTRICT, NOT NULL | |
| facility_id | UUID | FK → facilities RESTRICT, NOT NULL | RLS scope |
| previous_status | TEXT | nullable | null on initial 'scheduled' entry |
| new_status | TEXT | NOT NULL | |
| changed_by_id | UUID | FK → users SET NULL, nullable | null for patient-initiated actions if no auth (unlikely — will always have auth) |
| note | TEXT | nullable | Optional cancellation reason or admin note |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

**Append-only enforcement**: `REVOKE UPDATE, DELETE ON appointment_status_history FROM app_user, app_super_admin`

**Index**: `(appointment_id, created_at ASC)` — history thread retrieval

**RLS**: Same facility isolation policy.

---

## State Machine: Appointment Status

```
              ┌─────────────┐
              │  scheduled  │◄── initial state on booking
              └──────┬──────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
     ┌─────────┐ ┌───────────┐ ┌──────────┐
     │completed│ │ cancelled │ │ no_show  │
     └─────────┘ └───────────┘ └──────────┘
   (terminal)   (terminal)    (terminal)
```

**Valid transitions**:
- `scheduled` → `completed` (admin only)
- `scheduled` → `cancelled` (patient or admin)
- `scheduled` → `no_show` (admin only)
- All terminal states → rejected (APPOINTMENT_INVALID_STATUS_TRANSITION)

**On cancellation**: `booked_count` on the parent slot is decremented (within same transaction, SELECT FOR UPDATE on slot).

---

## Concurrency Flow: Booking

```
Patient Request
      │
      ▼
withTenantContext(facilityId, async (tx) => {
  1. SELECT * FROM availability_slots WHERE id=$slotId FOR UPDATE
     ← Row lock acquired
  2. Validate: is_active, slot_date >= today, not expired
  3. Check capacity:
     - STRICT: reject if booked_count >= capacity → SLOT_FULL
     - OPEN:   reject if booked_count >= open_capacity → SLOT_FULL
  4. Check duplicate: SELECT from appointments WHERE slot_id=$slotId
                      AND patient_id=$patientId AND status!='cancelled'
     → APPOINTMENT_DUPLICATE_BOOKING
  5. INSERT INTO appointments (status='scheduled')
  6. UPDATE availability_slots SET booked_count=booked_count+1
  7. INSERT INTO appointment_status_history (null→'scheduled')
  8. createAuditEntry({action:'appointment.booked'})
})
← Lock released on commit
```

---

## Relationships

```
facilities
  └── vaccine_services (1:N, facility_id)
  └── availability_slots (1:N, facility_id + service_id → vaccine_services)
  └── appointments (1:N, facility_id + slot_id → availability_slots
                          + service_id → vaccine_services)
  └── appointment_status_history (1:N, facility_id + appointment_id → appointments)
```

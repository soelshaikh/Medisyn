# Research: Appointment Booking

**Feature**: 006-appointment-booking
**Date**: 2026-10-10
**Status**: Complete — all decisions resolved

---

## Decision 1: Concurrency-Safe Booking Strategy

**Decision**: Use `SELECT ... FOR UPDATE` on the `availability_slots` row inside a `withTenantContext` transaction to serialize concurrent booking requests.

**Rationale**:
PostgreSQL's `SELECT FOR UPDATE` acquires a row-level exclusive lock on the slot row for the duration of the transaction. Because the platform already wraps all DB operations in `withTenantContext()` (which opens a Drizzle transaction), the lock is automatically held from the `SELECT FOR UPDATE` through the `INSERT` into `appointments` and the `UPDATE` of `booked_count`, then released on commit/rollback. This prevents two simultaneous requests from both reading `booked_count = N-1` before either increments it.

Drizzle ORM exposes `.for('update')` on select queries. The full booking sequence is:
1. `SELECT ... FROM availability_slots WHERE id = $slotId FOR UPDATE` — acquires lock
2. Read `booked_count`, `capacity`, `open_capacity`, `booking_type`, `is_active`
3. If STRICT: reject if `booked_count >= capacity` (SLOT_FULL)
4. If OPEN: reject if `booked_count >= open_capacity` (SLOT_FULL)
5. `INSERT INTO appointments (...)`
6. `UPDATE availability_slots SET booked_count = booked_count + 1 WHERE id = $slotId`
7. Commit

Cancellation uses the same lock pattern to safely decrement `booked_count`.

**Alternatives considered**:
- **Optimistic locking (version/etag)**: Would require retry logic in the service layer and more complex error handling. Adds complexity without benefit given the low concurrency expected for individual slots.
- **Advisory locks**: More complex setup, harder to reason about, no benefit over row-level locks for this use case.
- **Application-level mutex (Redis)**: Introduces a distributed coordination dependency and a fallback-to-DB design that adds latency. PostgreSQL row locking is simpler, more reliable, and already inside the transaction boundary.

**PgBouncer compatibility**: The platform uses PgBouncer in transaction mode. `SELECT FOR UPDATE` is safe in transaction mode because the lock is acquired and released within a single transaction (not a session). ✓

---

## Decision 2: STRICT vs OPEN Capacity Enforcement

**Decision**: Enforce at the service layer using `booked_count` column on `availability_slots`, locked via SELECT FOR UPDATE.

**Rationale**:
- STRICT slots: hard cap at `capacity`. Booking rejected when `booked_count >= capacity`.
- OPEN slots: soft overbooking allowed up to `open_capacity`. Booking rejected when `booked_count >= open_capacity`. The patient-facing availability query uses `capacity` as the display threshold — slots appear as "full" to patients when `booked_count >= capacity`, even if the admin has configured open_capacity higher. This hides the overbooking buffer from patients while allowing pharmacy staff to manage walk-ins.
- `booked_count` is maintained by the application layer (incremented on booking, decremented on cancellation) within the locked transaction. A DB-level check constraint enforces `booked_count >= 0`.

**Alternatives considered**:
- Counting rows in `appointments` table on every booking request: Slower, race-prone without locking, requires a join. The denormalized `booked_count` column is the better choice given the SELECT FOR UPDATE pattern.

---

## Decision 3: Availability Query — Patient-Visible Capacity

**Decision**: The patient availability endpoint (`GET /appointments/availability`) shows `remaining` as `MAX(0, capacity - booked_count)`. Slots where `remaining = 0` are excluded from results entirely. `open_capacity` is never exposed to patients.

**Rationale**: Patients should see clean "spots available" information. The admin's OPEN overbooking buffer is an operational tool, not patient-facing data. Hiding it avoids confusing UX (e.g. a slot showing "0 spots" that still accepts bookings).

---

## Decision 4: Slot Date/Time Storage

**Decision**: `slot_date` stored as PostgreSQL `DATE`, `start_time` and `end_time` stored as PostgreSQL `TIME WITHOUT TIME ZONE`. Drizzle `date()` and `time()` column types.

**Rationale**: Consistent with the spec assumption that timezone handling is deferred. Facility timezone awareness is a Phase 11+ concern. `DATE + TIME` is simpler to query, filter, and display than full TIMESTAMPTZ for this use case.

---

## Decision 5: Duplicate Booking Prevention

**Decision**: `UNIQUE(slot_id, patient_id)` constraint on `appointments` table (excluding cancelled rows via a partial unique index: `WHERE status != 'cancelled'`).

**Rationale**: A patient who cancelled their appointment and re-books the same slot should be allowed. The partial unique index `WHERE status != 'cancelled'` handles this correctly. Active bookings (scheduled/completed/no_show) are deduplicated per patient per slot.

**Implementation note**: Drizzle does not natively support partial unique indexes in the schema DSL — this must be created in the migration SQL with `CREATE UNIQUE INDEX ... WHERE status != 'cancelled'`.

---

## Decision 6: Error Codes

New error codes to add to `backend/src/lib/errors.ts`:
- `VACCINE_SERVICE_NOT_FOUND`
- `VACCINE_SERVICE_INACTIVE`
- `VACCINE_SERVICE_NAME_EXISTS`
- `SLOT_NOT_FOUND`
- `SLOT_FULL`
- `SLOT_INACTIVE`
- `SLOT_CAPACITY_BELOW_BOOKED`
- `APPOINTMENT_NOT_FOUND`
- `APPOINTMENT_INVALID_STATUS_TRANSITION`
- `APPOINTMENT_DUPLICATE_BOOKING`

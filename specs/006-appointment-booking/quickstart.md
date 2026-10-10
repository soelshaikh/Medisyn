# Quickstart: Appointment Booking

Validate all four modules end-to-end against a running backend.

---

## Prerequisites

1. Backend running: `npm run dev` in `backend/` (port 3001)
2. Migration applied: `npm run db:migrate` in `backend/`
3. Permissions seeded: `npx tsx src/db/seeds/appointments-permissions.ts`
4. Test facility exists with:
   - A patient user (JWT token available)
   - An admin user with `appointments.manage` and `appointments.read` permissions
5. All requests include `X-Facility-ID: <test-facility-id>` header

---

## Scenario 1: Vaccine Service Catalog Lifecycle

1. **Admin creates service** `POST /api/v1/admin/vaccine-services`
   - Body: `{ "name": "Flu Vaccine", "durationMinutes": 15, "eligibilityNotes": "Ages 6 months and older", "doseNumber": "Dose 1" }`
   - **Expected**: 201, `isActive = true`, service ID returned

2. **Public catalog** `GET /api/v1/vaccine-services/catalog`
   - **Expected**: 200, Flu Vaccine appears in list with `durationMinutes`, `doseNumber` — no `isActive` field

3. **Admin deactivates** `PATCH /api/v1/admin/vaccine-services/:id`
   - Body: `{ "isActive": false }`
   - **Expected**: 200 success

4. **Public catalog after deactivation** `GET /api/v1/vaccine-services/catalog`
   - **Expected**: Flu Vaccine no longer in list

5. **Admin catalog still shows it** `GET /api/v1/admin/vaccine-services`
   - **Expected**: Flu Vaccine present with `isActive = false`

6. **Duplicate name blocked** `POST /api/v1/admin/vaccine-services`
   - Body: `{ "name": "flu vaccine", "durationMinutes": 10 }` (lowercase)
   - **Expected**: 422, `error.code = "VACCINE_SERVICE_NAME_EXISTS"`

---

## Scenario 2: Availability Slot Management

*Re-activate the Flu Vaccine service from Scenario 1 first.*

1. **Admin creates STRICT slot** `POST /api/v1/admin/availability-slots`
   - Body: `{ "serviceId": "<flu-vaccine-id>", "slotDate": "<tomorrow>", "startTime": "10:00", "endTime": "10:15", "capacity": 3, "bookingType": "STRICT" }`
   - **Expected**: 201, `bookedCount = 0`, `remaining = 3`

2. **Admin creates OPEN slot** `POST /api/v1/admin/availability-slots`
   - Body: `{ "serviceId": "<flu-vaccine-id>", "slotDate": "<tomorrow>", "startTime": "14:00", "endTime": "14:30", "capacity": 5, "bookingType": "OPEN", "openCapacity": 8 }`
   - **Expected**: 201, `openCapacity = 8`

3. **Invalid slot rejected** `POST /api/v1/admin/availability-slots`
   - Body: `{ ..., "startTime": "14:00", "endTime": "13:00" }` (end before start)
   - **Expected**: 422, `error.code = "VALIDATION_ERROR"`

4. **Admin lists slots** `GET /api/v1/admin/availability-slots?serviceId=<flu-vaccine-id>&date=<tomorrow>`
   - **Expected**: both slots returned with `serviceName = "Flu Vaccine"`

---

## Scenario 3: Patient Availability Browse + Concurrency-Safe Booking

1. **Patient queries availability** `GET /api/v1/appointments/availability?serviceId=<flu-vaccine-id>&date=<tomorrow>`
   - **Expected**: both slots returned (STRICT with remaining=3, OPEN with remaining=5); `openCapacity` absent from response

2. **Patient books STRICT slot** `POST /api/v1/appointments`
   - Body: `{ "slotId": "<strict-slot-id>", "reason": "Annual flu shot" }`
   - **Expected**: 201, `status = "scheduled"`, slot `bookedCount` now 1

3. **Duplicate booking blocked** `POST /api/v1/appointments` (same patient, same slot)
   - **Expected**: 409, `error.code = "APPOINTMENT_DUPLICATE_BOOKING"`

4. **Patient views their appointment** `GET /api/v1/appointments/:id`
   - **Expected**: `serviceName`, `slotDate`, `startTime`, `reason` present; `internal_notes` absent; `statusHistory` has 1 entry (null → scheduled)

5. **Fill STRICT slot to capacity** — book 2 more times with different patient accounts, bringing `bookedCount = 3`

6. **Slot full** `GET /api/v1/appointments/availability?serviceId=<flu-vaccine-id>&date=<tomorrow>`
   - **Expected**: STRICT slot no longer appears; OPEN slot still appears

7. **SLOT_FULL error** `POST /api/v1/appointments`
   - Body: `{ "slotId": "<strict-slot-id>" }` (new patient, slot at capacity)
   - **Expected**: 409, `error.code = "SLOT_FULL"`

---

## Scenario 4: Appointment Lifecycle — Complete, No-Show, Cancel

1. **Admin marks completed** `PATCH /api/v1/admin/appointments/:id/status`
   - Body: `{ "newStatus": "completed", "note": "Vaccine administered" }`
   - **Expected**: 200 success; status history now has 2 entries

2. **Invalid transition blocked** `PATCH /api/v1/admin/appointments/:id/status`
   - Body: `{ "newStatus": "scheduled" }` (completed → scheduled invalid)
   - **Expected**: 422, `error.code = "APPOINTMENT_INVALID_STATUS_TRANSITION"`

3. **Book a second appointment** (fresh patient + slot), then:
   - `PATCH /api/v1/admin/appointments/:id/status` with `{ "newStatus": "no_show" }`
   - **Expected**: 200 success; bookedCount unchanged (no decrement for no_show)

4. **Patient cancels** `POST /api/v1/appointments/:id/cancel` on a `scheduled` appointment
   - **Expected**: 200 success; slot `bookedCount` decrements by 1

5. **Re-book after cancel** `POST /api/v1/appointments`
   - Same patient, same slot as just cancelled
   - **Expected**: 201 (partial unique index allows re-booking after cancellation)

---

## Scenario 5: Internal Notes Never Leaked

1. Admin adds internal notes `PATCH /api/v1/admin/appointments/:id/notes`
   - Body: `{ "notes": "Patient has penicillin allergy" }`
   - **Expected**: 200 success

2. Patient retrieves appointment `GET /api/v1/appointments/:id`
   - **Expected**: Response JSON does NOT contain `internalNotes` or `internal_notes`
   - Verify: `JSON.stringify(response.data).includes('internal') === false`

3. Admin retrieves appointment `GET /api/v1/admin/appointments/:id`
   - **Expected**: `internalNotes` present with the correct value

---

## Scenario 6: Patient Isolation (404, not 403)

- Patient A books an appointment. Patient B calls `GET /api/v1/appointments/<patient-A-appointment-id>`
- **Expected**: 404 (not 403 — do not reveal existence)

---

## Scenario 7: Audit Log Verification

After any booking or admin status change, verify `audit_log` directly:
- `action` matches: `appointment.booked`, `appointment.status_changed`, `appointment.cancelled`
- `resource_id` matches appointment ID
- `actor_id` matches the user who acted
- `facility_id` matches test facility

---

## Key References

- State machine: `specs/006-appointment-booking/data-model.md`
- API contracts:
  - `specs/006-appointment-booking/contracts/vaccine-services.md`
  - `specs/006-appointment-booking/contracts/availability-slots.md`
  - `specs/006-appointment-booking/contracts/appointments.md`
- Concurrency strategy: `specs/006-appointment-booking/research.md` (Decision 1)
- Permissions: `backend/src/db/seeds/appointments-permissions.ts` (to be created)

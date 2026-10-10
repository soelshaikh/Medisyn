# Feature Specification: Appointment Booking

**Feature Branch**: `006-appointment-booking`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Phase 6 Appointments — Express.js REST backend for MediSyn Canadian pharmacy platform. Build a full appointment booking system for pharmacy services..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vaccine Service Catalog Management (Priority: P1)

A pharmacy administrator manages a list of appointment-eligible services offered at the facility. Services include vaccines, consultations, and other bookable health services. Each service has a name, description, appointment duration, eligibility notes (e.g. "Ages 6 months and older"), a dose number (for multi-dose vaccines such as dose 1, dose 2, booster), and an active/inactive flag. Only active services are visible to patients. Admins can activate or deactivate services without deleting them.

**Why this priority**: The catalog is the foundational dependency for every other feature in this phase. Without at least one active service, no availability slots can be created and patients cannot book. It must be functional before anything else.

**Independent Test**: Admin creates a service (Flu Vaccine, 15 min, dose 1). Service appears in the public catalog for patients. Admin deactivates it. Service no longer appears in the patient-facing catalog. Admin view still shows all services including inactive ones.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they create a service with name, duration, and eligibility notes, **Then** the service is saved as active and returned with a generated ID.
2. **Given** an active service, **When** a patient queries the public catalog, **Then** only active services are returned (name, description, duration, eligibility notes, dose number — no internal fields).
3. **Given** an active service, **When** admin deactivates it, **Then** it no longer appears in patient catalog but remains in admin catalog.
4. **Given** an existing service name at the same facility, **When** admin attempts to create another service with the same name, **Then** the request is rejected with a duplicate name error.

---

### User Story 2 - Availability Slot Management (Priority: P2)

A pharmacy administrator creates time slots that patients can book. Each slot is linked to a service, has a date, start and end times, a capacity (maximum number of appointments), and a booking type. STRICT slots enforce hard capacity — the system must never accept a booking that would exceed the slot capacity, even under concurrent load. OPEN slots allow soft overbooking up to a separately configured open capacity limit (allowing walk-ins or flexible management). Admins can view all slots with booked counts, and can deactivate a slot to prevent new bookings without deleting existing appointments.

**Why this priority**: Slots are the direct prerequisite for patient booking. Catalog comes first, then slots, then patient booking.

**Independent Test**: Admin creates a STRICT slot (capacity 3, date tomorrow, 10:00–10:15 AM). Admin views the slot and sees booked_count = 0 and remaining = 3. Admin creates an OPEN slot (capacity 5, open_capacity 7) for the same day. Both slot types exist and are queryable.

**Acceptance Scenarios**:

1. **Given** an existing active service, **When** admin creates a slot with STRICT type, capacity 3, future date and valid times, **Then** slot is saved and returned with booked_count = 0.
2. **Given** an OPEN slot with capacity 5 and open_capacity 8, **When** admin views the slot, **Then** both capacity values are returned correctly.
3. **Given** a slot with end_time before start_time, **When** admin attempts to create it, **Then** the request is rejected with a validation error.
4. **Given** a slot with existing bookings, **When** admin deactivates the slot, **Then** existing appointments are preserved and no new bookings are accepted.

---

### User Story 3 - Patient Availability Browse and Concurrency-Safe Booking (Priority: P3)

A patient queries available appointment slots for a service on a given date. The response shows slots with remaining capacity — patients never see slots that are full. The patient selects a slot and submits a booking with an optional reason or notes. The system uses database-level locking on the slot row to prevent two simultaneous requests from both succeeding when only one spot remains (for STRICT slots). Upon successful booking the appointment status is `scheduled`. The patient receives their appointment detail including date, time, service name, and their own notes — but never internal notes set by staff.

**Why this priority**: This is the primary patient-facing value of the feature. Everything built in US1 and US2 exists to enable this journey.

**Independent Test**: Two concurrent booking requests arrive for the last remaining spot in a STRICT slot. Exactly one succeeds (201) and one fails (409 SLOT_FULL). Zero overbooking occurs. An OPEN slot at capacity still accepts bookings up to open_capacity.

**Acceptance Scenarios**:

1. **Given** an active service with two slots on a given date (one full, one with 2 spots), **When** patient queries availability, **Then** only the non-full slot appears with correct remaining capacity.
2. **Given** a STRICT slot with 1 remaining spot, **When** two requests arrive simultaneously, **Then** exactly one booking succeeds (201) and the other fails (409 SLOT_FULL).
3. **Given** a patient with an existing scheduled appointment for the same slot, **When** they attempt to book the same slot again, **Then** the request is rejected with a duplicate booking error.
4. **Given** a successfully booked appointment, **When** patient retrieves the detail, **Then** service name, date, time, their own reason/notes are present and internal_notes is absent.
5. **Given** a deactivated slot, **When** patient attempts to book it, **Then** the request is rejected with a slot unavailable error.

---

### User Story 4 - Appointment Lifecycle Management (Priority: P4)

Patients can cancel their own scheduled appointments. Admins can cancel any appointment, mark any appointment as completed, or mark it as no-show. Every status transition is recorded in an append-only status history. Admins can add or update internal notes on any appointment at any time. Internal notes are only visible in the admin detail view — they are structurally absent from the patient-facing appointment detail.

**Why this priority**: Lifecycle management (completion, no-show, cancellation) is essential for operational accuracy but can be addressed after the core booking flow is working.

**Independent Test**: Patient books an appointment. Admin marks it completed. Status history has two entries: scheduled → completed. Admin adds internal notes. Patient retrieves appointment detail — internal_notes field absent. Patient tries to cancel the already-completed appointment — rejected.

**Acceptance Scenarios**:

1. **Given** a scheduled appointment, **When** the patient cancels it, **Then** status changes to `cancelled` and the slot's booked_count decrements.
2. **Given** a scheduled appointment, **When** admin marks it no-show, **Then** status becomes `no_show` and a history entry is created.
3. **Given** a completed or cancelled appointment, **When** patient attempts to cancel it, **Then** the request is rejected with an invalid transition error.
4. **Given** any appointment, **When** admin sets internal notes, **Then** patient-facing detail endpoint does not expose the internal_notes field.
5. **Given** a cancelled appointment, **When** patient views their appointment list, **Then** the cancelled appointment appears with `cancelled` status and the cancellation is reflected in slot available capacity.

---

### Edge Cases

- What happens when a STRICT slot's capacity is reduced below the current booked_count? Slot update must prevent capacity being set below current booked_count.
- How does the availability query handle slots where the date has already passed? Past slots are excluded from availability results.
- What if a patient books and then the slot is deactivated? Existing appointments are honoured; no new bookings are accepted.
- What if two admins concurrently update the same appointment status? Last-write wins on updates; status history is append-only regardless.
- What if open_capacity is less than capacity for an OPEN slot? Validation must reject: open_capacity must be ≥ capacity.

---

## Requirements *(mandatory)*

### Functional Requirements

**Vaccine Service Catalog**

- **FR-001**: System MUST allow admins to create, update, and deactivate vaccine/appointment services scoped to their facility.
- **FR-002**: System MUST enforce unique service names per facility (case-insensitive).
- **FR-003**: System MUST expose a public (unauthenticated) catalog of active services per facility.
- **FR-004**: Admin catalog view MUST include both active and inactive services.
- **FR-005**: Service fields MUST include: name, description (optional), duration in minutes, eligibility notes (optional), dose number (optional, e.g. "Dose 1", "Booster"), and active status.

**Availability Slots**

- **FR-006**: System MUST allow admins to create availability slots linked to a service, with a date, start_time, end_time, capacity, and booking_type (STRICT or OPEN).
- **FR-007**: OPEN slots MUST require an open_capacity value that is greater than or equal to capacity.
- **FR-008**: System MUST reject slots where end_time is not after start_time.
- **FR-009**: Admin MUST be able to deactivate a slot to stop new bookings without affecting existing appointments.
- **FR-010**: Admin MUST be able to view all slots for a service with real-time booked_count.
- **FR-011**: System MUST reject any attempt to reduce a slot's capacity below its current booked_count.

**Patient Booking**

- **FR-012**: System MUST provide an availability query endpoint returning non-full, active, future slots for a given service and date.
- **FR-013**: Availability results MUST show remaining capacity (capacity minus booked_count) for each slot.
- **FR-014**: System MUST use row-level locking when processing booking requests to prevent overbooking on STRICT slots under concurrent load.
- **FR-015**: STRICT slots MUST reject bookings when booked_count equals capacity, returning a SLOT_FULL error.
- **FR-016**: OPEN slots MUST reject bookings when booked_count equals open_capacity.
- **FR-017**: System MUST reject a patient booking the same slot twice (duplicate booking check).
- **FR-018**: Patient MUST be able to provide an optional reason and notes when booking.

**Appointment Management**

- **FR-019**: Patients MUST be able to cancel their own appointments that are in `scheduled` status.
- **FR-020**: Admin MUST be able to cancel any appointment, mark it `completed`, or mark it `no_show`.
- **FR-021**: All status transitions MUST be recorded in an append-only appointment status history.
- **FR-022**: Admin MUST be able to add or update internal notes on any appointment at any time.
- **FR-023**: Internal notes MUST be structurally absent from all patient-facing appointment responses.
- **FR-024**: Cancellation of an appointment MUST decrement the slot's booked_count.
- **FR-025**: System MUST reject status transitions that are not valid (e.g. completed → scheduled).

### Key Entities

- **VaccineService**: Represents a bookable service at a facility. Has name, description, duration_minutes, eligibility_notes, dose_number, is_active, facility scope.
- **AvailabilitySlot**: A specific time window for a service. Has service reference, date, start_time, end_time, capacity, booking_type (STRICT/OPEN), open_capacity (OPEN only), booked_count, is_active.
- **Appointment**: A patient's booking of a slot. Has patient reference, slot reference, service reference (denormalized for display), reason, status (scheduled/completed/cancelled/no_show), internal_notes, facility scope.
- **AppointmentStatusHistory**: Append-only record of every status transition for an appointment. Has appointment reference, previous_status, new_status, changed_by, note, timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero overbooking incidents on STRICT slots under any concurrent load — verified by concurrent booking tests.
- **SC-002**: Patients can browse available slots and complete a booking in under 30 seconds end-to-end.
- **SC-003**: Availability query returns correct remaining capacity for all slot types (STRICT and OPEN) reflecting real-time booked counts.
- **SC-004**: Internal notes are verified absent from 100% of patient-facing responses across all appointment endpoints.
- **SC-005**: All appointment status transitions are recorded — status history completeness is 100% (no transitions without a history entry).
- **SC-006**: Admin catalog and slot management covers the full CRUD lifecycle (create, read, update/deactivate) without data loss.

---

## Assumptions

- Patient cancellation has no minimum lead-time requirement — patients may cancel up to the start of the appointment. If a lead-time window is required in future it will be added as a separate rule.
- Rescheduling is out of scope — patients cancel an existing appointment and create a new booking. No "reschedule" action exists in this phase.
- Email/SMS reminders for upcoming appointments are out of scope for this phase (deferred to Phase 7 async infrastructure).
- A patient may have multiple appointments at the same facility for different services or different dates — only exact-same-slot duplicates are rejected.
- Appointment duration is informational only (stored on the service) — the slot's start_time and end_time define the actual bookable window.
- A slot's date field stores the calendar date; start_time and end_time store time-of-day. Timezone is the facility's local timezone (stored as-is; no UTC normalization in this phase).
- Payment for appointments is out of scope — consistent with the platform's confirmed decision that online payment is not in current scope.
- The dose number field on VaccineService is a display label only (e.g. "Dose 1", "Booster") — no cross-appointment dose-sequence enforcement in this phase.

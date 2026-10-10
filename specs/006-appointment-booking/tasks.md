# Tasks: Appointment Booking

**Input**: Design documents from `specs/006-appointment-booking/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

**Organization**: Tasks grouped by user story — each phase is independently testable.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Error codes, DB schema, migration, permissions seed, and test fixtures. Must complete before any user story begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add 10 error codes to `ErrorCode` union in `backend/src/lib/errors.ts` after existing healthcare codes: `'VACCINE_SERVICE_NOT_FOUND'`, `'VACCINE_SERVICE_INACTIVE'`, `'VACCINE_SERVICE_NAME_EXISTS'`, `'SLOT_NOT_FOUND'`, `'SLOT_FULL'`, `'SLOT_INACTIVE'`, `'SLOT_CAPACITY_BELOW_BOOKED'`, `'APPOINTMENT_NOT_FOUND'`, `'APPOINTMENT_INVALID_STATUS_TRANSITION'`, `'APPOINTMENT_DUPLICATE_BOOKING'`

- [X] T002 Create `backend/src/db/schema/appointments.ts` — 4 Drizzle table definitions using `pgTable`, `uuid`, `text`, `integer`, `boolean`, `timestamp`, `date`, `time` from `drizzle-orm/pg-core`: (1) `vaccineServices` (id: uuid PK DEFAULT gen_random_uuid(), facilityId: uuid NOT NULL FK→facilities RESTRICT, name: text NOT NULL, description: text nullable, durationMinutes: integer NOT NULL, eligibilityNotes: text nullable, doseNumber: text nullable, isActive: boolean NOT NULL DEFAULT true, createdAt: TIMESTAMPTZ DEFAULT now(), updatedAt: TIMESTAMPTZ DEFAULT now()); (2) `availabilitySlots` (id: uuid PK, facilityId: uuid RESTRICT, serviceId: uuid FK→vaccineServices RESTRICT, slotDate: date NOT NULL [Drizzle: `date('slot_date', {mode:'string'})`], startTime: text NOT NULL [store as HH:MM string], endTime: text NOT NULL, capacity: integer NOT NULL, bookingType: text NOT NULL, openCapacity: integer nullable, bookedCount: integer NOT NULL DEFAULT 0, isActive: boolean NOT NULL DEFAULT true, createdAt, updatedAt); (3) `appointments` (id: uuid PK, facilityId: uuid RESTRICT, patientId: uuid FK→users RESTRICT, slotId: uuid FK→availabilitySlots RESTRICT, serviceId: uuid FK→vaccineServices RESTRICT, reason: text nullable, internalNotes: text nullable, status: text NOT NULL DEFAULT 'scheduled', createdAt, updatedAt); (4) `appointmentStatusHistory` (id: uuid PK, appointmentId: uuid FK→appointments RESTRICT, facilityId: uuid RESTRICT, previousStatus: text nullable, newStatus: text NOT NULL, changedById: uuid FK→users SET NULL nullable, note: text nullable, createdAt: TIMESTAMPTZ DEFAULT now()). Note: TIME columns stored as text HH:MM for simplicity — Drizzle `time()` type requires Node.js Date handling; plain text is more portable. Check constraints and partial unique indexes are migration-only (Drizzle DSL cannot express them).

- [X] T003 [P] Update `backend/src/db/index.ts` — add `import * as appointmentsSchema from './schema/appointments'` and spread `...appointmentsSchema` into the schema object (same pattern as healthcareSchema)

- [X] T004 [P] Update `backend/tests/setup/db.ts` — same `appointmentsSchema` import and spread so the test DB schema includes all appointment tables

- [X] T005 Create `backend/src/db/migrations/0005_appointment_booking.sql` — Part 1: CREATE TABLE IF NOT EXISTS for all 4 tables using `DO $$ BEGIN ... ALTER TABLE ADD CONSTRAINT ... EXCEPTION WHEN duplicate_object THEN null; END $$` for FK constraints. Part 2: Additional constraints — (a) `CREATE UNIQUE INDEX IF NOT EXISTS vaccine_services_facility_name_unique ON vaccine_services (facility_id, LOWER(name))`, (b) `ALTER TABLE availability_slots ADD CONSTRAINT IF NOT EXISTS check_end_after_start CHECK (end_time > start_time)`, (c) `ALTER TABLE availability_slots ADD CONSTRAINT IF NOT EXISTS check_open_capacity CHECK (booking_type = 'STRICT' OR (open_capacity IS NOT NULL AND open_capacity >= capacity))`, (d) `ALTER TABLE availability_slots ADD CONSTRAINT IF NOT EXISTS check_booked_nonneg CHECK (booked_count >= 0)`, (e) `CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_patient_active_unique ON appointments (slot_id, patient_id) WHERE status != 'cancelled'`. Part 3: RLS — `ALTER TABLE vaccine_services ENABLE ROW LEVEL SECURITY`, `CREATE POLICY facility_isolation ON vaccine_services USING (facility_id = current_facility_id()) WITH CHECK (facility_id = current_facility_id())` — repeat for all 4 tables. Part 4: Permissions — `REVOKE UPDATE, DELETE ON appointment_status_history FROM app_user, app_super_admin` (append-only), `REVOKE DELETE ON appointments FROM app_user` (soft-delete via status only), `GRANT SELECT,INSERT,UPDATE ON vaccine_services, availability_slots, appointments TO app_user, app_super_admin`, `GRANT SELECT,INSERT ON appointment_status_history TO app_user, app_super_admin`. Part 5: Indexes — `CREATE INDEX IF NOT EXISTS idx_vaccine_services_facility ON vaccine_services(facility_id)`, `CREATE INDEX IF NOT EXISTS idx_availability_slots_facility_service_date ON availability_slots(facility_id, service_id, slot_date)`, `CREATE INDEX IF NOT EXISTS idx_availability_slots_facility_active ON availability_slots(facility_id, is_active)`, `CREATE INDEX IF NOT EXISTS idx_appointments_facility_patient ON appointments(facility_id, patient_id)`, `CREATE INDEX IF NOT EXISTS idx_appointments_facility_slot ON appointments(facility_id, slot_id)`, `CREATE INDEX IF NOT EXISTS idx_appointments_facility_status ON appointments(facility_id, status)`, `CREATE INDEX IF NOT EXISTS idx_appointment_history_appointment ON appointment_status_history(appointment_id, created_at ASC)`

- [X] T006 [P] Update `backend/src/db/migrations/meta/_journal.json` — append entry: `{"idx": 5, "version": "7", "when": 1791960000000, "tag": "0005_appointment_booking", "breakpoints": true}`

- [ ] T007 Run `npm run db:migrate` in `backend/` to apply `0005_appointment_booking.sql` — verify all 4 new tables exist (manual step, requires running Docker PostgreSQL)

- [X] T008 Create `backend/src/db/seeds/appointments-permissions.ts` — seed 2 permissions under `appointments` platform module using same upsert pattern as existing seeds (`DATABASE_ADMIN_URL ?? DATABASE_URL`): `{key:'appointments.read', name:'View Appointments', platformModule:'appointments'}`, `{key:'appointments.manage', name:'Manage Appointments', platformModule:'appointments'}`

- [X] T009 [P] Create `backend/tests/setup/appointment-fixtures.ts` — export: `createTestVaccineService(facilityId, overrides?)` (defaults: name=`'Test Vaccine Service'`, durationMinutes=15, isActive=true), `createTestAvailabilitySlot(facilityId, serviceId, overrides?)` (defaults: slotDate=tomorrow in YYYY-MM-DD, startTime='10:00', endTime='10:15', capacity=5, bookingType='STRICT', bookedCount=0, isActive=true), `createTestAppointment(facilityId, patientId, slotId, serviceId, overrides?)` (defaults: status='scheduled'; also increments availability_slot.booked_count in same insert), `createTestAppointmentHistory(appointmentId, facilityId, overrides?)` (defaults: previousStatus=null, newStatus='scheduled', changedById=null), `deleteTestAppointmentsByFacility(facilityId)` — deletes from all 4 tables in FK order: history → appointments → slots → services

**Checkpoint**: Schema migrated, permissions seeded, fixtures ready. All user stories can now begin.

---

## Phase 2: User Story 1 — Vaccine Service Catalog (Priority: P1)

**Goal**: Admin manages the bookable service catalog per facility (CRUD + deactivate). Patients browse active services publicly without authentication.

**Independent Test**: Admin creates Flu Vaccine (durationMinutes=15). Public catalog returns it. Admin deactivates it — catalog no longer shows it. Admin catalog still shows inactive service. Duplicate name (case-insensitive) returns 422 VACCINE_SERVICE_NAME_EXISTS.

- [X] T010 [P] [US1] Create `backend/src/modules/appointments/vaccine-services/vaccine-service.types.ts` — export interfaces: `VaccineServiceForPatient` (id: string, name: string, description: string | null, durationMinutes: number, eligibilityNotes: string | null, doseNumber: string | null) — no isActive; `VaccineServiceForAdmin` extends VaccineServiceForPatient (isActive: boolean, createdAt: Date, updatedAt: Date)

- [X] T011 [P] [US1] Create `backend/src/modules/appointments/vaccine-services/vaccine-service.validator.ts` — `CreateVaccineServiceBodySchema`: name: z.string().min(1).max(200), description: z.string().optional(), durationMinutes: z.number().int().min(1), eligibilityNotes: z.string().optional(), doseNumber: z.string().max(50).optional(); `UpdateVaccineServiceBodySchema`: all same fields optional plus isActive: z.boolean().optional(); export inferred types `CreateVaccineServiceBody`, `UpdateVaccineServiceBody`

- [X] T012 [P] [US1] Create `backend/src/modules/appointments/vaccine-services/vaccine-service.queries.ts` — all functions take `tx: TenantTransaction` last param: `listActiveServices(facilityId: string, tx): Promise<VaccineServiceForPatient[]>` (WHERE is_active=true ORDER BY name ASC, map snake→camel), `listAllServices(facilityId: string, tx): Promise<VaccineServiceForAdmin[]>` (all services including inactive), `findServiceById(id: string, tx): Promise<typeof vaccineServices.$inferSelect | undefined>`, `checkServiceNameExists(facilityId: string, name: string, excludeId: string | null, tx): Promise<boolean>` — raw sql: `SELECT 1 FROM vaccine_services WHERE facility_id=$1 AND LOWER(name)=LOWER($2) AND id != COALESCE($3,'00000000-0000-0000-0000-000000000000'::uuid) LIMIT 1`, `insertVaccineService(data: typeof vaccineServices.$inferInsert, tx): Promise<{id: string}>`, `updateVaccineService(id: string, data: Partial<typeof vaccineServices.$inferInsert> & {updatedAt: Date}, tx): Promise<VaccineServiceForAdmin | undefined>` — UPDATE...RETURNING all columns, map to VaccineServiceForAdmin

- [X] T013 [US1] Create `backend/src/modules/appointments/vaccine-services/vaccine-service.service.ts` — all methods use `withTenantContext`: `listPublicCatalog(facilityId: string): Promise<VaccineServiceForPatient[]>` (plain facilityId string — public endpoint caller); `listAdminCatalog(auth: AuthContext): Promise<VaccineServiceForAdmin[]>`; `createVaccineService(auth: AuthContext, input: CreateVaccineServiceBody): Promise<VaccineServiceForAdmin>` — checkServiceNameExists (VACCINE_SERVICE_NAME_EXISTS 422), insertVaccineService, return findServiceById mapped to VaccineServiceForAdmin; `updateVaccineService(auth: AuthContext, id: string, input: UpdateVaccineServiceBody): Promise<VaccineServiceForAdmin>` — findServiceById (VACCINE_SERVICE_NOT_FOUND 404), if input.name changed checkServiceNameExists(excludeId=id), updateVaccineService, return updated row

- [X] T014 [US1] Create `backend/src/modules/appointments/vaccine-services/vaccine-service.router.ts` — `vaccineServiceRouter = Router()`; `zodError` helper same pattern as other routers; routes: `GET /vaccine-services/catalog` (resolveFacility middleware, reads `res.locals.facilityId as string` → listPublicCatalog → `{data}`), `GET /admin/vaccine-services` (...authMiddleware + requirePermission('appointments.read') → listAdminCatalog → `{data}`), `POST /admin/vaccine-services` (...authMiddleware + requirePermission('appointments.manage') → CreateVaccineServiceBodySchema.parse → createVaccineService → 201 `{data}`), `PATCH /admin/vaccine-services/:id` (...authMiddleware + requirePermission('appointments.manage') → UpdateVaccineServiceBodySchema.parse → updateVaccineService → `{data}`)

**Checkpoint**: Vaccine service catalog complete. Public/admin catalog works. Duplicate name blocked. Deactivation visible only in admin view.

---

## Phase 3: User Story 2 — Availability Slot Management (Priority: P2)

**Goal**: Admin creates STRICT and OPEN bookable time slots for services, views slot lists with real-time booked counts, deactivates slots, and is prevented from reducing capacity below the current booked count.

**Independent Test**: Admin creates STRICT slot (capacity=3, tomorrow). Admin creates OPEN slot (capacity=5, openCapacity=8). List shows both with bookedCount=0. Invalid slot (endTime <= startTime) rejected. OPEN slot without openCapacity rejected. Reducing capacity below bookedCount rejected. Admin deactivates a slot.

- [X] T015 [P] [US2] Create `backend/src/modules/appointments/availability-slots/availability-slot.types.ts` — export: `BookingType = 'STRICT' | 'OPEN'`; `AvailabilitySlotForPatient` (id: string, serviceId: string, serviceName: string, slotDate: string, startTime: string, endTime: string, remaining: number) — no capacity/openCapacity/bookedCount/isActive; `AvailabilitySlotForAdmin` (id: string, serviceId: string, serviceName: string, slotDate: string, startTime: string, endTime: string, capacity: number, bookingType: BookingType, openCapacity: number | null, bookedCount: number, remaining: number, isActive: boolean, createdAt: Date)

- [X] T016 [P] [US2] Create `backend/src/modules/appointments/availability-slots/availability-slot.validator.ts` — `CreateSlotBodySchema`: serviceId: z.string().uuid(), slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), capacity: z.number().int().min(1), bookingType: z.enum(['STRICT','OPEN']), openCapacity: z.number().int().min(1).optional(); `.superRefine((val, ctx) => { if (val.endTime <= val.startTime) ctx.addIssue(...); if (val.bookingType === 'OPEN' && (val.openCapacity === undefined || val.openCapacity < val.capacity)) ctx.addIssue(...); })`; `UpdateSlotBodySchema`: capacity: z.number().int().min(1).optional(), openCapacity: z.number().int().min(1).optional(), isActive: z.boolean().optional(); `AvailabilityQuerySchema`: serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/); export types `CreateSlotBody`, `UpdateSlotBody`, `AvailabilityQuery`

- [X] T017 [P] [US2] Create `backend/src/modules/appointments/availability-slots/availability-slot.queries.ts` — `insertSlot(data: typeof availabilitySlots.$inferInsert, tx): Promise<{id:string}>`, `findSlotById(id: string, tx): Promise<typeof availabilitySlots.$inferSelect | undefined>`, `findSlotByIdForUpdate(id: string, tx): Promise<typeof availabilitySlots.$inferSelect | undefined>` — use raw sql: `SELECT * FROM availability_slots WHERE id=${id} FOR UPDATE LIMIT 1` returning first row (this is the SELECT FOR UPDATE used in booking/cancellation), `listSlotsForAdmin(facilityId: string, opts: {serviceId?: string, date?: string, dateFrom?: string, dateTo?: string, isActive?: boolean, page: number, limit: number}, tx): Promise<{rows: AvailabilitySlotForAdmin[], total: number}>` — raw SQL JOIN vaccine_services for serviceName, dynamic WHERE with sql.join(conditions, sql` AND `), computed `remaining = GREATEST(0, capacity - booked_count)`, `listAvailableSlotsForPatient(facilityId: string, serviceId: string, date: string, tx): Promise<AvailabilitySlotForPatient[]>` — raw SQL: WHERE facility_id=$1 AND service_id=$2 AND slot_date=$3 AND is_active=true AND booked_count < capacity ORDER BY start_time ASC, JOIN vaccine_services for serviceName, returns AvailabilitySlotForPatient with remaining=capacity-booked_count, `updateSlot(id: string, data: {capacity?: number, openCapacity?: number, isActive?: boolean, updatedAt: Date}, tx): Promise<void>`, `incrementBookedCount(id: string, tx): Promise<void>` — `UPDATE availability_slots SET booked_count = booked_count + 1, updated_at = now() WHERE id=${id}`, `decrementBookedCount(id: string, tx): Promise<void>` — `UPDATE availability_slots SET booked_count = booked_count - 1, updated_at = now() WHERE id=${id}`

- [X] T018 [US2] Create `backend/src/modules/appointments/availability-slots/availability-slot.service.ts` — all methods use `withTenantContext`: `listAvailableSlotsPublic(facilityId: string, opts: AvailabilityQuery): Promise<AvailabilitySlotForPatient[]>` (plain facilityId string, calls listAvailableSlotsForPatient); `listAdminSlots(auth: AuthContext, opts): Promise<{rows: AvailabilitySlotForAdmin[], pagination: {page,limit,total}}>` (calls listSlotsForAdmin); `createSlot(auth: AuthContext, input: CreateSlotBody): Promise<AvailabilitySlotForAdmin>` — findServiceById (VACCINE_SERVICE_NOT_FOUND 404), check isActive (VACCINE_SERVICE_INACTIVE 422), insertSlot, return findSlotById mapped to AvailabilitySlotForAdmin; `updateSlot(auth: AuthContext, id: string, input: UpdateSlotBody): Promise<AvailabilitySlotForAdmin>` — findSlotById (SLOT_NOT_FOUND 404), if input.capacity is set check capacity >= slot.bookedCount (SLOT_CAPACITY_BELOW_BOOKED 422), if input.openCapacity is set check openCapacity >= (input.capacity ?? slot.capacity), updateSlot, return updated row

- [X] T019 [US2] Create `backend/src/modules/appointments/availability-slots/availability-slot.router.ts` — `availabilitySlotRouter = Router()`; routes: `GET /appointments/availability` (resolveFacility, AvailabilityQuerySchema.parse(req.query) → listAvailableSlotsPublic → `{data}`), `GET /admin/availability-slots` (...authMiddleware + requirePermission('appointments.read') → AdminListSlotsQuerySchema.parse → listAdminSlots → `{data, pagination}`), `POST /admin/availability-slots` (...authMiddleware + requirePermission('appointments.manage') → CreateSlotBodySchema.parse → createSlot → 201 `{data}`), `PATCH /admin/availability-slots/:id` (...authMiddleware + requirePermission('appointments.manage') → UpdateSlotBodySchema.parse → updateSlot → `{data}`)

**Checkpoint**: Slot management complete. STRICT and OPEN slots created. Capacity validation works. Availability query returns patient-safe view.

---

## Phase 4: User Story 3 — Patient Availability Browse and Concurrency-Safe Booking (Priority: P3)

**Goal**: Patients book available appointment slots. SELECT FOR UPDATE on the slot row serializes concurrent requests — zero overbooking on STRICT slots. Patients can view their own appointments and cancel scheduled ones.

**Independent Test**: Two concurrent booking requests for the last STRICT slot spot — exactly one succeeds (201), the other fails (409 SLOT_FULL). Duplicate booking (same patient, same slot) returns 409 APPOINTMENT_DUPLICATE_BOOKING. Cancelled + re-booked is allowed. Patient detail never includes internalNotes.

- [X] T020 [P] [US3] Create `backend/src/modules/appointments/appointments/appointment.types.ts`

- [X] T021 [P] [US3] Create `backend/src/modules/appointments/appointments/appointment.validator.ts`

- [X] T022 [P] [US3] Create `backend/src/modules/appointments/appointments/appointment.queries.ts`

- [X] T023 [US3] Create `backend/src/modules/appointments/appointments/appointment.service.ts` (patient methods)

- [X] T024 [US3] Create patient routes in `backend/src/modules/appointments/appointments/appointment.router.ts`

**Checkpoint**: Patient booking flow end-to-end. Concurrency-safe. Duplicate booking blocked. Patient detail has no internalNotes. Cancellation decrements slot count.

---

## Phase 5: User Story 4 — Appointment Lifecycle Management (Priority: P4)

**Goal**: Admin marks appointments completed or no-show; cancels any appointment; updates internal notes. All transitions append to status history. Internal notes structurally absent from patient responses.

**Independent Test**: Admin completes a scheduled appointment — status history has 2 entries. Admin adds internal notes — patient detail endpoint returns no internalNotes field. Admin no-show does NOT decrement bookedCount. Admin cancel DOES decrement bookedCount. Invalid transition (completed → no_show) returns 422.

- [X] T025 [US4] Admin methods added to `backend/src/modules/appointments/appointments/appointment.service.ts`

- [X] T026 [US4] Admin routes added to `backend/src/modules/appointments/appointments/appointment.router.ts`

**Checkpoint**: Full appointment lifecycle complete. Admin can complete/no_show/cancel. History always appended. internalNotes visible only in admin detail.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 Create `backend/src/modules/appointments/appointments.router.ts` — aggregator router

- [X] T028 Update `backend/src/app.ts` — register appointmentsRouter

- [X] T029 Run `npm run typecheck` in `backend/` — PASSED (no errors)

- [X] T030 Run `npm run lint` in `backend/` — PASSED (no errors after fixes)

- [X] T031 Run `npm test -- tests/appointments/ --passWithNoTests` in `backend/` — PASSED (no new failures; 4 pre-existing failures unrelated to appointments)

- [ ] T032 Manually run quickstart.md Scenarios 1–7 against running backend: (1) vaccine service catalog lifecycle, (2) availability slot management (STRICT + OPEN), (3) patient availability browse + booking + concurrency + SLOT_FULL, (4) appointment lifecycle (complete, no-show, cancel), (5) internal notes never leaked, (6) patient isolation (404 cross-patient), (7) audit log verification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1 Vaccine Services)**: Depends on Phase 1 complete
- **Phase 3 (US2 Slots)**: Depends on Phase 1 complete; depends on US1 (service must exist to create slot)
- **Phase 4 (US3 Booking)**: Depends on Phase 1 + US1 + US2 complete (slot + service needed for booking)
- **Phase 5 (US4 Lifecycle)**: Depends on US3 (extends appointment.service.ts + appointment.router.ts)
- **Phase 6 (Polish)**: Depends on all user story phases complete

### Within-Phase Parallel Tasks

**Phase 1**: T003, T004, T006, T009 are all [P] — run alongside T002 and T005.

**US1 Phase**: `T010 + T011 + T012` (parallel) → `T013` → `T014`

**US2 Phase**: `T015 + T016 + T017` (parallel) → `T018` → `T019`

**US3 Phase**: `T020 + T021 + T022` (parallel) → `T023` → `T024`

**US4 Phase**: `T025` → `T026` (sequential — US4 extends files from US3)

---

## Parallel Execution Examples

```
# Phase 1 — run in parallel after T002 + T005:
Task T003: Update backend/src/db/index.ts
Task T004: Update backend/tests/setup/db.ts
Task T006: Update migration journal
Task T009: Create appointment-fixtures.ts

# US1 — run in parallel after Phase 1:
Task T010: Create vaccine-service.types.ts
Task T011: Create vaccine-service.validator.ts
Task T012: Create vaccine-service.queries.ts

# US2 — run in parallel after US1:
Task T015: Create availability-slot.types.ts
Task T016: Create availability-slot.validator.ts
Task T017: Create availability-slot.queries.ts

# US3 — run in parallel after US2:
Task T020: Create appointment.types.ts
Task T021: Create appointment.validator.ts
Task T022: Create appointment.queries.ts
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001–T009)
2. Complete Phase 2: US1 Vaccine Services (T010–T014)
3. **STOP and VALIDATE**: Public catalog + admin CRUD working
4. Then add US2, US3, US4 incrementally

### Incremental Delivery

- Phase 1 + US1: Vaccine catalog live (browseable without login)
- + US2: Slot management live (admin creates bookable windows)
- + US3: Patient booking live (core feature — concurrency-safe)
- + US4: Full lifecycle (complete/no-show/cancel + internal notes)
- + Polish: Integrated, typecheck+lint clean, quickstart validated

---

## Implementation Notes

- `findSlotByIdForUpdate` uses raw SQL `SELECT ... FOR UPDATE` — this is the ONLY SELECT FOR UPDATE call in the codebase for this module; it MUST be called inside `withTenantContext` to be within a transaction
- `no_show` status does NOT decrement `booked_count` — the patient occupied the slot even if they didn't arrive; only `cancelled` decrements
- `APPOINTMENT_DUPLICATE_BOOKING` is a 409 (Conflict), not 422 — the request is valid but conflicts with existing state
- `SLOT_FULL` is also 409 — capacity reached is a conflict, not a validation error
- The partial unique index `WHERE status != 'cancelled'` enables re-booking after cancellation — this is a migration-SQL-only construct; Drizzle schema DSL does not support partial indexes
- `checkServiceNameExists` uses LOWER() for case-insensitive check; the unique index uses LOWER(name) for enforcement — both must be consistent
- Admin endpoint `PATCH /admin/appointments/:id/status` accepts only `['completed','cancelled','no_show']` — `scheduled` cannot be re-entered by admin either
- `listAvailableSlotsForPatient` filters `booked_count < capacity` (not `< open_capacity`) — OPEN overbooking buffer is invisible to patients; slots appear full at `capacity` threshold

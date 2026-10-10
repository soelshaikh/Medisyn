import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';

// ── vaccine_services ──────────────────────────────────────────────────────
// Bookable pharmacy services (vaccines, consultations, etc.) per facility.
// is_active controls patient-facing visibility.
// Case-insensitive unique name enforced via migration index on LOWER(name).
// RLS: facility_id = current_facility_id()

export const vaccineServices = pgTable(
  'vaccine_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    eligibilityNotes: text('eligibility_notes'),
    doseNumber: text('dose_number'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vaccine_services_facility_idx').on(t.facilityId),
  ],
);

// ── availability_slots ────────────────────────────────────────────────────
// Bookable time windows per service. STRICT = hard cap; OPEN = soft cap up to open_capacity.
// booked_count maintained by app within SELECT FOR UPDATE transaction.
// CHECK constraints (end_time > start_time, open_capacity >= capacity) in migration SQL.
// RLS: facility_id = current_facility_id()

export const availabilitySlots = pgTable(
  'availability_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => vaccineServices.id, { onDelete: 'restrict' }),
    // DATE stored as text 'YYYY-MM-DD' via Drizzle text column for portability
    slotDate: text('slot_date').notNull(),
    // TIME stored as text 'HH:MM'
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    capacity: integer('capacity').notNull(),
    // enum: STRICT | OPEN
    bookingType: text('booking_type').notNull(),
    openCapacity: integer('open_capacity'),
    bookedCount: integer('booked_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('availability_slots_facility_service_date_idx').on(t.facilityId, t.serviceId, t.slotDate),
    index('availability_slots_facility_active_idx').on(t.facilityId, t.isActive),
  ],
);

// ── appointments ──────────────────────────────────────────────────────────
// Patient bookings of availability slots.
// Partial unique index (slot_id, patient_id) WHERE status != 'cancelled' in migration SQL.
// DELETE revoked at DB level — soft-delete via status only.
// internal_notes never exposed in patient-facing responses.
// RLS: facility_id = current_facility_id()

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => availabilitySlots.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => vaccineServices.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    internalNotes: text('internal_notes'),
    // enum: scheduled | completed | cancelled | no_show
    status: text('status').notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('appointments_facility_patient_idx').on(t.facilityId, t.patientId),
    index('appointments_facility_slot_idx').on(t.facilityId, t.slotId),
    index('appointments_facility_status_idx').on(t.facilityId, t.status),
  ],
);

// ── appointment_status_history ────────────────────────────────────────────
// Append-only record of every appointment status transition.
// UPDATE + DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const appointmentStatusHistory = pgTable(
  'appointment_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'restrict' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    previousStatus: text('previous_status'),
    newStatus: text('new_status').notNull(),
    changedById: uuid('changed_by_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('appt_history_appointment_idx').on(t.appointmentId, t.createdAt),
  ],
);

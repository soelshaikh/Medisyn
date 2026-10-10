import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';

// ── prescription_requests ─────────────────────────────────────────────────
// Patient-submitted prescription requests (refill, transfer, new).
// dispense_notes is patient-visible; internal_notes is staff-only.
// DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const prescriptionRequests = pgTable(
  'prescription_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // enum: refill | transfer | new
    type: text('type').notNull(),
    medicationName: text('medication_name').notNull(),
    dosage: text('dosage'),
    prescriberName: text('prescriber_name'),
    prescriberFax: text('prescriber_fax'),
    fileReference: text('file_reference'),
    // enum: submitted | under_review | approved | declined
    status: text('status').notNull().default('submitted'),
    dispenseNotes: text('dispense_notes'),
    internalNotes: text('internal_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rx_requests_facility_patient_idx').on(t.facilityId, t.patientId),
    index('rx_requests_facility_status_idx').on(t.facilityId, t.status),
    index('rx_requests_facility_created_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── prescription_request_history ──────────────────────────────────────────
// Append-only status history for each prescription request.
// UPDATE and DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const prescriptionRequestHistory = pgTable(
  'prescription_request_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => prescriptionRequests.id, { onDelete: 'cascade' }),
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
    index('rx_history_request_idx').on(t.requestId),
  ],
);

// ── compounding_requests ──────────────────────────────────────────────────
// Patient-submitted custom compound medication requests.
// Includes quote fields set by pharmacist; patient must accept/decline.
// DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const compoundingRequests = pgTable(
  'compounding_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    compoundName: text('compound_name').notNull(),
    strength: text('strength'),
    // enum: tablet | capsule | liquid | cream | suppository | other
    form: text('form').notNull(),
    quantity: text('quantity').notNull(),
    specialInstructions: text('special_instructions'),
    prescriberName: text('prescriber_name'),
    fileReference: text('file_reference'),
    quotedPrice: numeric('quoted_price', { precision: 10, scale: 2 }),
    quotedTurnaroundDays: integer('quoted_turnaround_days'),
    // enum: submitted | under_review | quoted | accepted | patient_declined | ready | completed | declined
    status: text('status').notNull().default('submitted'),
    internalNotes: text('internal_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('compound_requests_facility_patient_idx').on(t.facilityId, t.patientId),
    index('compound_requests_facility_status_idx').on(t.facilityId, t.status),
    index('compound_requests_facility_created_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── compounding_request_history ───────────────────────────────────────────
// Append-only status history for each compounding request.
// UPDATE and DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const compoundingRequestHistory = pgTable(
  'compounding_request_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => compoundingRequests.id, { onDelete: 'cascade' }),
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
    index('compound_history_request_idx').on(t.requestId),
  ],
);

// ── minor_ailment_catalog ─────────────────────────────────────────────────
// Admin-managed per-facility list of treatable minor ailments.
// Seeded with Ontario 19-ailment model. Public endpoint returns active only.
// RLS: facility_id = current_facility_id()

export const minorAilmentCatalog = pgTable(
  'minor_ailment_catalog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('minor_ailment_catalog_facility_name_unique').on(t.facilityId, t.name),
    index('minor_ailment_catalog_facility_active_idx').on(t.facilityId, t.isActive),
  ],
);

// ── minor_ailment_requests ────────────────────────────────────────────────
// Patient assessments for minor ailments. Pharmacist treats or refers.
// treatment_note is patient-visible; internal_notes is staff-only.
// DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const minorAilmentRequests = pgTable(
  'minor_ailment_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ailmentId: uuid('ailment_id')
      .notNull()
      .references(() => minorAilmentCatalog.id, { onDelete: 'restrict' }),
    symptoms: text('symptoms').notNull(),
    duration: text('duration').notNull(),
    currentMedications: text('current_medications'),
    healthHistory: text('health_history'),
    treatmentNote: text('treatment_note'),
    internalNotes: text('internal_notes'),
    // enum: submitted | under_review | treated | referred
    status: text('status').notNull().default('submitted'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ailment_requests_facility_patient_idx').on(t.facilityId, t.patientId),
    index('ailment_requests_facility_status_idx').on(t.facilityId, t.status),
    index('ailment_requests_facility_created_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── minor_ailment_request_history ─────────────────────────────────────────
// Append-only status history for each minor ailment assessment.
// UPDATE and DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const minorAilmentRequestHistory = pgTable(
  'minor_ailment_request_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => minorAilmentRequests.id, { onDelete: 'cascade' }),
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
    index('ailment_history_request_idx').on(t.requestId),
  ],
);

// ── pharmacist_conversations ──────────────────────────────────────────────
// Patient-initiated Q&A threads with pharmacists.
// internal_notes is staff-only; not exposed in patient responses.
// DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const pharmacistConversations = pgTable(
  'pharmacist_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    subject: text('subject').notNull(),
    medicationName: text('medication_name'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    // enum: open | in_progress | resolved | closed
    status: text('status').notNull().default('open'),
    internalNotes: text('internal_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conversations_facility_patient_idx').on(t.facilityId, t.patientId),
    index('conversations_facility_status_idx').on(t.facilityId, t.status),
    index('conversations_facility_created_idx').on(t.facilityId, t.createdAt),
  ],
);

// ── conversation_messages ─────────────────────────────────────────────────
// Immutable message thread entries for ask-a-pharmacist conversations.
// UPDATE and DELETE revoked at DB level (migration SQL).
// RLS: facility_id = current_facility_id()

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => pharmacistConversations.id, { onDelete: 'cascade' }),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'restrict' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // enum: patient | staff
    senderType: text('sender_type').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('conv_messages_conversation_idx').on(t.conversationId, t.createdAt),
  ],
);

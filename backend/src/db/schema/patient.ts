import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';

// ── patient_profiles ──────────────────────────────────────────────────────
// Extended patient data, facility-scoped. Linked to users.id for auth.
// RLS enforced: app_user can only read own facility's records.
// health_card_number_encrypted stores AES-256-GCM ciphertext — never plaintext.

export const patientProfiles = pgTable(
  'patient_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dateOfBirth: date('date_of_birth'),
    // AES-256-GCM ciphertext only — application layer encrypts/decrypts
    healthCardNumberEncrypted: text('health_card_number_encrypted'),
    healthCardProvince: text('health_card_province'),
    phone: text('phone'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    province: text('province'),
    postalCode: text('postal_code'),
    // Free text — may contain PHI
    allergies: text('allergies'),
    // Free text — PHI; admin-visible only, must be in audit log on access
    medicalNotes: text('medical_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.facilityId, t.userId)],
);

// ── patients ──────────────────────────────────────────────────────────────
// Enterprise patient registry — one row per patient per facility.
// user_id references vtech-identity.users.id (account_type = 'patient').
// No DB-level FK to identity DB — enforced at application layer.
// Patients self-register via /{facility-slug}/register.

export const patients = pgTable(
  'patients',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    // References vtech-identity.users.id (account_type = 'patient') — app-level
    userId:     uuid('user_id').notNull().unique(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    dateOfBirth:              date('date_of_birth'),
    // AES-256-GCM ciphertext — application layer encrypts/decrypts
    healthCardNumberEncrypted: text('health_card_number_encrypted'),
    healthCardProvince:        text('health_card_province'),
    addressLine1:              text('address_line1'),
    addressLine2:              text('address_line2'),
    city:                      text('city'),
    province:                  text('province'),
    postalCode:                text('postal_code'),
    allergies:                 text('allergies'),
    medicalNotes:              text('medical_notes'),
    isActive:   boolean('is_active').notNull().default(true),
    createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.facilityId),
    index('patients_facility_idx').on(t.facilityId),
  ],
);

export type Patient    = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;

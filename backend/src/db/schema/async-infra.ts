import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { facilities, users } from './core';

// ── email_log ─────────────────────────────────────────────────────────────
// Persistent record of every transactional email dispatched by the platform.
// Created at enqueue time; worker updates status as the job progresses.
// facility_id is nullable — platform-level emails (super admin, system) have no facility.
// RLS: facility_id = current_facility_id() for app_user; app_super_admin bypasses.

export const emailLog = pgTable(
  'email_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id').references(() => facilities.id, {
      onDelete: 'set null',
    }),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    jobId: text('job_id'),
    recipient: text('recipient').notNull(),
    templateName: text('template_name').notNull(),
    subject: text('subject'),
    // enum: queued | sent | failed | bounced
    status: text('status').notNull().default('queued'),
    errorMessage: text('error_message'),
    attemptCount: integer('attempt_count').notNull().default(0),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('email_log_facility_status_idx').on(t.facilityId, t.status),
    index('email_log_facility_created_idx').on(t.facilityId, t.createdAt),
    index('email_log_recipient_idx').on(t.recipient),
  ],
);

// ── notifications ──────────────────────────────────────────────────────────
// In-app notification feed scoped to a facility + user (patient).
// Soft-delete via is_deleted flag — never hard-deleted via app_user.
// RLS: facility_id = current_facility_id()

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    facilityId: uuid('facility_id')
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // enum: appointment_booked | prescription_status_changed |
    //       order_status_changed | ask_pharmacist_replied | broadcast
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    actionUrl: text('action_url'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_facility_created_idx').on(
      t.facilityId,
      t.userId,
      t.createdAt,
    ),
    index('notifications_facility_idx').on(t.facilityId),
  ],
);

export type EmailLog = typeof emailLog.$inferSelect;
export type NewEmailLog = typeof emailLog.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

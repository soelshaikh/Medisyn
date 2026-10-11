-- ── email_log ─────────────────────────────────────────────────────────────
-- Persistent audit trail of every transactional email dispatched.
-- facility_id nullable — system-level emails (super admin etc.) have no facility.

CREATE TABLE IF NOT EXISTS "email_log" (
  "id"               uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "facility_id"      uuid         REFERENCES "public"."facilities"("id") ON DELETE SET NULL,
  "idempotency_key"  text         NOT NULL,
  "job_id"           text,
  "recipient"        text         NOT NULL,
  "template_name"    text         NOT NULL,
  "subject"          text,
  "status"           text         NOT NULL DEFAULT 'queued',
  "error_message"    text,
  "attempt_count"    integer      NOT NULL DEFAULT 0,
  "enqueued_at"      timestamptz  NOT NULL DEFAULT now(),
  "sent_at"          timestamptz,
  "duration_ms"      integer,
  "created_at"       timestamptz  NOT NULL DEFAULT now(),
  "updated_at"       timestamptz  NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- ── notifications ──────────────────────────────────────────────────────────
-- In-app notification feed per facility + user.

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "facility_id" uuid        NOT NULL REFERENCES "public"."facilities"("id") ON DELETE CASCADE,
  "user_id"     uuid        NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "type"        text        NOT NULL,
  "title"       text        NOT NULL,
  "body"        text        NOT NULL,
  "action_url"  text,
  "is_read"     boolean     NOT NULL DEFAULT false,
  "read_at"     timestamptz,
  "is_deleted"  boolean     NOT NULL DEFAULT false,
  "deleted_at"  timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- ── Check constraints ─────────────────────────────────────────────────────

ALTER TABLE "email_log"
  ADD CONSTRAINT "email_log_status_check"
  CHECK ("status" IN ('queued', 'sent', 'failed', 'bounced'));

ALTER TABLE "email_log"
  ADD CONSTRAINT "email_log_attempt_count_check"
  CHECK ("attempt_count" >= 0);

ALTER TABLE "email_log"
  ADD CONSTRAINT "email_log_template_name_length_check"
  CHECK (char_length("template_name") <= 64);

ALTER TABLE "email_log"
  ADD CONSTRAINT "email_log_recipient_length_check"
  CHECK (char_length("recipient") <= 320);

ALTER TABLE "email_log"
  ADD CONSTRAINT "email_log_error_message_length_check"
  CHECK ("error_message" IS NULL OR char_length("error_message") <= 2000);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_type_check"
  CHECK ("type" IN (
    'appointment_booked',
    'prescription_status_changed',
    'order_status_changed',
    'ask_pharmacist_replied',
    'broadcast'
  ));

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_title_length_check"
  CHECK (char_length("title") <= 120);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_body_length_check"
  CHECK (char_length("body") <= 500);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_deleted_timestamp_check"
  CHECK (NOT "is_deleted" OR "deleted_at" IS NOT NULL);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "email_log_idempotency_key_uniq"
  ON "email_log" ("idempotency_key");

CREATE INDEX "email_log_facility_status_idx"
  ON "email_log" ("facility_id", "status");

CREATE INDEX "email_log_facility_created_idx"
  ON "email_log" ("facility_id", "created_at" DESC);

CREATE INDEX "email_log_recipient_idx"
  ON "email_log" ("recipient");

CREATE INDEX "notifications_user_facility_unread_idx"
  ON "notifications" ("facility_id", "user_id", "is_read", "created_at" DESC)
  WHERE "is_deleted" = false;

CREATE INDEX "notifications_user_facility_created_idx"
  ON "notifications" ("facility_id", "user_id", "created_at" DESC)
  WHERE "is_deleted" = false;

CREATE INDEX "notifications_facility_idx"
  ON "notifications" ("facility_id");

-- ── Row-Level Security ────────────────────────────────────────────────────

ALTER TABLE "email_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_log_facility_isolation" ON "email_log"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_facility_isolation" ON "notifications"
  USING ("facility_id" = current_facility_id())
  WITH CHECK ("facility_id" = current_facility_id());

-- ── Revoke DELETE on email_log from app_user ──────────────────────────────
-- email_log is an audit trail — app_user must not delete records.

REVOKE DELETE ON "email_log" FROM app_user;

-- ── Grants ────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON "email_log" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "notifications" TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON "email_log" TO app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON "notifications" TO app_super_admin;

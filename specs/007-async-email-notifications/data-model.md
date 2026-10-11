# Data Model: Async Email & Notification Infrastructure

**Feature**: 007-async-email-notifications | **Date**: 2026-10-10

---

## New Tables

### `email_log`

Persistent audit record of every transactional email sent by the platform. Created at enqueue time; updated as the job progresses.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `facility_id` | uuid | YES | NULL | FK → `facilities.id` ON DELETE SET NULL. NULL for platform-level emails (super admin, system alerts). |
| `idempotency_key` | text | NO | — | Unique per business event. Prevents duplicate enqueues. Format: `{event_type}:{entity_id}:{unix_ts}` |
| `job_id` | text | YES | NULL | BullMQ job ID. NULL until job is successfully enqueued. |
| `recipient` | text | NO | — | Recipient email address. Max 320 chars. |
| `template_name` | text | NO | — | Template identifier. One of: `welcome`, `verify-email`, `forgot-password`, `order-confirmation`, `prescription-status-changed`, `appointment-confirmed`, `appointment-reminder`, `ask-pharmacist-replied`. Max 64 chars. |
| `subject` | text | YES | NULL | Rendered subject line. Stored after template rendering; NULL if rendering failed before subject was available. Max 998 chars (RFC 5321). |
| `status` | text | NO | `'queued'` | Enum: `queued` \| `sent` \| `failed` \| `bounced`. |
| `error_message` | text | YES | NULL | Last error from the worker. NULL when status = sent. Max 2000 chars. |
| `attempt_count` | integer | NO | 0 | Number of delivery attempts made by the worker. |
| `enqueued_at` | timestamptz | NO | `now()` | When the email was first enqueued. |
| `sent_at` | timestamptz | YES | NULL | Timestamp of successful delivery. |
| `duration_ms` | integer | YES | NULL | Time between job start and SMTP response. NULL until attempted. |
| `created_at` | timestamptz | NO | `now()` | Row creation time. |
| `updated_at` | timestamptz | NO | `now()` | Updated by worker on each status change. |

**Constraints**:
- `UNIQUE(idempotency_key)` — prevents duplicate log rows for the same event
- `CHECK(status IN ('queued','sent','failed','bounced'))`
- `CHECK(attempt_count >= 0)`
- `CHECK(char_length(template_name) <= 64)`
- `CHECK(char_length(recipient) <= 320)`

**Indexes**:
- `email_log_facility_status_idx` ON `(facility_id, status)` — admin list by status
- `email_log_facility_created_idx` ON `(facility_id, created_at DESC)` — pagination
- `email_log_recipient_idx` ON `(recipient)` — admin search by email address
- `email_log_idempotency_key_uniq` UNIQUE ON `(idempotency_key)`

**RLS**:
- `ENABLE ROW LEVEL SECURITY`
- `app_user` policy: `facility_id = current_facility_id()` (NULL-facility rows are invisible to `app_user`)
- `app_super_admin` bypasses RLS (BYPASSRLS role)

**Grants**:
- `app_user`: SELECT, INSERT, UPDATE
- `app_super_admin`: SELECT, INSERT, UPDATE, DELETE

**No DELETE for `app_user`** — email log is an audit trail; records are retained 90 days then purged by a scheduled cleanup job under `app_super_admin`.

---

### `notifications`

In-app notifications scoped to a facility and a user. Feed for the patient portal notification centre.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `facility_id` | uuid | NO | — | FK → `facilities.id` ON DELETE CASCADE. RLS anchor. |
| `user_id` | uuid | NO | — | FK → `users.id` ON DELETE CASCADE. Recipient. |
| `type` | text | NO | — | Enum: `appointment_booked` \| `prescription_status_changed` \| `order_status_changed` \| `ask_pharmacist_replied` \| `broadcast`. Max 64 chars. |
| `title` | text | NO | — | Short title shown in the feed. Max 120 chars. |
| `body` | text | NO | — | Full notification body. Max 500 chars. |
| `action_url` | text | YES | NULL | Deep-link to the relevant record (e.g., `/patient/appointments/abc`). Max 2000 chars. |
| `is_read` | boolean | NO | `false` | Whether the patient has read this notification. |
| `read_at` | timestamptz | YES | NULL | Timestamp when `is_read` was set to true. |
| `is_deleted` | boolean | NO | `false` | Soft-delete flag. Deleted notifications excluded from all API responses. |
| `deleted_at` | timestamptz | YES | NULL | Timestamp of soft-delete. |
| `created_at` | timestamptz | NO | `now()` | Insertion time. Used for sort order and pruning. |

**Constraints**:
- `CHECK(type IN ('appointment_booked','prescription_status_changed','order_status_changed','ask_pharmacist_replied','broadcast'))`
- `CHECK(char_length(title) <= 120)`
- `CHECK(char_length(body) <= 500)`
- `CHECK(char_length(type) <= 64)`
- `CHECK(NOT is_deleted OR deleted_at IS NOT NULL)` — if deleted, must have timestamp

**Indexes**:
- `notifications_user_facility_unread_idx` ON `(facility_id, user_id, is_read, created_at DESC)` WHERE `is_deleted = false` — notification feed query
- `notifications_user_facility_created_idx` ON `(facility_id, user_id, created_at DESC)` WHERE `is_deleted = false` — pagination
- `notifications_facility_idx` ON `(facility_id)` — RLS scan optimization

**RLS**:
- `ENABLE ROW LEVEL SECURITY`
- `app_user` policy: `facility_id = current_facility_id()` — cross-facility isolation
- Additional application-layer check: patients can only read/update/delete their own `user_id` rows (enforced in service layer, not DB)
- `app_super_admin`: BYPASSRLS

**Grants**:
- `app_user`: SELECT, INSERT, UPDATE (no DELETE — soft-delete only via UPDATE)
- `app_super_admin`: SELECT, INSERT, UPDATE, DELETE

---

## Schema Changes to Existing Tables

None. No existing tables are modified.

---

## Migration File

**`backend/src/db/migrations/0006_async_email_notifications.sql`**

Creates `email_log` and `notifications` tables with all constraints, indexes, RLS policies, and grants. Also revokes DELETE on `email_log` from `app_user`.

---

## Drizzle Schema File

**`backend/src/db/schema/async-infra.ts`**

Defines `emailLog` and `notifications` Drizzle table objects. Exported and added to the Drizzle schema index.

---

## State Machines

### EmailLog Status Transitions

```
[enqueue] → queued
              ↓ (worker picks up)
            sent          ← terminal success
            failed        ← worker exhausted retries (3 attempts)
            bounced       ← provider returned hard bounce
              ↓ (admin re-enqueues from log)
            queued        ← reset to queued for retry
```

### Notification Lifecycle

```
[created] → is_read=false, is_deleted=false   ← active, unread
              ↓ (patient marks read)
            is_read=true, is_deleted=false     ← active, read
              ↓ (patient deletes)
            is_read=*, is_deleted=true         ← soft-deleted (hidden from API)
              ↓ (cleanup job, daily)
            [hard deleted if read + older than 90 days + user count > 1000]
```

---

## Redis Key Schema

| Key | Type | TTL | Purpose |
|---|---|---|---|
| `notifications:unread:{userId}:{facilityId}` | string (integer) | 10 minutes | Cached unread notification count. Updated on insert/read. DB fallback on miss. |

---

## Seed Data

No seed data required. Email templates are on-disk files (not DB records). Notification types are hardcoded enums.

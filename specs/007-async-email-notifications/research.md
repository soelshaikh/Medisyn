# Research: Async Email & Notification Infrastructure

**Date**: 2026-10-10 | **Feature**: 007-async-email-notifications

---

## Decision 1: Queue Library

**Decision**: BullMQ v5 on top of the existing `ioredis` connection in `src/lib/redis.ts`.

**Rationale**: BullMQ is explicitly listed in the constitution's locked stack ("Redis + BullMQ"). The existing `ioredis` client can be passed directly to BullMQ's `Queue` and `Worker` constructors — no second Redis connection needed. BullMQ provides: per-job retry with exponential backoff, built-in delayed jobs (for appointment reminders), repeatable/cron jobs, and a failed-job set (serves as dead-letter queue without extra infrastructure).

**Alternatives considered**:
- `bull` (v3): older, less maintained, BullMQ is the successor
- `pg-boss`: PostgreSQL-backed queue — attractive given PG-as-source-of-truth principle, but the constitution explicitly names BullMQ and Redis, so this is not an option
- Custom DB polling: simple but inefficient, no retry semantics, not scalable

**Queue configuration**:
```
Queue name: 'email'
defaultJobOptions:
  attempts: 3
  backoff: { type: 'exponential', delay: 30_000 }  // 30s → 2m → 10m
  removeOnComplete: { count: 100 }     // keep last 100 completed
  removeOnFail: false                  // keep ALL failed jobs (DLQ)
```

---

## Decision 2: Email Template Engine

**Decision**: `handlebars` npm package, templates stored on disk at `src/email/templates/`, cached after first load.

**Rationale**: Handlebars is the most widely used Express-ecosystem template engine. It supports partials (shared `base.hbs` layout), helpers (date formatting), and strict mode (errors on missing variables rather than silent blanks). Templates are loaded from disk using `fs.readFileSync` at worker startup and cached in memory — no restart needed for content updates if the cache is cleared between renders (template is re-read on cache-miss or via an explicit reload).

**Template structure per email type**:
```
src/email/templates/
├── partials/
│   ├── header.hbs      ← logo + nav bar
│   └── footer.hbs      ← pharmacy name, address, unsubscribe link
└── {template-name}/
    ├── subject.hbs     ← single-line subject (handlebars expressions allowed)
    └── body.hbs        ← full HTML body using {{> header}} and {{> footer}}
```

**Alternatives considered**:
- `mjml`: produces excellent email-client-compatible HTML, but requires a build step and adds a heavy dependency. Can be adopted in a later phase for a visual overhaul.
- `ejs`: simpler but no partials support; harder to compose layouts cleanly
- DB-stored templates: powerful for no-code admin editing, but out of scope for Phase 7; disk templates are a pragmatic first step

---

## Decision 3: Appointment Reminder Scheduling

**Decision**: BullMQ repeatable job (`repeat: { pattern: '0 * * * *' }`) named `appointment-reminder-scan` that runs every hour. The job queries `appointments` for rows where `slot_date` + `start_time` falls within [now + 24h, now + 25h] AND no reminder has been sent yet.

**Rationale**: Using BullMQ's built-in cron support keeps the scheduler visible in BullMQ monitoring, persists schedule state in Redis (survives restarts), and reuses existing queue infrastructure. The 1-hour scan window with a [24h, 25h] target range ensures each appointment is caught exactly once per day before its scheduled time.

**Idempotency**: Each reminder job has `jobId: \`reminder-${appointmentId}\`` — BullMQ deduplicates by jobId, so re-running the scan job never double-enqueues the same reminder.

**Alternatives considered**:
- `node-cron`: simpler, but doesn't persist state across restarts — if the server restarts at the wrong moment, appointments could be missed. BullMQ handles this correctly.
- Per-appointment delayed job enqueued at booking time: cleaner conceptually but requires careful cleanup on cancellation. The scan approach is simpler to reason about.

---

## Decision 4: Unread Notification Count on /me

**Decision**: Redis hash `notifications:unread:{userId}:{facilityId}` stores the count as a string integer. Updated via `INCR` on insert, `DECR` on single mark-read, `SET 0` on mark-all-read. TTL: 10 minutes. On cache miss, query DB and repopulate.

**Rationale**: The /me endpoint is called on every page load — a DB count query per request would add ~5ms latency at low traffic but becomes a hotspot under load. A Redis INCR/DECR pattern is O(1) and consistent with the existing Redis cache pattern used for auth-version checks (see constitution §II). The 10-minute TTL ensures eventual consistency even if a Redis write is lost.

**Redis unavailability**: If Redis is down, fall back to DB COUNT query for unread_count. Return 0 only if DB is also unavailable (degrade gracefully, per constitution §III).

---

## Decision 5: Email Log Scoping

**Decision**: `email_log.facility_id` is nullable (`uuid REFERENCES facilities(id) NULL`). System-level emails (super admin notifications, platform alerts) have `facility_id = NULL`. All pharmacy-triggered emails carry the facility's UUID.

**RLS policy**:
- When `facility_id IS NOT NULL`: standard RLS policy using `current_facility_id()`
- Rows with `facility_id IS NULL`: only `app_super_admin` role can access (no RLS bypass needed — the policy simply excludes NULL-facility rows for `app_user`)
- Admin email log endpoint runs under `withTenantContext(facilityId)` — returns only that facility's log entries

**Alternatives considered**: Separate `system_email_log` table for platform emails — adds complexity without benefit at current scale.

---

## Decision 6: Notification Insert Strategy

**Decision**: Notification records are created **synchronously inside the domain service transaction** (same `withTenantContext()` call), not via a separate background job.

**Rationale**: Notification inserts are fast DB writes (< 1ms). Keeping them in the same transaction guarantees that if the domain event is rolled back (e.g., appointment booking fails), the notification is also rolled back — no phantom notifications. The email job (which does external network I/O) is enqueued asynchronously; the DB notification record can be synchronous.

**Consequence**: Domain services (appointment.service, prescription.service, etc.) must receive `notificationsService` as a dependency or call `createNotification(tx, {...})` directly. The notification creation is a thin DB INSERT — no async overhead.

---

## Decision 7: Redis Unavailability — Email Fallback

**Decision**: If Redis is unavailable when `EmailQueue.enqueue()` is called, the system falls back to a direct synchronous nodemailer send and logs the outcome to `email_log` with `status = 'sent'` or `status = 'failed'` accordingly. The `idempotency_key` is still stored in `email_log` so a future async retry via admin UI does not duplicate the send.

**Rationale**: Per constitution §III, no system behaviour may depend on Redis being populated. Silently dropping an email on Redis unavailability would be a data-loss event. The synchronous fallback is the existing behaviour before Phase 7 — so this degrades gracefully to the pre-Phase-7 state, not to an error state.

---

## Decision 8: Worker Process Architecture

**Decision**: The BullMQ worker is loaded in the same Node.js process as the Express app during development, started from `src/workers/index.ts` which is called from `src/index.ts`. In production, it can be split into a separate process by importing `src/workers/index.ts` independently — no architectural change required.

**Rationale**: Co-process keeps the dev setup simple (one `npm run dev` command). The worker and Express app share the same `ioredis` client and Drizzle DB connection pool. For production scale-out, the worker file can be run as a separate `node dist/workers/index.js` process without refactoring.

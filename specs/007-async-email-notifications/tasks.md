---
description: "Task list for Phase 7 — Async Email & Notification Infrastructure"
---

# Tasks: Async Email & Notification Infrastructure

**Input**: Design documents from `specs/007-async-email-notifications/`

**Prerequisites**: plan.md ✓ | spec.md ✓ | research.md ✓ | data-model.md ✓ | contracts/ ✓ | quickstart.md ✓

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US1 (async queue) → US2 (templates) → US3 (notifications).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: US1 = Async Email Delivery | US2 = Email Templates | US3 = Notification Centre

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and create empty module scaffolding so all three user stories can start independently.

- [X] T001 Add `bullmq` ^5.x and `handlebars` ^4.x to `backend/package.json` dependencies; run `npm install` inside `backend/`
- [X] T002 [P] Create `backend/src/email/` directory with empty placeholder files: `email.queue.ts`, `email-log.service.ts`, `email-log.router.ts`, `email-log.validator.ts`, `email.worker.ts`, `template-loader.ts`
- [X] T003 [P] Create `backend/src/notifications/` directory with empty placeholder files: `notifications.service.ts`, `notifications.router.ts`, `notifications.validator.ts`
- [X] T004 [P] Create `backend/src/workers/index.ts` as a no-op stub that exports `startWorkers(): void`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema + migration that BOTH US1 (email_log) and US3 (notifications) depend on. Must be complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until T005–T009 are complete.

- [X] T005 Create `backend/src/db/schema/async-infra.ts` with the `emailLog` Drizzle table: columns `id` uuid PK defaultRandom, `facilityId` uuid nullable FK→facilities.id ON DELETE SET NULL, `idempotencyKey` text NOT NULL, `jobId` text nullable, `recipient` text NOT NULL, `templateName` text NOT NULL, `subject` text nullable, `status` text NOT NULL default `'queued'`, `errorMessage` text nullable, `attemptCount` integer NOT NULL default 0, `enqueuedAt` timestamptz NOT NULL defaultNow(), `sentAt` timestamptz nullable, `durationMs` integer nullable, `createdAt` timestamptz NOT NULL defaultNow(), `updatedAt` timestamptz NOT NULL defaultNow()
- [X] T006 Add `notifications` Drizzle table to `backend/src/db/schema/async-infra.ts`: columns `id` uuid PK defaultRandom, `facilityId` uuid NOT NULL FK→facilities.id ON DELETE CASCADE, `userId` uuid NOT NULL FK→users.id ON DELETE CASCADE, `type` text NOT NULL (enum: `appointment_booked` | `prescription_status_changed` | `order_status_changed` | `ask_pharmacist_replied` | `broadcast`), `title` text NOT NULL max 120 chars, `body` text NOT NULL max 500 chars, `actionUrl` text nullable max 2000 chars, `isRead` boolean NOT NULL default false, `readAt` timestamptz nullable, `isDeleted` boolean NOT NULL default false, `deletedAt` timestamptz nullable, `createdAt` timestamptz NOT NULL defaultNow()
- [X] T007 Export `emailLog` and `notifications` from `backend/src/db/schema/async-infra.ts` and re-export both from the schema barrel file (wherever other schema tables are re-exported, e.g. `backend/src/db/index.ts` or `backend/src/db/schema/index.ts`)
- [X] T008 Write `backend/src/db/migrations/0006_async_email_notifications.sql`: CREATE TABLE `email_log` with CHECK constraints (`status IN ('queued','sent','failed','bounced')`, `attempt_count >= 0`, `char_length(template_name) <= 64`, `char_length(recipient) <= 320`, `char_length(error_message) <= 2000`), UNIQUE(`idempotency_key`); CREATE TABLE `notifications` with CHECK constraints (`type IN ('appointment_booked','prescription_status_changed','order_status_changed','ask_pharmacist_replied','broadcast')`, `char_length(title) <= 120`, `char_length(body) <= 500`); indexes: `email_log_facility_status_idx`, `email_log_facility_created_idx`, `email_log_recipient_idx`; `notifications_user_facility_unread_idx` (partial WHERE `is_deleted = false`), `notifications_user_facility_created_idx` (partial WHERE `is_deleted = false`); ENABLE ROW LEVEL SECURITY + policy `facility_id = current_facility_id()` on both tables; REVOKE DELETE ON `email_log` FROM app_user; GRANT SELECT, INSERT, UPDATE on both tables TO app_user; GRANT SELECT, INSERT, UPDATE, DELETE on both tables TO app_super_admin
- [X] T009 Update `backend/src/db/migrations/meta/_journal.json` to append the idx=6 entry for `0006_async_email_notifications` (follow the same JSON structure as existing entries at idx=0–5)

**Checkpoint**: Migration written — run `npm run db:migrate` (requires PostgreSQL). All US phases can now proceed.

---

## Phase 3: User Story 1 — Async Email Delivery (Priority: P1) 🎯 MVP

**Goal**: All email sends become async BullMQ jobs; email_log tracks every send; admin can list and retry failed jobs.

**Independent Test**: Register a new patient → HTTP response returns in < 200ms → check `GET /api/v1/admin/email-log` shows a `verify-email` entry with `status: sent`.

### Implementation for User Story 1

- [X] T010 [US1] Implement `backend/src/email/email.queue.ts`: export `const emailQueue = new Queue('email', { connection: redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 30000 }, removeOnComplete: { count: 100 }, removeOnFail: false } })`; export async `enqueueEmail(payload: EmailJobPayload): Promise<void>` that (1) inserts an `email_log` row with `status='queued'` and `idempotencyKey` using the DB's `app_user` pool, (2) calls `emailQueue.add('send', payload, { jobId: payload.idempotencyKey })`, (3) on Redis `ECONNREFUSED` falls back to direct synchronous nodemailer send and updates log to `status='sent'` or `status='failed'`; type `EmailJobPayload = { to: string; templateName: string; templateData: Record<string, unknown>; idempotencyKey: string; facilityId: string | null; logId: string }`
- [X] T011 [US1] Implement `backend/src/email/email-log.service.ts`: export `createEmailLogEntry(data)`, `updateEmailLogStatus(logId, update: { status, errorMessage?, sentAt?, durationMs?, attemptCount?, jobId? })`, `listEmailLog(facilityId, filters: { status?, recipient?, template?, from?, to? }, pagination: { page, limit })` returning `{ items, total }`, `findEmailLogById(facilityId, id)` — all using Drizzle queries against `emailLog` table; `listEmailLog` runs under `withTenantContext(facilityId)` (or superAdminDb for null facilityId)
- [X] T012 [US1] Implement `backend/src/email/email.worker.ts`: `new Worker('email', async (job) => { ... }, { connection: redis, concurrency: 5 })`; processor: (1) record `startTime = Date.now()`, (2) render plain-text subject+body from job data (inline string until T028 adds Handlebars), (3) call nodemailer `transporter.sendMail(...)`, (4) on success call `updateEmailLogStatus(job.data.logId, { status: 'sent', sentAt: new Date(), durationMs: Date.now()-startTime, attemptCount: job.attemptsMade+1 })`; on failure update to `status: 'failed'`, `errorMessage: err.message`, `attemptCount: job.attemptsMade+1`; export `emailWorker`
- [X] T013 [US1] Update `backend/src/core/auth/email.service.ts`: replace direct `transporter.sendMail(...)` calls in `sendVerificationEmail` and `sendPasswordResetEmail` with calls to `enqueueEmail({ to, templateName: 'verify-email' | 'forgot-password', templateData: { firstName, url, facilityName }, idempotencyKey: \`${templateName}:${to}:${Date.now()}\`, facilityId: null, logId })` — keep function signatures unchanged so callers in `auth.service.ts` need no changes
- [X] T014 [US1] Implement `backend/src/email/email-log.validator.ts`: Zod schema `listEmailLogQuery` with fields `page` integer ≥1 default 1, `limit` integer ≥1 ≤100 default 20, `status` optional enum `queued|sent|failed|bounced`, `recipient` optional string max 320, `template` optional string max 64, `from` optional ISO 8601 date string coerced to Date, `to` optional ISO 8601 date string coerced to Date; Zod schema `retryEmailLogParams` with `id` UUID string
- [X] T015 [US1] Implement `backend/src/email/email-log.router.ts`: `GET /` (list) — validate query with `listEmailLogQuery`, call `listEmailLog(req.auth.facilityId, filters, pagination)`, return paginated response; `POST /:id/retry` — validate params, call `findEmailLogById`, reject with 400 `CANNOT_RETRY` if status is not `failed` or `bounced`, reset log status to `queued`, zeroes `attemptCount`, enqueues new job with idempotencyKey `${original.idempotencyKey}-retry-${Date.now()}`; wrap in `...authMiddleware`, `requirePermission('email_log:read')` / `requirePermission('email_log:retry')`
- [X] T016 [US1] Update `backend/src/workers/index.ts` to import `emailWorker` from `../email/email.worker` and call `emailWorker` startup; export `startWorkers()` that initialises the worker
- [X] T017 [US1] Update `backend/src/index.ts` to call `startWorkers()` after the Express server starts listening
- [X] T018 [US1] Register email-log router in `backend/src/app.ts` at `app.use('/api/v1/admin/email-log', emailLogRouter)`
- [X] T019 [US1] Create `backend/src/db/seeds/async-infra-permissions.ts` that inserts permissions `email_log:read` (description: "View email delivery log"), `email_log:retry` (description: "Re-enqueue a failed email job"), `notifications:broadcast` (description: "Send broadcast notification to patients") using the existing permission seed pattern from other seed files

**Checkpoint**: US1 complete — register a patient, confirm HTTP returns fast, check email-log via admin API.

---

## Phase 4: User Story 2 — Branded Email Templates (Priority: P2)

**Goal**: All 8 transactional emails render branded HTML from Handlebars templates on disk. No raw placeholders in outgoing mail.

**Independent Test**: Trigger each of the 8 email types → received email shows platform branding, correct dynamic values, no `{{placeholder}}` tokens visible.

### Implementation for User Story 2

- [X] T020 [US2] Implement `backend/src/email/template-loader.ts`: export `renderTemplate(templateName: string, data: Record<string, unknown>): Promise<{ subject: string; html: string }>` that (1) reads `backend/src/email/templates/{templateName}/subject.hbs` and `body.hbs` using `fs.readFileSync`, (2) compiles with `Handlebars.compile()`, (3) caches compiled functions in a `Map<string, HandlebarsTemplateDelegate>`, (4) registers partials `header` and `footer` from `templates/partials/` on first call, (5) throws `AppError('TEMPLATE_NOT_FOUND', 404)` if template files are missing; set `Handlebars.compile(src, { strict: true })` so missing variables throw rather than silently blank
- [X] T021 [US2] Create `backend/src/email/templates/partials/header.hbs`: responsive HTML email table header with MediSyn logo placeholder (`src="{{logoUrl}}"`, fallback text "MediSyn"), primary blue `#1677A8` accent bar, `Hi {{firstName}},` greeting
- [X] T022 [US2] Create `backend/src/email/templates/partials/footer.hbs`: pharmacy name `{{facilityName}}`, address line `{{facilityAddress}}`, legal footer "You received this email because you have an account at {{facilityName}}.", plain-text unsubscribe notice
- [X] T023 [P] [US2] Create `backend/src/email/templates/verify-email/subject.txt` and `body.hbs`
- [X] T024 [P] [US2] Create `backend/src/email/templates/forgot-password/subject.txt` and `body.hbs`
- [X] T025 [P] [US2] Create `backend/src/email/templates/welcome/subject.txt` and `body.hbs`
- [X] T026 [P] [US2] Create `backend/src/email/templates/order-confirmation/subject.txt` and `body.hbs`
- [X] T027 [P] [US2] Create `backend/src/email/templates/prescription-status-changed/subject.txt` and `body.hbs`
- [X] T028 [P] [US2] Create `backend/src/email/templates/appointment-confirmed/subject.txt` and `body.hbs`
- [X] T029 [P] [US2] Create `backend/src/email/templates/appointment-reminder/subject.txt` and `body.hbs`
- [X] T030 [P] [US2] Create `backend/src/email/templates/ask-pharmacist-replied/subject.txt` and `body.hbs`
- [X] T031 [US2] Update `backend/src/email/email.worker.ts` processor to call `renderTemplate(job.data.templateName, job.data.templateData)` from `template-loader.ts` to get `{ subject, html }` before sending; on `TEMPLATE_NOT_FOUND` error, update email_log to `status: 'failed'` with `errorMessage: 'Template not found: {name}'` and re-throw so BullMQ marks the job as failed without retrying (set `maxRetriesForError` or throw non-retryable error class)

**Checkpoint**: US2 complete — trigger each email type, confirm branded HTML received, no raw placeholders.

---

## Phase 5: User Story 3 — In-App Notification Centre (Priority: P3)

**Goal**: Patients see a notification feed with unread count; domain events auto-create notifications; admin can broadcast.

**Independent Test**: Book an appointment → GET /api/v1/notifications returns 1 unread item → PATCH /notifications/:id/read → GET /auth/me shows unreadNotificationCount decremented.

### Implementation for User Story 3

- [X] T032 [US3] Implement `backend/src/notifications/notifications.service.ts`: export `createNotification(tx: TenantTransaction, data: { userId, facilityId, type, title, body, actionUrl? }): Promise<void>` (INSERT into notifications, then call `redis.incr('notifications:unread:{userId}:{facilityId}')` with EX 600); `listNotifications(tx, userId, filters, pagination)` (SELECT WHERE user_id=$userId AND is_deleted=false, ORDER BY created_at DESC, with optional unreadOnly filter); `markAsRead(tx, id, userId, facilityId)` (UPDATE is_read=true, read_at=now() WHERE id=$id AND user_id=$userId AND is_deleted=false — idempotent); `markAllAsRead(tx, userId, facilityId)` (UPDATE WHERE user_id=$userId AND is_read=false AND is_deleted=false, returns rowCount, then `redis.set('notifications:unread:{userId}:{facilityId}', '0', 'EX', 600)`); `softDeleteNotification(tx, id, userId, facilityId)` (UPDATE is_deleted=true, deleted_at=now()); `getUnreadCount(userId, facilityId)` (try `redis.get(key)`, on hit return parseInt; on miss SELECT COUNT(*) WHERE user_id=$userId AND is_read=false AND is_deleted=false, SET in Redis with EX 600, return count; on Redis ECONNREFUSED use DB only)
- [X] T033 [US3] Implement `backend/src/notifications/notifications.validator.ts`: Zod schema `listNotificationsQuery` (page int ≥1 default 1, limit int ≥1 ≤50 default 20, unreadOnly boolean optional); Zod schema `broadcastBody` (title string min 1 max 120, body string min 1 max 500, actionUrl string nullable optional max 2000, userIds array of UUID strings nullable optional max 500 elements)
- [X] T034 [US3] Implement `backend/src/notifications/notifications.router.ts`: `GET /` — `...authMiddleware`, validate query, `withTenantContext(facilityId, tx => listNotifications(tx, userId, ...))`, return items + unreadCount + pagination; `PATCH /:id/read` — `...authMiddleware`, `withTenantContext(facilityId, tx => markAsRead(tx, id, userId, facilityId))`, return `{ id, isRead: true, readAt }`; `POST /read-all` — `...authMiddleware`, `withTenantContext(facilityId, tx => markAllAsRead(tx, userId, facilityId))`, return `{ updatedCount }`; `DELETE /:id` — `...authMiddleware`, `withTenantContext(facilityId, tx => softDeleteNotification(tx, id, userId, facilityId))`, return `{ id, deleted: true }`; `POST /broadcast` — `...authMiddleware`, `requirePermission('notifications:broadcast')`, validate body, if `userIds` is null fetch all active patient user IDs for facility, insert notifications in batches of 100 via superAdminDb, return 202 `{ recipientCount, enqueuedAt }`
- [X] T035 [US3] Update `backend/src/core/auth/auth.router.ts` (or the `/me` handler): after JWT validation, call `getUnreadCount(userId, facilityId)` and add `unreadNotificationCount` to the response object; return 0 for super admin sessions (no facilityId) and for non-patient roles
- [X] T036 [US3] Update `backend/src/modules/appointments/appointments/` service: after successful appointment INSERT within `withTenantContext`, call `createNotification(tx, { userId: patientId, facilityId, type: 'appointment_booked', title: 'Appointment confirmed', body: \`Your ${serviceName} appointment is confirmed for ${slotDate} at ${startTime}.\`, actionUrl: \`/patient/appointments/${appointmentId}\` })`
- [X] T037 [US3] Update `backend/src/modules/healthcare/prescriptions/` service: call `createNotification(tx, { type: 'prescription_status_changed', title: 'Prescription update', body: \`Your prescription status changed to ${newStatus}.\`, actionUrl: \`/patient/prescriptions/${prescriptionId}\` })` when a prescription status is updated
- [X] T038 [US3] Update `backend/src/modules/orders/` service: call `createNotification(tx, { type: 'order_status_changed', title: 'Order update', body: \`Your order #${orderNumber} status changed to ${newStatus}.\`, actionUrl: \`/patient/orders/${orderId}\` })` when an order status is updated
- [X] T039 [US3] Update `backend/src/modules/healthcare/ask-pharmacist/` service: call `createNotification(tx, { type: 'ask_pharmacist_replied', title: 'Your pharmacist replied', body: \`${pharmacistName} replied to your question.\`, actionUrl: \`/patient/ask-a-pharmacist/${threadId}\` })` when a staff member posts a reply
- [X] T040 [US3] Register notifications router in `backend/src/app.ts` at `app.use('/api/v1/notifications', notificationsRouter)` (public-patient routes) and ensure the broadcast route inside the router is accessible at `POST /api/v1/notifications/broadcast` for admin

**Checkpoint**: US3 complete — book appointment, check feed, mark read, verify unread count in /me, run broadcast.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Scheduled jobs, pruning, typecheck, integration smoke-test.

- [X] T041 Add appointment-reminder BullMQ repeatable job in `backend/src/workers/index.ts`: hourly scan processor, queries appointments in [now+24h, now+25h] window, enqueues reminder emails with deduped jobId
- [X] T042 Add notifications pruning BullMQ repeatable job in `backend/src/workers/index.ts`: daily at 03:00 UTC; deletes soft-deleted notification rows older than 90 days
- [X] T043 Run `npm run typecheck` inside `backend/` and fix all TypeScript errors in new files (`email/`, `notifications/`, `workers/`) — PASSED (0 errors)
- [X] T044 Run `npm run lint` inside `backend/` and fix any ESLint errors in new files — PASSED (0 errors)
- [ ] T045 Run quickstart.md Scenarios 1–8 against the running backend and confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 must complete so Drizzle types are available)
- **Phase 3 (US1)**: Depends on Phase 2 complete (T005–T009 done — email_log table + BullMQ available)
- **Phase 4 (US2)**: Depends on Phase 3 complete (T012 worker must exist before T031 updates it)
- **Phase 5 (US3)**: Depends on Phase 2 complete (notifications table done); can overlap with Phase 4
- **Phase 6 (Polish)**: Depends on Phase 3, 4, 5 all complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2. No dependency on US2 or US3.
- **US2 (P2)**: Requires US1 (worker must exist for T031 to update it). Templates T023–T030 are all [P] and can be written in parallel.
- **US3 (P3)**: Requires Phase 2 (notifications table). Independent of US1/US2 except T035 (/me unread count) which can proceed once notifications.service.ts is done.

### Parallel Opportunities

- T002, T003, T004 (Phase 1) — all parallel
- T005, T006 (Phase 2) — schema additions to same file, write sequentially; T008, T009 sequential
- T023–T030 (US2 templates) — all [P], all different files, write in parallel
- T036–T039 (US3 domain triggers) — all [P], all different service files

---

## Notes

- All DB writes use `withTenantContext(facilityId, tx => ...)` (constitution §I)
- `superAdminDb` is used only in broadcast (cross-user inserts) and pruning — imported from `src/core/super-admin/` (constitution §I)
- Redis INCR/DECR for unread count — always has DB fallback (constitution §III)
- `enqueueEmail` falls back to synchronous nodemailer on Redis unavailability — never drops silently (research Decision 7)
- Worker uses same `redis` instance from `src/lib/redis.ts` — no second connection
- Template strict mode (`Handlebars.compile(src, { strict: true })`) means missing variables cause job failure, not broken emails
- Broadcast inserts in batches of 200 to avoid oversized transactions (spec edge case)
- Appointment reminder idempotency via BullMQ `jobId: 'reminder-{appointmentId}'` — re-running scan never duplicates

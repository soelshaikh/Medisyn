# Feature Specification: Async Email & Notification Infrastructure

**Feature Branch**: `007-async-email-notifications`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Phase 7 Async Infrastructure — BullMQ email queue, handlebars email templates, in-app notifications"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Async Email Delivery (Priority: P1)

When any platform event triggers an email (registration, order placed, appointment confirmed, prescription status changed), the email must be dispatched in the background without blocking the HTTP response. If delivery fails, the system retries automatically and records the outcome so admins can see what happened and retry stuck messages.

**Why this priority**: Every other feature that sends email (auth, orders, appointments, healthcare) is blocked on this. Synchronous email sends are a reliability risk — a slow email provider holds up the entire request. This is foundational infrastructure.

**Independent Test**: Can be tested by triggering a registration flow and confirming: (a) the HTTP response returns immediately, (b) the email arrives in the inbox within a few seconds, (c) an email log record exists with status "sent".

**Acceptance Scenarios**:

1. **Given** a patient registers, **When** the server processes the request, **Then** the HTTP response returns in under 200ms and a welcome email is delivered within 30 seconds.
2. **Given** a queued email job fails on first attempt, **When** the queue worker retries, **Then** the job is retried up to 3 times with exponential backoff before moving to the dead-letter queue.
3. **Given** a job reaches the dead-letter queue, **When** an admin views the email log, **Then** they see the failed job with the error message and can trigger a manual retry.
4. **Given** an admin searches the email log, **When** they filter by recipient or template name, **Then** they see paginated results with delivery status, timestamp, and error detail for each entry.
5. **Given** the email provider is temporarily unavailable, **When** a retry succeeds after recovery, **Then** the email log record is updated to "sent" with the actual send timestamp.

---

### User Story 2 — Branded Transactional Email Templates (Priority: P2)

Every automated email sent by the platform must use a consistent, branded HTML template rather than plain text. Each email type (welcome, verify email, password reset, order confirmation, appointment confirmation, etc.) has its own subject line and body layout with platform branding. The template content is maintainable without a code deploy.

**Why this priority**: Branded emails improve patient trust and reduce support tickets ("I got a plain-text email — is this phishing?"). Required before any patient-facing communication goes to production.

**Independent Test**: Can be tested by triggering each email type and confirming the received email matches the expected subject, contains platform branding (logo, colours, footer with unsubscribe link), and renders correctly in Gmail, Outlook, and Apple Mail.

**Acceptance Scenarios**:

1. **Given** a patient books an appointment, **When** the confirmation email is sent, **Then** the email uses the appointment-confirmed template with the correct date, time, service name, and pharmacy address.
2. **Given** a template uses dynamic data (patient name, order total), **When** the email is rendered, **Then** all placeholder values are substituted correctly and no raw placeholder tokens appear in the output.
3. **Given** a template file is updated on disk, **When** the next email using that template is sent, **Then** the new template content is used without a server restart.
4. **Given** a template rendering error occurs (missing required variable), **When** the worker processes the job, **Then** the job fails gracefully with a descriptive error in the log rather than sending a broken email.

---

### User Story 3 — In-App Notification Centre (Priority: P3)

Patients and staff see a notification bell in the platform UI showing a count of unread messages. Clicking it reveals a feed of platform events relevant to them — appointment confirmed, prescription ready, order shipped, pharmacist replied — with links to the relevant record. Users can mark notifications as read individually or all at once, and delete ones they no longer need.

**Why this priority**: Reduces reliance on email alone for time-sensitive updates. Patients who miss emails can still see status changes in the portal. Builds toward real-time updates in a later phase.

**Independent Test**: Can be tested by booking an appointment as a patient and confirming: (a) a notification appears in the feed immediately, (b) the unread count in the header increments, (c) marking it read decrements the count, (d) the notification links to the appointment detail page.

**Acceptance Scenarios**:

1. **Given** an appointment is booked, **When** the patient next loads the portal, **Then** a notification appears in their feed with the appointment date, service, and a link to the booking.
2. **Given** a patient has 5 unread notifications, **When** they click "mark all as read", **Then** the unread count drops to 0 and all items show as read.
3. **Given** a patient deletes a notification, **When** they refresh the feed, **Then** the deleted notification no longer appears.
4. **Given** an admin posts a broadcast notification, **When** the targeted patients load the portal, **Then** each targeted patient sees the broadcast message in their feed.
5. **Given** a patient has no notifications, **When** they open the notification centre, **Then** they see an empty state message rather than an error.

---

### Edge Cases

- What happens if the email provider returns a bounce or spam complaint? (Status recorded as "bounced"; no automatic retry for bounces.)
- What happens if Redis is unavailable when a job is enqueued? (Fall back to synchronous send attempt; log the outcome; do not silently drop the email.)
- What happens if a template file is missing at render time? (Job fails with `TEMPLATE_NOT_FOUND` error; moves to dead-letter queue; admin alerted via log.)
- What happens if a broadcast notification targets 10,000 patients? (Notifications are inserted in batches to avoid a single oversized DB transaction.)
- What happens if a patient's notification feed exceeds 1,000 entries? (Oldest read notifications are automatically pruned beyond the 1,000 threshold; unread notifications are never pruned.)
- What happens if the same domain event fires twice (e.g., duplicate appointment-booked event)? (Idempotency key on email jobs and notifications prevents duplicate delivery.)

## Requirements *(mandatory)*

### Functional Requirements

**Email Queue**

- **FR-001**: The system MUST dispatch all transactional email sends as background jobs rather than inline with the HTTP request, so that email provider latency does not affect API response time.
- **FR-002**: Each email job MUST be retried up to 3 times with exponential backoff (delays: 30s, 2m, 10m) before being moved to a dead-letter queue.
- **FR-003**: The system MUST maintain an email log that records: recipient address, template name, job ID, delivery status (queued / sent / failed / bounced), error message (if any), enqueue timestamp, and send timestamp.
- **FR-004**: Admins MUST be able to list email log entries with pagination and filtering by recipient, template, status, and date range.
- **FR-005**: Admins MUST be able to manually re-enqueue a failed or dead-lettered email job from the email log.
- **FR-006**: Each email job MUST carry an idempotency key derived from the triggering event to prevent duplicate sends if the same event is processed more than once.

**Email Templates**

- **FR-007**: The system MUST support the following transactional email templates: `welcome`, `verify-email`, `forgot-password`, `order-confirmation`, `prescription-status-changed`, `appointment-confirmed`, `appointment-reminder`, `ask-pharmacist-replied`.
- **FR-008**: Each template MUST produce a subject line and an HTML email body with platform branding (logo, primary colour, footer with pharmacy name and address).
- **FR-009**: Templates MUST support dynamic variable substitution (patient name, order number, appointment date, etc.) — raw placeholder tokens MUST NOT appear in sent emails.
- **FR-010**: Template files MUST be loadable at send time without a server restart, so content updates take effect immediately.
- **FR-011**: If a required template variable is missing at render time, the job MUST fail with a descriptive error (not send a broken email).

**In-App Notifications**

- **FR-012**: The system MUST create an in-app notification for a patient when any of the following events occur: appointment booked, prescription status changed, order status changed, ask-pharmacist reply received.
- **FR-013**: Each notification MUST include: type, title, body text, optional deep-link URL, read/unread status, and creation timestamp.
- **FR-014**: Patients MUST be able to retrieve their notifications in reverse-chronological order with pagination (default page size: 20).
- **FR-015**: Patients MUST be able to mark a single notification as read, mark all notifications as read, and delete a notification.
- **FR-016**: The authenticated `/me` endpoint (or equivalent auth response) MUST include the current unread notification count so the UI can display the badge without an extra request.
- **FR-017**: Admins MUST be able to send a broadcast notification to all patients, or to a specific list of user IDs, with a custom title and body.
- **FR-018**: Notification feeds MUST be scoped to the patient's own records — a patient MUST NOT be able to read another patient's notifications.
- **FR-019**: Read notifications older than 90 days MUST be automatically pruned when the total count exceeds 1,000 per user; unread notifications MUST NOT be pruned.

### Key Entities

- **EmailJob**: A background work item representing one email to be sent. Carries recipient, rendered subject, HTML/text body, template name, payload snapshot, idempotency key, retry count, and current status.
- **EmailLog**: A persistent audit record of every email job, updated as the job progresses (queued → sent / failed / bounced). Survives beyond the queue's own job storage.
- **EmailTemplate**: An on-disk template file (HTML + subject) parameterised with handlebars-style tokens. One file per email type. Not stored in the database — loaded from disk at render time.
- **Notification**: A per-user in-app message. Scoped to one facility and one user. Linked to the originating domain event (appointment, order, prescription, thread). Has read/unread state and soft-delete flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: API response time for operations that trigger emails (booking, registration, order placement) remains unchanged after the async queue is introduced — users experience no additional latency.
- **SC-002**: 99% of transactional emails are delivered to the recipient's inbox within 60 seconds of the triggering event under normal load.
- **SC-003**: Zero emails are silently dropped — every send attempt, whether successful or failed, has a corresponding email log record.
- **SC-004**: Failed email jobs are retried automatically; admin intervention is only needed for messages that exhaust all retries (dead-lettered).
- **SC-005**: Patients can view their notification feed, mark items read, and delete items — all actions complete in under 1 second.
- **SC-006**: Broadcast notifications reach all targeted patients within 30 seconds of admin submission, regardless of patient count.
- **SC-007**: No patient can access another patient's notifications — cross-user data leakage returns a 403 or empty result in 100% of attempts.

## Assumptions

- Redis is already available in the infrastructure (`src/lib/redis.ts`); BullMQ will reuse the same Redis connection for its queues.
- The email provider (Brevo, Resend, or SMTP via nodemailer) is configured in environment variables; the queue worker picks up the active provider at startup.
- Email templates are read from disk at job-processing time (not at enqueue time) so content can be updated between enqueue and delivery in high-latency retry scenarios. This is acceptable because the payload data is stored at enqueue time.
- Appointment reminder emails (24 hours before) are triggered by a scheduled job (cron-style) that runs once per hour and checks for appointments starting within the next 24–25 hours. Exact scheduling mechanism is an infrastructure concern resolved in the plan phase.
- Notification delivery is pull-based (REST polling from the client) in this phase. Real-time push via WebSockets or SSE is deferred to a later phase.
- The admin broadcast endpoint requires the `notifications:broadcast` permission.
- Notification pruning (FR-019) runs as part of a lightweight scheduled cleanup job, not inline with each notification insert.
- Email log retention: log records are kept for 90 days then archived/deleted. This is a platform-level data retention decision, not configurable per facility.
- The `appointment-reminder` email is idempotent per appointment: only one reminder is sent per appointment per patient, enforced by an idempotency key on the job.

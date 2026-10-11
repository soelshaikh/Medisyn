# Quickstart: Async Email & Notification Infrastructure

**Feature**: 007-async-email-notifications | **Date**: 2026-10-10

This guide validates Phase 7 end-to-end against a running backend. Complete all prerequisites before running scenarios.

---

## Prerequisites

1. PostgreSQL running with migration `0006_async_email_notifications.sql` applied:
   ```
   cd backend && npm run db:migrate
   ```

2. Redis running locally:
   ```
   redis-server  # or: docker run -p 6379:6379 redis:7-alpine
   ```

3. Backend running with worker enabled:
   ```
   cd backend && npm run dev
   ```
   Worker start-up log should include:
   ```
   [worker] email worker ready — listening on queue 'email'
   [worker] appointment-reminder-scan repeatable job registered (0 * * * *)
   ```

4. Environment variables required (in addition to existing vars):
   ```
   # No new required vars — EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD already in .env
   # Optionally add for Brevo HTTP API:
   # BREVO_API_KEY=your-api-key
   ```

5. Seed permissions (run once after migration):
   ```
   cd backend && npm run db:seed:permissions-p7
   ```
   Should output: `[seed] email_log:read, email_log:retry, notifications:broadcast created`

6. Auth token for requests: obtain a JWT via `POST /api/v1/auth/login` with the seeded admin account. Store as `$ADMIN_TOKEN`. Obtain a patient JWT as `$PATIENT_TOKEN`.

---

## Scenario 1: Async Email Enqueue on Registration

**Goal**: Confirm that a registration request returns immediately and a welcome email is enqueued.

```bash
# Register a new patient
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test-phase7@example.com","password":"Test@1234","firstName":"Test","lastName":"Phase7","facilitySlug":"downtown-pharmacy"}'
```

**Expected**:
- HTTP response returns in < 200ms
- Response body: `{ "success": true, "data": { "userId": "...", "message": "..." } }`

```bash
# Within 5 seconds, check email log
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/admin/email-log?recipient=test-phase7@example.com"
```

**Expected**:
- Returns 1 entry with `templateName: "verify-email"`, `status: "sent"` (or `"queued"` if < 5s)
- `subject` contains "Verify your email"
- `attemptCount`: 1, `durationMs` is set

---

## Scenario 2: Email Retry on Failure

**Goal**: Confirm the admin can retry a failed email job.

```bash
# Find a failed email log entry (or create one by temporarily breaking EMAIL_HOST)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/admin/email-log?status=failed&limit=1"
# Note the ID from the response

# Retry it
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/admin/email-log/{id}/retry"
```

**Expected**:
- Response: `{ "success": true, "data": { "status": "queued", "jobId": "..." } }`
- Re-querying the log entry within 30 seconds shows `status: "sent"` or updated `errorMessage` + `attemptCount: 1`

---

## Scenario 3: Email Template Rendering

**Goal**: Confirm each template produces the expected subject and branding.

Trigger each email type and inspect the received email (use a test inbox like Ethereal or Mailtrap):

| Template | Trigger Action | Expected Subject Contains |
|---|---|---|
| `verify-email` | Register new user | "Verify your email" |
| `forgot-password` | POST /auth/forgot-password | "Reset your password" |
| `welcome` | First login after verify | "Welcome to" |
| `order-confirmation` | Place an order | "Order confirmed" |
| `appointment-confirmed` | Book an appointment | "Appointment confirmed" |
| `ask-pharmacist-replied` | Admin replies to a thread | "Your pharmacist replied" |

**Expected for every template**:
- No raw `{{placeholder}}` tokens visible in email body
- Platform logo and footer present
- Correct dynamic values (patient name, relevant details) substituted

---

## Scenario 4: In-App Notification on Appointment Booking

**Goal**: Confirm a notification appears in the patient's feed after booking.

```bash
# Book an appointment as the patient
curl -X POST http://localhost:3001/api/v1/appointments \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slotId":"<valid-slot-uuid>","reason":"Annual flu shot"}'

# Check notification feed
curl -H "Authorization: Bearer $PATIENT_TOKEN" \
  "http://localhost:3001/api/v1/notifications"
```

**Expected**:
- Feed contains 1+ notifications
- First item: `type: "appointment_booked"`, `isRead: false`
- `actionUrl` points to `/patient/appointments/<appointment-id>`

---

## Scenario 5: Mark Read and Unread Count

**Goal**: Confirm unread count decrements when a notification is marked read.

```bash
# Get /me — note unreadNotificationCount
curl -H "Authorization: Bearer $PATIENT_TOKEN" \
  "http://localhost:3001/api/v1/auth/me"
# Note: "unreadNotificationCount": N (should be >= 1 after Scenario 4)

# Mark the notification from Scenario 4 as read
curl -X PATCH \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  "http://localhost:3001/api/v1/notifications/{id}/read"

# Re-check /me
curl -H "Authorization: Bearer $PATIENT_TOKEN" \
  "http://localhost:3001/api/v1/auth/me"
```

**Expected**:
- `unreadNotificationCount` decremented by 1
- Notification item now shows `isRead: true`, `readAt` is set

---

## Scenario 6: Admin Broadcast Notification

**Goal**: Confirm broadcast notifications reach targeted patients.

```bash
curl -X POST http://localhost:3001/api/v1/admin/notifications/broadcast \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Broadcast","body":"This is a Phase 7 validation broadcast.","actionUrl":null,"userIds":null}'
```

**Expected**:
- Response: `202 Accepted`, `recipientCount` > 0
- Patient's notification feed includes new item with `type: "broadcast"`, title "Test Broadcast"

---

## Scenario 7: Cross-User Notification Isolation

**Goal**: Confirm a patient cannot read another patient's notification.

```bash
# Get notification ID belonging to PATIENT_TOKEN user (from Scenario 4)
NOTIF_ID="<notification-id-from-scenario-4>"

# Attempt to read it with a DIFFERENT patient token
curl -X PATCH \
  -H "Authorization: Bearer $OTHER_PATIENT_TOKEN" \
  "http://localhost:3001/api/v1/notifications/$NOTIF_ID/read"
```

**Expected**:
- `403 FORBIDDEN` or `404 NOT_FOUND` — the other patient cannot read or modify a different user's notification

---

## Scenario 8: Appointment Reminder Email (Manual Trigger)

**Goal**: Confirm the reminder scan job enqueues reminder emails correctly.

```bash
# Create an appointment slot dated exactly 24 hours from now (use admin endpoints)
# Book a patient into that slot
# Manually trigger the appointment-reminder-scan job via BullMQ admin or a test endpoint:
curl -X POST http://localhost:3001/api/v1/admin/dev/trigger-reminder-scan \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# (This endpoint only exists in NODE_ENV=development)
```

**Expected**:
- `email_log` contains a new `appointment-reminder` entry for the booked patient
- The entry has `idempotency_key` matching `appointment-reminder:{appointment-id}`
- Running the scan again does NOT create a duplicate log entry (idempotency enforced)

# Contract: Email Log (Admin)

**Feature**: 007-async-email-notifications | **Base path**: `/api/v1/admin/email-log`

**Auth**: All endpoints require a valid JWT + `email_log:read` permission (list) or `email_log:retry` permission (retry).

---

## GET /api/v1/admin/email-log

List email log entries for the current facility, paginated and filterable.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | integer | No | Page number (default: 1, min: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `status` | string | No | Filter: `queued` \| `sent` \| `failed` \| `bounced` |
| `recipient` | string | No | Partial case-insensitive match on recipient email |
| `template` | string | No | Exact match on `template_name` |
| `from` | ISO 8601 date | No | Filter entries created on or after this date |
| `to` | ISO 8601 date | No | Filter entries created before or on this date |

### Success Response `200`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "idempotencyKey": "verify-email:user-uuid:1728553200",
        "jobId": "bullmq-job-id-or-null",
        "recipient": "patient@example.com",
        "templateName": "verify-email",
        "subject": "Verify your email — Downtown Pharmacy",
        "status": "sent",
        "errorMessage": null,
        "attemptCount": 1,
        "enqueuedAt": "2026-10-10T14:00:00.000Z",
        "sentAt": "2026-10-10T14:00:03.412Z",
        "durationMs": 412,
        "createdAt": "2026-10-10T14:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 143,
      "totalPages": 8
    }
  }
}
```

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid JWT |
| 403 | `FORBIDDEN` | Missing `email_log:read` permission |
| 422 | `VALIDATION_ERROR` | Invalid query param values |

---

## POST /api/v1/admin/email-log/:id/retry

Re-enqueue a failed or bounced email job. Resets the log entry to `queued`, clears `errorMessage`, zeroes `attemptCount`, and inserts a new BullMQ job using the original idempotency key suffixed with `-retry-{timestamp}` (so it isn't deduplicated against the original failed job).

**Permission required**: `email_log:retry`

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | uuid | Email log entry ID |

### Request Body

None.

### Success Response `200`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "queued",
    "jobId": "new-bullmq-job-id",
    "enqueuedAt": "2026-10-10T15:30:00.000Z"
  }
}
```

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 400 | `CANNOT_RETRY` | Status is not `failed` or `bounced` |
| 401 | `UNAUTHORIZED` | No valid JWT |
| 403 | `FORBIDDEN` | Missing `email_log:retry` permission |
| 404 | `NOT_FOUND` | Log entry not found in this facility |

---

## Permissions Required (new, add to seeds)

| Permission Key | Description |
|---|---|
| `email_log:read` | View email delivery log |
| `email_log:retry` | Re-enqueue a failed email job |

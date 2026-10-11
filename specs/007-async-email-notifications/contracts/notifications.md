# Contract: Notifications

**Feature**: 007-async-email-notifications | **Base path**: `/api/v1/notifications`

**Auth**: All patient endpoints require a valid JWT. Admin broadcast endpoint requires `notifications:broadcast` permission.

---

## GET /api/v1/notifications

Retrieve the authenticated patient's notification feed, newest first. Excludes soft-deleted notifications.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | integer | No | Page number (default: 1, min: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 50) |
| `unreadOnly` | boolean | No | If `true`, return only unread notifications |

### Success Response `200`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "appointment_booked",
        "title": "Appointment confirmed",
        "body": "Your flu shot appointment is confirmed for Oct 15 at 10:00 AM.",
        "actionUrl": "/patient/appointments/appt-uuid",
        "isRead": false,
        "readAt": null,
        "createdAt": "2026-10-10T14:00:00.000Z"
      }
    ],
    "unreadCount": 3,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid JWT |
| 403 | `FORBIDDEN` | Non-patient role attempting to use patient endpoint |

---

## PATCH /api/v1/notifications/:id/read

Mark a single notification as read. Idempotent — marking an already-read notification returns 200 without error.

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | uuid | Notification ID |

### Request Body

None.

### Success Response `200`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isRead": true,
    "readAt": "2026-10-10T14:30:00.000Z"
  }
}
```

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid JWT |
| 403 | `FORBIDDEN` | Notification belongs to a different user |
| 404 | `NOT_FOUND` | Notification not found or soft-deleted |

---

## POST /api/v1/notifications/read-all

Mark all unread notifications for the authenticated patient as read. Returns the number of notifications updated.

### Request Body

None.

### Success Response `200`

```json
{
  "success": true,
  "data": {
    "updatedCount": 5
  }
}
```

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid JWT |

---

## DELETE /api/v1/notifications/:id

Soft-delete a notification. The notification is excluded from all future API responses but remains in the database for 90 days.

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | uuid | Notification ID |

### Success Response `200`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deleted": true
  }
}
```

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid JWT |
| 403 | `FORBIDDEN` | Notification belongs to a different user |
| 404 | `NOT_FOUND` | Notification not found or already deleted |

---

## POST /api/v1/admin/notifications/broadcast

Send a broadcast notification to all patients in the facility, or to a specific list of user IDs.

**Permission required**: `notifications:broadcast`

### Request Body

```json
{
  "title": "Pharmacy closure notice",
  "body": "Our pharmacy will be closed on October 14 for Thanksgiving. Happy holidays!",
  "actionUrl": null,
  "userIds": null
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | YES | Notification title. Max 120 chars. |
| `body` | string | YES | Notification body text. Max 500 chars. |
| `actionUrl` | string \| null | No | Optional deep-link URL. Max 2000 chars. |
| `userIds` | string[] \| null | No | If null or omitted, broadcast to all active patients. If array, send only to specified user IDs. Max 500 user IDs per request. |

### Success Response `202`

```json
{
  "success": true,
  "data": {
    "recipientCount": 847,
    "broadcastId": "uuid",
    "enqueuedAt": "2026-10-10T15:00:00.000Z"
  }
}
```

*Note*: `202 Accepted` — notifications are inserted in batches asynchronously. `recipientCount` is the count of targeted users, not a confirmation of delivery.

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `userIds` exceeds 500 entries, or title/body length violations |
| 401 | `UNAUTHORIZED` | No valid JWT |
| 403 | `FORBIDDEN` | Missing `notifications:broadcast` permission |

---

## Permissions Required (new, add to seeds)

| Permission Key | Description |
|---|---|
| `notifications:broadcast` | Send broadcast notification to patients |

---

## Unread Count in /me Response

The existing `GET /api/v1/auth/me` (or equivalent) response is extended with:

```json
{
  "...existing fields...",
  "unreadNotificationCount": 3
}
```

- Sourced from Redis cache (`notifications:unread:{userId}:{facilityId}`) with DB fallback.
- Only present when the authenticated user is a patient. Admin/staff roles receive `unreadNotificationCount: 0`.
- If the user has no facility context (super admin), the field is omitted.

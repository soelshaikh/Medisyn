# Contract: Auth API Endpoints (Consumed by Admin Panel)

**Feature**: Admin Panel Scaffold (`specs/011-admin-panel-scaffold`)
**Date**: 2026-10-11
**Base URL**: `${NEXT_PUBLIC_API_URL}/api/v1/auth`

These are the backend Express API endpoints consumed by the admin panel. The admin panel is the **client** — it does not own these contracts. The backend is the source of truth.

---

## POST /api/v1/auth/super-admin/login

**Purpose**: Authenticate a platform super-admin. Returns JWT access token + user profile. Sets a refresh token as an httpOnly cookie.

**Request**:
```
POST /api/v1/auth/super-admin/login
Content-Type: application/json

{
  "email": "admin@medisyn.ca",
  "password": "••••••••"
}
```

**Success Response** `200 OK`:
```json
{
  "data": {
    "accessToken": "<jwt-string>",
    "user": {
      "id": "uuid",
      "email": "admin@medisyn.ca",
      "firstName": "Soel",
      "lastName": "Shaikh"
    }
  }
}
```
Also sets: `Set-Cookie: refresh_token=<hex>; HttpOnly; SameSite=Lax; Path=/api/v1/auth; MaxAge=2592000`

**Error Responses**:

| Status | Code | When |
|--------|------|------|
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `EMAIL_NOT_VERIFIED` | Email address not verified |
| 422 | `VALIDATION_ERROR` | Missing email or password field |

**Admin panel behaviour on error**: Display `error.message` from the response body on the login form. Keep the user on `/login`.

---

## POST /api/v1/auth/logout

**Purpose**: Revoke the current session. Clears the refresh token cookie.

**Request**:
```
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```
(No request body)

**Success Response** `200 OK`:
```json
{
  "data": {
    "message": "Logged out successfully."
  }
}
```
Also sets: `Set-Cookie: refresh_token=; HttpOnly; ...; MaxAge=0` (clears the cookie)

**Error Responses**:

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHORIZED` | Missing or invalid access token |

**Admin panel behaviour**: Call this on logout button click. Whether it succeeds or fails, clear the Zustand auth store and redirect to `/login`. (Fire-and-forget from the UX perspective — we can't leave the user stuck if the backend is down.)

---

## GET /api/v1/auth/me

**Purpose**: Fetch the authenticated user's current profile. Used to refresh the in-memory user object.

**Request**:
```
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

**Success Response** `200 OK`:
```json
{
  "data": {
    "id": "uuid",
    "email": "admin@medisyn.ca",
    "firstName": "Soel",
    "lastName": "Shaikh",
    "emailVerified": true,
    "role": "super_admin",
    "facilityId": null,
    "unreadCount": 0
  }
}
```

**Error Responses**:

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHORIZED` | Token missing, expired, or revoked |

**Admin panel behaviour**: Queried on app load via `useCurrentUser` TanStack Query hook. If 401 is returned, the Axios response interceptor clears the auth store, triggering the route guard redirect.

---

## POST /api/v1/auth/refresh

**Purpose**: Exchange the refresh token cookie for a new access token. Used when the access token has expired.

**Request**:
```
POST /api/v1/auth/refresh
Authorization: Bearer <expiredAccessToken>
```
Refresh token is sent automatically as an httpOnly cookie (no manual handling needed by the frontend).

**Success Response** `200 OK`:
```json
{
  "data": {
    "accessToken": "<new-jwt-string>"
  }
}
```

**Error Responses**:

| Status | Code | When |
|--------|------|------|
| 401 | `REFRESH_TOKEN_MISSING` | Cookie not present |
| 401 | `REFRESH_TOKEN_INVALID` | Cookie invalid or session mismatch |
| 401 | `REFRESH_TOKEN_EXPIRED` | Refresh token has expired (30 days) |

**Admin panel behaviour**: **Out of scope for this phase.** When the access token expires, the user is redirected to `/login`. Silent refresh is a Phase 10 hardening task.

---

## Error Response Shape (All Endpoints)

The backend returns errors in a consistent envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

The `apiClient` Axios instance normalizes error responses: on non-2xx, it throws an `Error` with `message` populated from `response.data.error.message` (or a fallback generic message if the shape is unexpected).

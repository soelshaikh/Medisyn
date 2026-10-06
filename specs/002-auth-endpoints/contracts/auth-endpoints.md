# API Contract: Auth Endpoints (002)

**Base path**: `/api/v1/auth`
**Content-Type**: `application/json` for all requests and responses
**Auth middleware chain**: Public endpoints bypass the chain entirely. Protected endpoints use `authMiddleware` from Phase 1 (`[parseJWT, checkSession, verifyAuthVersion, checkFacilityStatus]`).

---

## Shared Response Shapes

### Success (2xx)
```json
{ "data": { ... } }
```

### Error (4xx / 5xx)
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "uuid"
  }
}
```

### Error Codes Used in Phase 2

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 422 | Request body failed schema validation |
| `EMAIL_IN_USE` | 409 | Email already registered at this facility |
| `ACCOUNT_EXISTS_LOGIN` | 409 | Email exists on platform but password incorrect — tell user to log in |
| `FACILITY_NOT_FOUND` | 404 | Facility slug unknown |
| `FACILITY_INACTIVE` | 403 | Facility is suspended or deactivated |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (same message for both — no enumeration) |
| `ACCOUNT_INACTIVE` | 403 | facilityUser.isActive = false |
| `AUTH_MISSING` | 401 | No Authorization header (protected routes) |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired (protected routes) |
| `SESSION_REVOKED` | 401 | Session was revoked |
| `REFRESH_TOKEN_MISSING` | 401 | No refresh_token cookie on /auth/refresh |
| `REFRESH_TOKEN_INVALID` | 401 | Token not found or hash mismatch |
| `REFRESH_TOKEN_EXPIRED` | 401 | Session expiresAt < now |
| `REFRESH_TOKEN_REUSE` | 401 | Rotated token reused — all sessions revoked |
| `RESET_TOKEN_INVALID` | 400 | Password reset token not found or expired |
| `VERIFY_TOKEN_INVALID` | 400 | Email verification token not found or expired |
| `SERVICE_UNAVAILABLE` | 503 | Redis + DB both unavailable (fail-closed) |

---

## Endpoints

---

### POST /api/v1/auth/register

Register a new patient at a facility.
**Auth**: Public (no middleware chain)

**Request Body**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "min8chars",
  "facilitySlug": "pharmacy-downtown"
}
```

**Validation**
- `firstName`: string, 1–100 chars, required
- `lastName`: string, 1–100 chars, required
- `email`: valid email format, max 255 chars, required
- `password`: string, 8–128 chars, required
- `facilitySlug`: string, pattern `[a-z0-9-]+`, max 100 chars, required

**Success Response — 201 Created**
```json
{
  "data": {
    "message": "Registration successful. Please check your email to verify your account.",
    "userId": "uuid"
  }
}
```

**Error Responses**

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` 422 | Any field fails validation |
| `FACILITY_NOT_FOUND` 404 | `facilitySlug` not found |
| `FACILITY_INACTIVE` 403 | Facility status is `suspended` or `deactivated` |
| `EMAIL_IN_USE` 409 | Email already registered at this facility |
| `ACCOUNT_EXISTS_LOGIN` 409 | Email exists globally; password did not match existing account |

**Side effects**
- Creates `users` row (if new) or links existing user to facility
- Creates `facility_roles` `patient` row via `ON CONFLICT DO NOTHING`
- Creates `facilityUsers` row
- Writes `emailVerifyToken` + `emailVerifyExpiresAt` (24h TTL) to users
- Dispatches verification email
- Writes `auth.register` to `auditLog`

---

### POST /api/v1/auth/login

Authenticate a user and issue tokens.
**Auth**: Public (no middleware chain)

**Request Body**
```json
{
  "email": "jane@example.com",
  "password": "min8chars",
  "facilitySlug": "pharmacy-downtown"
}
```

`facilitySlug` is optional for platform super-admins (identified by `users.isPlatformSuperAdmin = true`). If omitted for a regular user, returns `VALIDATION_ERROR`.

**Validation**
- `email`: valid email, required
- `password`: string, 1–128 chars, required
- `facilitySlug`: string, optional (required for non-super-admins)

**Success Response — 200 OK**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "uuid",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "emailVerified": true,
      "role": "patient",
      "facilityId": "uuid-or-null"
    }
  }
}
```

**Set-Cookie header (on success)**
```
Set-Cookie: refresh_token=<hex64>; HttpOnly; SameSite=Lax; Secure; Path=/api/v1/auth; Max-Age=2592000
```
(Path restricted to `/api/v1/auth` so the cookie is not sent on every API request)

**JWT Claims (accessToken payload)**
```json
{
  "sub": "userId",
  "sessionId": "uuid",
  "facilityId": "uuid-or-null",
  "authVersion": 1,
  "role": "patient",
  "isSuperAdmin": false,
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Error Responses**

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` 422 | Any field fails validation |
| `FACILITY_NOT_FOUND` 404 | `facilitySlug` not found (when provided) |
| `FACILITY_INACTIVE` 403 | Facility suspended or deactivated |
| `INVALID_CREDENTIALS` 401 | Email not found OR wrong password (same response, no enumeration) |
| `ACCOUNT_INACTIVE` 403 | `facilityUsers.isActive = false` |

**Side effects**
- Creates `sessions` row
- Writes `users.lastLoginAt`
- Writes `auth.login` to `auditLog` (on success)
- Writes `auth.login_failed` to `auditLog` (on INVALID_CREDENTIALS)

---

### POST /api/v1/auth/refresh

Exchange a refresh token cookie for new tokens (rotation).
**Auth**: Public (reads HttpOnly cookie; no Bearer auth required)

**Request Body**: Empty `{}`

**Cookie required**: `refresh_token` (HttpOnly)

**Success Response — 200 OK**
```json
{
  "data": {
    "accessToken": "eyJ..."
  }
}
```

**Set-Cookie header (on success)**: New `refresh_token` cookie (same attributes, 30-day TTL reset)

**Error Responses**

| Code | Condition |
|------|-----------|
| `REFRESH_TOKEN_MISSING` 401 | `refresh_token` cookie absent |
| `REFRESH_TOKEN_INVALID` 401 | Token hash does not match any active session |
| `REFRESH_TOKEN_EXPIRED` 401 | `sessions.expiresAt` < now |
| `SESSION_REVOKED` 401 | `sessions.revokedAt` is not null |
| `REFRESH_TOKEN_REUSE` 401 | Token hash matched a revoked session (theft detected — all user sessions revoked) |

**Side effects**
- Updates `sessions.refreshTokenHash` (new hash), `sessions.lastUsedAt`
- Writes `auth.token_refresh` to `auditLog`
- On theft detection: revokes all user sessions + writes `auth.logout_all` with `{ reason: 'theft_detected' }` to `auditLog`

---

### POST /api/v1/auth/logout

Revoke the current session.
**Auth**: Protected (full `authMiddleware` chain)

**Request Body**: Empty `{}`

**Success Response — 200 OK**
```json
{ "data": { "message": "Logged out successfully." } }
```

**Set-Cookie header**: Clears `refresh_token` cookie (`Max-Age=0`)

**Side effects**
- Sets `sessions.revokedAt`, `sessions.revokedReason = 'user_logout'`
- Writes `revoked_session:{sessionId}` to Redis (30-day TTL)
- Writes `auth.logout` to `auditLog`
- `users.authVersion` is NOT incremented

---

### POST /api/v1/auth/logout-all

Revoke all sessions for the authenticated user.
**Auth**: Protected (full `authMiddleware` chain)

**Request Body**: Empty `{}`

**Success Response — 200 OK**
```json
{ "data": { "message": "All sessions terminated." } }
```

**Set-Cookie header**: Clears `refresh_token` cookie (`Max-Age=0`)

**Side effects**
- Sets `revokedAt`, `revokedReason = 'user_logout'` on ALL non-revoked sessions for this user
- Writes `revoked_session:{id}` to Redis for each session
- Increments `users.authVersion` by 1
- Writes `auth.logout_all` to `auditLog`

---

### POST /api/v1/auth/forgot-password

Request a password reset link.
**Auth**: Public

**Request Body**
```json
{ "email": "jane@example.com" }
```

**Success Response — 200 OK**
```json
{
  "data": {
    "message": "If that email address is registered, you will receive a reset link shortly."
  }
}
```
*(Same response regardless of whether email exists — FR-015)*

**Error Responses**

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` 422 | `email` is not a valid email format |

**Side effects** (only when email exists in `users`)
- Writes `passwordResetToken` (UUID v4) + `passwordResetExpiresAt` (now + 30min) to `users`
- Dispatches password reset email
- Writes `auth.password_reset_request` to `auditLog`

---

### POST /api/v1/auth/reset-password

Complete a password reset using the token from email.
**Auth**: Public

**Request Body**
```json
{
  "token": "uuid-v4-reset-token",
  "password": "newpassword123"
}
```

**Validation**
- `token`: string, required
- `password`: string, 8–128 chars, required

**Success Response — 200 OK**
```json
{ "data": { "message": "Password updated. Please log in with your new password." } }
```

**Error Responses**

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` 422 | `password` fails length requirement |
| `RESET_TOKEN_INVALID` 400 | Token not found OR `passwordResetExpiresAt` < now |

**Side effects** (on success)
- Updates `users.passwordHash` (argon2 hash of new password)
- Increments `users.authVersion` by 1
- Clears `users.passwordResetToken` + `passwordResetExpiresAt`
- Revokes all user sessions (DB + Redis) with `revokedReason = 'password_changed'`
- Writes `auth.password_reset_complete` to `auditLog`

---

### POST /api/v1/auth/verify-email

Verify email address using token from verification email.
**Auth**: Public

**Request Body**
```json
{ "token": "uuid-v4-verify-token" }
```

**Success Response — 200 OK**
```json
{ "data": { "message": "Email verified successfully." } }
```

**Error Responses**

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` 422 | `token` is missing |
| `VERIFY_TOKEN_INVALID` 400 | Token not found OR `emailVerifyExpiresAt` < now |

**Side effects** (on success)
- Sets `users.emailVerified = true`
- Clears `users.emailVerifyToken` + `emailVerifyExpiresAt`
- Writes `auth.email_verify` to `auditLog`

---

### POST /api/v1/auth/resend-verification

Resend email verification link.
**Auth**: Public

**Request Body**
```json
{ "email": "jane@example.com" }
```

**Success Response — 200 OK**
```json
{
  "data": {
    "message": "If that email has an unverified account, a new verification link has been sent."
  }
}
```
*(Same response regardless of account state — no enumeration)*

**Error Responses**

| Code | Condition |
|------|-----------|
| `VALIDATION_ERROR` 422 | `email` is not valid format |

**Side effects** (only when email exists AND `emailVerified = false`)
- Overwrites `users.emailVerifyToken` (UUID v4) + `emailVerifyExpiresAt` (now + 24h)
- Dispatches new verification email
- Writes `auth.email_verify_resend` to `auditLog`

---

## Module / Permission Gates

Auth endpoints are public infrastructure — they are exempt from `requireModule` and `requirePermission` middleware. No subscription plan or permission is required to register, log in, or reset a password.

The `checkFacilityStatus` check applies only to login (a suspended facility's users cannot log in). Registration also validates facility status independently (before session creation).

# Data Model: Auth Endpoints (002)

Phase 2 introduces **no new database tables**. All entities are part of the Phase 1 schema (`backend/src/db/schema/`). This document describes how each existing entity is used, which fields are mutated by which endpoint, and the state transitions for auth flows.

---

## Entities Used

### `users` (`src/db/schema/core.ts`)

The global user record. One row per platform user, shared across facilities.

| Field | Phase 2 usage |
|-------|---------------|
| `id` | PK, referenced in sessions and facilityUsers |
| `email` | Registration: UNIQUE CHECK before insert; login: lookup key |
| `passwordHash` | Registration: argon2.hash(password); login: argon2.verify; cross-pharmacy: argon2.verify |
| `firstName`, `lastName` | Registration: write |
| `isPlatformSuperAdmin` | Login: read → included in JWT `isSuperAdmin` claim |
| `authVersion` | Login: read → included in JWT; logout-all + password-reset: INCREMENT by 1 |
| `emailVerified` | Login: read → included in response; verify-email: set to `true` |
| `emailVerifyToken` | Registration + resend-verification: write UUID v4; verify-email: read + clear |
| `emailVerifyExpiresAt` | Registration + resend-verification: write (now + 24h); verify-email: check + clear |
| `passwordResetToken` | Forgot-password: write UUID v4; reset-password: read + clear |
| `passwordResetExpiresAt` | Forgot-password: write (now + 30min); reset-password: check + clear |
| `lastLoginAt` | Login: write (current timestamp) |

**Constraints enforced by Phase 2**:
- Email must be unique globally (handled by `UNIQUE` on `users.email`; cross-pharmacy linking is application-layer logic, not a DB constraint)
- Password: minimum 8 characters validated in request handler before any DB access

**RLS**: `users` is a platform-global table — no RLS. Queried via `superAdminDb` (cross-facility lookups) or via `withTenantContext` when accessed in a facility context.

---

### `sessions` (`src/db/schema/core.ts`)

One row per active login session.

| Field | Phase 2 usage |
|-------|---------------|
| `id` | PK, included in JWT `sessionId` claim |
| `userId` | FK → users; written on login |
| `facilityId` | Written on login (null for platform super-admins) |
| `refreshTokenHash` | Login: argon2.hash(rawToken); refresh: argon2.verify then replace |
| `userAgent` | Login: write from `req.headers['user-agent']` |
| `ipAddress` | Login: write from `req.ip` |
| `revokedAt` | Logout / logout-all / password-reset / refresh-theft: write current timestamp |
| `revokedReason` | Logout: `'user_logout'`; logout-all: `'user_logout'`; password-reset: `'password_changed'`; theft: `'admin_revoked'` |
| `expiresAt` | Login: write (now + 30 days) |
| `lastUsedAt` | Refresh: write current timestamp |

**State machine for a session**:

```
CREATED (login)
  │
  ├─→ ACTIVE (lastUsedAt updated on each refresh)
  │
  ├─→ REVOKED_USER_LOGOUT    (single/all logout)
  ├─→ REVOKED_PASSWORD_RESET (password reset complete)
  ├─→ REVOKED_THEFT          (refresh token reuse detected)
  └─→ EXPIRED                (expiresAt < now, passive, not written)
```

**RLS**: `sessions` is facility-scoped (RLS enabled). Accessed via `superAdminDb` in auth middleware (Phase 1) and for revocation. New session creation uses `superAdminDb` (since `facilityId` may be null for super-admins and the insert must succeed regardless of tenant context).

---

### `facilityUsers` (`src/db/schema/rbac.ts`)

Links a user to a facility with a role. One row per user-facility membership.

| Field | Phase 2 usage |
|-------|---------------|
| `id` | PK |
| `facilityId` | Registration: written; login: read (to get roleId for JWT) |
| `userId` | Registration: written |
| `roleId` | Registration: written (ID of the "patient" system role) |
| `isActive` | Login: read (inactive users cannot log in) |
| `joinedAt` | Registration: written (now) |

**UNIQUE constraint**: `(facilityId, userId)` — prevents duplicate membership. Cross-pharmacy linking creates a second row with the same `userId` but different `facilityId`.

**RLS**: facility-scoped (RLS enabled). All `facilityUsers` operations in Phase 2 execute inside `withTenantContext(facilityId)`.

---

### `facilityRoles` (`src/db/schema/rbac.ts`)

Roles that exist within a facility. System roles (`isSystemRole=true`) are created by the platform.

| Field | Phase 2 usage |
|-------|---------------|
| `id` | PK, stored in `facilityUsers.roleId` |
| `facilityId` | Registration: written on lazy creation |
| `name` | Registration: `'patient'` (system role) |
| `isSystemRole` | Registration: `true` |

**Lazy creation**: Registration endpoint inserts `{ facilityId, name: 'patient', isSystemRole: true }` with `ON CONFLICT (facilityId, name) DO NOTHING`, then reads back the ID.

**RLS**: facility-scoped (RLS enabled). Executed inside `withTenantContext(facilityId)`.

---

### `facilities` (`src/db/schema/core.ts`)

The pharmacy. Read-only in Phase 2.

| Field | Phase 2 usage |
|-------|---------------|
| `id` | PK; looked up by `slug` on registration; used as `facilityId` in session |
| `slug` | Registration: input field to identify the target pharmacy |
| `status` | Registration: must be `'active'`; login: checked by `checkFacilityStatus` middleware (Phase 1) |
| `subscriptionPlanId` | Read by `requireModule` middleware (Phase 1) |

**RLS**: No RLS on `facilities` (platform-global table). Queried via `superAdminDb`.

---

### `auditLog` (`src/db/schema/audit.ts`)

Append-only audit record. Phase 2 writes one row per auth event.

| `action` value | Trigger |
|----------------|---------|
| `auth.register` | Successful registration |
| `auth.login` | Successful login |
| `auth.login_failed` | Failed login attempt (wrong password or email not found) |
| `auth.token_refresh` | Successful token refresh |
| `auth.logout` | Single session logout |
| `auth.logout_all` | All-sessions logout |
| `auth.password_reset_request` | Forgot-password request received |
| `auth.password_reset_complete` | Password reset successfully completed |
| `auth.email_verify` | Email successfully verified |
| `auth.email_verify_resend` | Verification email resent |

`actorId` = userId (null for failed login if email not found).
`facilityId` = facility's id (null for platform super-admin actions).
`metadata` = `{ ipAddress, userAgent }` at minimum; login failures also include `{ reason }`.

---

## Token Lifecycle

```
REGISTRATION
  ├─→ emailVerifyToken (UUID v4, 24h TTL) written to users
  └─→ verification email dispatched

LOGIN
  ├─→ session row created (refreshTokenHash stored)
  ├─→ refreshToken (raw, 64-char hex) → HttpOnly cookie
  └─→ accessToken (JWT, 15min) → JSON response body

TOKEN REFRESH
  ├─→ old session.refreshTokenHash verified
  ├─→ old session updated: new refreshTokenHash, lastUsedAt
  └─→ new accessToken + new refreshToken issued

LOGOUT (single)
  ├─→ session.revokedAt set
  ├─→ Redis key revoked_session:{sessionId} set (30d TTL)
  └─→ refresh_token cookie cleared

LOGOUT-ALL
  ├─→ all user sessions revokedAt set
  ├─→ Redis keys set for all sessions
  ├─→ users.authVersion incremented
  └─→ refresh_token cookie cleared

PASSWORD RESET COMPLETE
  ├─→ users.passwordHash updated
  ├─→ users.authVersion incremented
  ├─→ users.passwordResetToken + expiresAt cleared
  └─→ all sessions revoked (DB + Redis)

EMAIL VERIFY
  ├─→ users.emailVerified = true
  └─→ users.emailVerifyToken + expiresAt cleared
```

---

## Validation Rules (enforced at request layer, before DB access)

| Field | Rule |
|-------|------|
| `email` | Valid email format (RFC 5322 basic), max 255 chars |
| `password` | Min 8 chars, max 128 chars |
| `firstName`, `lastName` | Non-empty string, max 100 chars each |
| `facilitySlug` | Non-empty string, pattern `[a-z0-9-]+`, max 100 chars |
| `token` (verify/reset) | Non-empty string (UUID v4 format) |

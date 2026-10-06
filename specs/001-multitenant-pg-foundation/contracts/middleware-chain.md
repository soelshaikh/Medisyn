# Contract: Authentication Middleware Chain

**Feature**: `001-multitenant-pg-foundation`

This document defines the contract for the 7-step authentication middleware pipeline that
runs before every authenticated route handler. The contract specifies inputs, outputs,
failure modes, and ordering guarantees. Implementation details (class names, file paths)
live in the plan and tasks — this document specifies behaviour only.

---

## Chain Overview

```
Request
  │
  ▼
[0] Express router mounts middleware chain on protected routes
  │
  ▼
[1] parseJWT          — parse and verify JWT signature + expiry
  │
  ▼
[2] checkSessionRevocation  — confirm session is not revoked
  │
  ▼
[3] verifyAuthVersion      — confirm JWT authVersion matches DB
  │
  ▼
[4] checkFacilityStatus    — confirm facility is active
  │
  ▼
[5] requireModule          — confirm module is enabled for facility
  │
  ▼
[6] requirePermission      — confirm user role has required permission
  │
  ▼
[7] (optional) checkFeatureFlag — per-route feature flag gate
  │
  ▼
Route handler — opens withTenantContext()
```

**Ordering guarantee**: Steps execute in this exact order. No step may run before its
predecessors complete. No step may be skipped.

**Phase 1 scope**: Step [1] is fully implemented (JWT parse + expiry). Steps [2]–[7]
are scaffolded as typed stubs (call next() unconditionally) to establish the chain
shape. Steps [2]–[7] are filled in Phase 2.

---

## Step 1: parseJWT

**Purpose**: Extract and verify the JWT from the Authorization header.

**Input**: HTTP request with `Authorization: Bearer <token>` header.

**Behaviour**:
- Extract token from header.
- Verify signature using the platform JWT secret.
- Check token expiry (`exp` claim).
- Extract claims: `sub` (userId), `sessionId`, `facilityId`, `authVersion`, `iat`, `role`.

**Output on success**: Attaches `req.auth` to the request object:
```typescript
interface AuthContext {
  userId: string;
  sessionId: string;
  facilityId: string | null;  // null for super admin sessions
  authVersion: number;
  role: string;
  isSuperAdmin: boolean;
}
```

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| No Authorization header | 401 | `AUTH_MISSING` |
| Malformed Bearer prefix | 401 | `AUTH_MALFORMED` |
| Invalid JWT signature | 401 | `AUTH_INVALID_TOKEN` |
| JWT expired | 401 | `AUTH_TOKEN_EXPIRED` |
| Missing required claims | 401 | `AUTH_INVALID_TOKEN` |

---

## Step 2: checkSessionRevocation

**Purpose**: Confirm the session identified in the JWT has not been revoked.

**Input**: `req.auth.sessionId` (set by step 1).

**Fallback chain** (fail-closed):
1. Check Redis key `revoked_session:{sessionId}` — if key exists → 401.
2. If Redis unavailable → query `sessions` table WHERE `id = sessionId AND revoked_at IS NULL`.
3. If both unavailable → 503.

**Output on success**: `req.auth` is unchanged; pipeline continues.

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| Session found in Redis revocation set | 401 | `SESSION_REVOKED` |
| Session row not found or `revoked_at` set | 401 | `SESSION_REVOKED` |
| Redis + DB both unavailable | 503 | `SERVICE_UNAVAILABLE` |

---

## Step 3: verifyAuthVersion

**Purpose**: Confirm the JWT's `authVersion` claim matches the current auth version for
the user. Guards against stale tokens after role/permission changes.

**Input**: `req.auth.userId`, `req.auth.authVersion`.

**Fallback chain** (fail-closed):
1. Check Redis key `auth_version:{userId}` (TTL: 60s) — if value matches JWT `authVersion` → pass.
2. If Redis miss → query `users.auth_version` WHERE `id = userId`.
3. If Redis unavailable (error, not miss) → fall back to DB directly.
4. If both unavailable → 503.
5. If DB value > JWT `authVersion` → 401 (permissions changed; user must re-authenticate).

**Output on success**: `req.auth` is unchanged; pipeline continues.

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| DB auth_version > JWT authVersion | 401 | `AUTH_VERSION_STALE` |
| Redis + DB both unavailable | 503 | `SERVICE_UNAVAILABLE` |

---

## Step 4: checkFacilityStatus

**Purpose**: Confirm the facility the session is scoped to is `active`.

**Input**: `req.auth.facilityId` (NULL for super admin sessions — skip this step).

**Behaviour**:
- If `facilityId` is null (super admin) → skip, call next().
- Query `facilities.status` WHERE `id = facilityId`.
- If status = `active` → pass.
- If status = `suspended` → 403.
- If status = `deactivated` → 403.

**Output on success**: `req.auth` is unchanged; pipeline continues.

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| Facility not found | 403 | `FACILITY_NOT_FOUND` |
| Facility suspended | 403 | `FACILITY_SUSPENDED` |
| Facility deactivated | 403 | `FACILITY_DEACTIVATED` |

---

## Step 5: requireModule(moduleKey)

**Purpose**: Confirm the facility's active subscription includes the requested module.

**Input**: `req.auth.facilityId`, route-level `moduleKey` argument.

**Lookup order**:
1. Check `facility_module_overrides` for `(facilityId, moduleKey)` — if override exists,
   use its `enabled` value (true = force-add; false = force-remove).
2. If no override, check `plan_modules` JOIN `subscription_plans` WHERE
   `facility.subscription_plan_id = plan_id AND module.key = moduleKey`.
3. If module not found in plan and no force-add override → 403.

**Output on success**: Pipeline continues.

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| Module not enabled for facility | 403 | `MODULE_NOT_AVAILABLE` |
| Module force-disabled by override | 403 | `MODULE_DISABLED` |

---

## Step 6: requirePermission(permissionKey)

**Purpose**: Confirm the authenticated user's role includes the required permission.

**Input**: `req.auth.userId`, `req.auth.facilityId`, route-level `permissionKey`.

**Behaviour**:
- If `isSuperAdmin` → skip (super admins bypass RBAC checks within their authorized scope).
- Look up `facility_users` WHERE `(facility_id, user_id)` to get `role_id`.
- Check `facility_role_permissions` WHERE `(role_id, permission.key = permissionKey)`.
- If found → pass.

**Output on success**: Pipeline continues.

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| User not member of facility | 403 | `FORBIDDEN` |
| Role does not have permission | 403 | `FORBIDDEN` |
| User membership `is_active = false` | 403 | `USER_SUSPENDED` |

---

## Step 7: checkFeatureFlag(flagKey) — Optional

**Purpose**: Per-route guard for features within a module that can be toggled independently.

**Input**: Route-level `flagKey`, `req.auth.facilityId`.

**Behaviour**: Checks facility settings JSONB for `featureFlags.{flagKey}`. Falls back to
platform-level default if not set.

**Output on success**: Pipeline continues.

**Failure modes**:
| Condition | HTTP Status | Error Code |
|---|---|---|
| Feature flag disabled for facility | 403 | `FEATURE_DISABLED` |

---

## Route Handler Contract

**Preconditions guaranteed by the chain**: By the time a route handler executes, all of
the following are verified:
- JWT is valid and not expired.
- Session is not revoked (checked against Redis or DB).
- User's permission state matches the JWT at issuance.
- Facility is active.
- Module is enabled for the facility.
- User's role has the required permission.

**Route handler responsibility**:
- Open `withTenantContext(req.auth.facilityId, async (tx) => { ... })`.
- All facility-scoped DB operations use `tx`, not the module-level `db`.
- Never call `db` directly inside a route handler.

---

## Error Response Shape

All middleware failures return JSON:

```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "requestId": "req_01j..."
  }
}
```

- `code` — machine-readable error code from the tables above
- `message` — human-readable message (no sensitive details)
- `requestId` — from `req.id` (set by request-id middleware at request entry)

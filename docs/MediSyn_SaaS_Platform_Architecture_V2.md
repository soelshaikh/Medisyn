# Vtech-Med — Multi-Tenant SaaS Platform Architecture V2

**Date:** 2026-10-06
**Status:** APPROVED — ready for Phase 1 implementation
**Previous version:** `MediSyn_SaaS_Platform_Architecture.md` (V1 — superseded)

> **Naming clarification (confirmed 2026-10-06):**
> The platform is called **Vtech-Med**. **MediSyn** is one facility (tenant) on the platform — a specific pharmacy. All platform-level references in this document use "Vtech-Med". "MediSyn" refers only to the MediSyn facility/tenant.

---

## Changelog from V1

| Area | V1 | V2 | V2.1 |
|---|---|---|---|
| RLS implementation | Mentioned as concept | Fully specified: DB roles, transaction scoping, fail-closed policy, connection pool safety | Canonical `withTenantContext()` pattern aligned across §5 and §13 |
| Super admin bypass | `SET LOCAL app.bypass_rls = 'true'` (unsafe) | Dedicated DB role with `BYPASSRLS`, separate connection pool, audit-gated access | — |
| JWT staleness | Not addressed | `auth_version` integer + Redis cache, immediate invalidation path defined | Redis unavailable → DB fallback → fail closed (503) |
| Session revocation | Not present | Not present | `sessions` table, per-session / per-user / per-facility revocation, Redis fast path, fail-closed fallback |
| API keys | Basic schema only | Full lifecycle: scopes, rotation, grace period, revocation, rate limiting, audit | Argon2 cost documented for Phase 14 review |
| Patient model | Not defined | Facility-scoped, minimum schema defined | Patients are authenticated platform users (`users` table + `patient` role) |
| Audit log isolation | Not present | Append-only, no RLS (application-layer filter) | RLS added for `app_user` role; `app_super_admin` bypasses via BYPASSRLS |
| Quantitative limits | Mentioned in plan table only | `plan_entitlements` + `facility_entitlement_overrides` tables, enforcement strategy per metric | — |
| Phase 1 criteria | Vague | Explicit, testable acceptance criteria listed | Session revocation tests added |

---

## 1. Product Vision

**Vtech-Med** is a **multi-tenant SaaS platform** for pharmacy and healthcare facility management.

- Vtech-Med is the software vendor
- Each pharmacy / clinic / health network is a **facility (tenant)**
- **MediSyn** is the first facility on the platform — a specific pharmacy tenant
- Facilities are onboarded and configured by the Vtech-Med **super admin**
- Facilities manage their operations through a **shared admin panel** (admin URL — OPEN QUESTION: confirm domain)
- Facilities build their own **patient-facing frontends** using Vtech-Med's REST API
- Features available to a facility are controlled by their **subscription plan**

---

## 2. Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Backend framework | Express.js | CONFIRMED |
| Database | PostgreSQL | CONFIRMED |
| ORM | Drizzle | CONFIRMED |
| Connection pooling | PgBouncer (transaction mode) | CONFIRMED |
| Auth | JWT (access + refresh) + Argon2 | CONFIRMED |
| Cache / rate limiting | Redis | CONFIRMED |
| Queue | BullMQ | CONFIRMED |
| File storage | S3-compatible (abstracted) | CONFIRMED |
| Admin panel | Next.js (App Router) | CONFIRMED |
| Frontend (reference) | Next.js (App Router) | CONFIRMED |

**Stack constraint:** No microservices, Kubernetes, event sourcing, or separate databases per tenant. The architecture is `Express + PostgreSQL + Redis + Next.js` throughout.

---

## 3. Repo Structure

```
/ (repo root)
├── frontend/    ← Patient-facing Next.js app (reference implementation)
├── backend/     ← Express.js REST API — multi-tenant, PostgreSQL
├── admin/       ← Admin panel Next.js app — multi-tenant SaaS admin
├── docs/
├── worklog/
├── CLAUDE.md
└── worklog.md
```

All three are independent apps with their own `package.json`. No root-level workspace.

---

## 4. Four-Layer Authorization Model

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PLATFORM LEVEL                                         │
│  Actor: Vtech-Med super admin                                       │
│  Controls: facilities, plans, modules, billing, cross-facility    │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2 — SUBSCRIPTION LEVEL                                     │
│  Actor: Facility's active plan + feature flags                    │
│  Controls: which modules and features a facility can access       │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 3 — FACILITY RBAC LEVEL                                    │
│  Actor: Facility admin assigns roles to staff                     │
│  Controls: what a staff member can DO within accessible modules   │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 4 — DATABASE ROW LEVEL (RLS)                               │
│  Actor: PostgreSQL engine                                         │
│  Controls: which rows a query can touch (automatic, engine-level) │
│  Fails CLOSED — no context = no rows                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. PostgreSQL RLS — Full Implementation

### 5.1 Database Roles

Two separate PostgreSQL roles are created. The application connects as one of them depending on the operation type.

```sql
-- Regular application role (all facility-scoped requests)
CREATE ROLE app_user WITH LOGIN PASSWORD '...';

-- Super admin role (cross-facility operations, BYPASSRLS privilege)
CREATE ROLE app_super_admin WITH LOGIN PASSWORD '...';
ALTER ROLE app_super_admin BYPASSRLS;

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_super_admin;
```

Two separate **connection pools** in the application:

```typescript
// db.ts
export const db = drizzle(regularPool)        // app_user role — RLS enforced
export const superAdminDb = drizzle(superAdminPool) // app_super_admin role — BYPASSRLS
```

`superAdminDb` is only importable from `src/core/super-admin/` modules. Any import outside that path is a lint error (enforced via ESLint import rules).

### 5.2 Tenant Context — Transaction-Scoped

Tenant context is always set **inside a transaction**, never at the session level.

```typescript
// lib/tenant-context.ts
export async function withTenantContext<T>(
  facilityId: string,
  fn: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(key, value, is_local=true) — scoped to this transaction only
    await tx.execute(
      sql`SELECT set_config('app.current_facility_id', ${facilityId}, true)`
    )
    return fn(tx)
  })
}
```

**Why `set_config(..., true)` not `SET LOCAL`:**
`set_config('key', 'value', true)` is the function form of `SET LOCAL` — both are transaction-local. The function form is preferred because it is parameterized (no SQL injection surface) and works identically with PgBouncer in transaction mode.

**Why transaction mode with PgBouncer is safe:**
In PgBouncer transaction mode, each transaction may use a different server connection from the pool. Because the tenant context is set *inside* the transaction with `is_local=true`, it is guaranteed to be cleared when the transaction ends — regardless of which pool connection is used next.

**`SET SESSION` is prohibited** — it would persist the tenant context on the connection after the transaction ends, causing it to leak to the next request that reuses the same connection.

### 5.3 RLS Policies — Fail Closed

All facility-scoped tables use a shared helper function. If the context is missing or invalid, the function raises an exception — denying access rather than returning empty rows or allowing a full-table scan.

```sql
-- Helper function: raises exception if context is missing or malformed
CREATE OR REPLACE FUNCTION current_facility_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := current_setting('app.current_facility_id', true);
  IF v_id IS NULL OR v_id = '' THEN
    RAISE EXCEPTION 'MISSING_TENANT_CONTEXT'
      USING HINT = 'app.current_facility_id must be set before querying this table';
  END IF;
  RETURN v_id::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'INVALID_TENANT_CONTEXT'
      USING HINT = 'app.current_facility_id is not a valid UUID';
END;
$$;

-- Applied identically to every facility-scoped table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant_isolation ON orders
  USING (facility_id = current_facility_id());

-- Pattern repeated for: prescriptions, products, appointments,
-- patient_profiles, inventory, compounding_requests, ... every module table
```

**Fail-closed behaviour:**
- No context set → `RAISE EXCEPTION` → query errors, nothing returned
- Invalid UUID → `RAISE EXCEPTION` → query errors, nothing returned
- Valid context, wrong facility → RLS policy filters the row → nothing returned
- No RLS policy on a table → access denied by default (default deny is PostgreSQL's default when RLS is enabled)

### 5.4 Connection Pool Configuration

```
Application                     PgBouncer                  PostgreSQL
────────────────────────────────────────────────────────────────────
Regular request → regularPool → transaction mode → app_user
Super admin request → superAdminPool → transaction mode → app_super_admin
```

PgBouncer settings:
- `pool_mode = transaction` — safe with `set_config(..., true)`
- `server_reset_query = DISCARD ALL` — clears any residual session state between connections
- `max_client_conn` — sized per expected concurrency
- Two separate PgBouncer pools, one per DB role

### 5.5 Preventing Context Manipulation

Tenant context cannot be manipulated by the request layer because:

1. `facilityId` is extracted **only from the verified JWT** — never from request headers, query params, or body
2. The JWT is signed with the application's secret — cannot be forged by a client
3. `set_config` is called with a value from the verified JWT — not from any user-supplied input
4. No public API endpoint sets `app.current_facility_id` directly
5. The `current_facility_id()` DB function is `SECURITY DEFINER` — cannot be overridden by the `app_user` role

### 5.6 Cross-Tenant Isolation Tests (Phase 1 Acceptance)

Required automated tests before Phase 1 is complete:

```typescript
describe('Cross-tenant isolation', () => {
  // Tenant A cannot read Tenant B rows
  it('SELECT: facility A cannot read facility B rows')

  // Tenant A cannot modify Tenant B rows
  it('UPDATE: facility A cannot update facility B rows')

  // Tenant A cannot delete Tenant B rows
  it('DELETE: facility A cannot delete facility B rows')

  // Missing context raises exception (not silent empty result)
  it('raises MISSING_TENANT_CONTEXT when no context set')

  // Invalid UUID raises exception
  it('raises INVALID_TENANT_CONTEXT for malformed facilityId')

  // RLS is enabled on every facility-scoped table (schema inspection test)
  it('RLS is enabled on all facility-scoped tables')

  // Connection pool cannot leak context
  it('tenant context does not leak across sequential requests on same pool connection')

  // Super admin access is audited
  it('super admin cross-facility read writes an audit_log entry')
})
```

---

## 6. Super Admin Access — Safe Cross-Facility Operations

### 6.1 Mechanism

Super admin uses the `superAdminDb` connection pool (connected as `app_super_admin` with `BYPASSRLS`). This pool is **not accessible from any regular request path**.

```typescript
// src/core/super-admin/super-admin.service.ts
// This file is the ONLY place that imports superAdminDb
import { superAdminDb } from '@/db'
import { auditLog } from '@/core/audit/audit.service'

export async function superAdminQuery<T>(
  actor: SuperAdminUser,
  action: string,
  resourceType: string,
  fn: () => Promise<T>
): Promise<T> {
  // Audit BEFORE execution — if the query fails, the intent is still recorded
  await auditLog({
    actorId: actor.id,
    actorType: 'super_admin',
    action,
    resourceType,
    facilityId: null,
    metadata: { initiated_at: new Date().toISOString() }
  })

  return fn()
}
```

### 6.2 Super Admin JWT

```jsonc
{
  "sub": "user-uuid",
  "isSuperAdmin": true,
  "facilityId": null,
  "exp": ...
}
```

Super admin JWT access token TTL: **15 minutes** (same as facility users).
Super admin sessions are not long-lived. Re-authentication is required after expiry.

### 6.3 Access Control Enforced at Code Level

ESLint rule enforced in CI:

```json
// .eslintrc — import restriction
{
  "no-restricted-imports": [{
    "name": "@/db",
    "importNames": ["superAdminDb"],
    "message": "superAdminDb can only be imported from src/core/super-admin/"
  }]
}
```

Any developer who imports `superAdminDb` outside the designated module will get a lint error in CI.

---

## 7. Core Data Model

### 7.1 Users

```sql
users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,           -- Argon2id
  first_name       TEXT,
  last_name        TEXT,
  is_super_admin   BOOLEAN NOT NULL DEFAULT false,
  email_verified   BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended'
  auth_version     INTEGER NOT NULL DEFAULT 1,      -- incremented on security-relevant changes
  suspended_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### 7.2 Facilities (Tenants)

```sql
facilities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,
  type                 TEXT NOT NULL,          -- 'pharmacy' | 'clinic' | 'health_network'
  status               TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'pending'
  subscription_plan_id UUID REFERENCES subscription_plans(id),
  settings             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### 7.3 Platform Modules

```sql
platform_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_core     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

**Core modules** (always enabled):
`auth`, `dashboard`, `users`, `settings`

**Optional modules** (plan-controlled):
`ecommerce`, `stock_management`, `prescriptions`, `compounding`,
`appointments`, `ask_pharmacist`, `minor_ailments`, `analytics`, `webhooks`

### 7.4 Subscription Plans

```sql
subscription_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  price_monthly  NUMERIC(10,2),
  price_yearly   NUMERIC(10,2),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)

plan_modules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES subscription_plans(id),
  module_id      UUID NOT NULL REFERENCES platform_modules(id),
  feature_flags  JSONB NOT NULL DEFAULT '{}',
  UNIQUE(plan_id, module_id)
)

facility_module_overrides (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id            UUID NOT NULL REFERENCES facilities(id),
  module_id              UUID NOT NULL REFERENCES platform_modules(id),
  enabled                BOOLEAN NOT NULL,
  feature_flag_overrides JSONB NOT NULL DEFAULT '{}',
  UNIQUE(facility_id, module_id)
)
```

**Feature flag resolution** (last write wins):
```
plan_modules.feature_flags
  merged with →
facility_module_overrides.feature_flag_overrides
  = effective flags for this facility
```

### 7.5 Plan Entitlements (Quantitative Limits)

```sql
plan_entitlements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID NOT NULL REFERENCES subscription_plans(id),
  metric       TEXT NOT NULL,
  -- Defined metrics: 'staff_seats' | 'api_requests_per_day' | 'storage_bytes' | 'locations'
  limit_value  BIGINT,           -- NULL = unlimited
  UNIQUE(plan_id, metric)
)

facility_entitlement_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  UUID NOT NULL REFERENCES facilities(id),
  metric       TEXT NOT NULL,
  limit_value  BIGINT,           -- NULL = unlimited; super admin override
  UNIQUE(facility_id, metric)
)

facility_usage_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  UUID NOT NULL REFERENCES facilities(id),
  metric       TEXT NOT NULL,
  period       TEXT NOT NULL,    -- 'YYYY-MM-DD' for daily, 'YYYY-MM' for monthly
  count        BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, metric, period)
)
```

**Enforcement strategy per metric:**

| Metric | Enforcement point | Mechanism |
|---|---|---|
| `staff_seats` | User invite | Synchronous DB count check before INSERT |
| `api_requests_per_day` | Every API key request | Redis INCR + check, synced to DB hourly |
| `storage_bytes` | File upload | Synchronous check against current usage |
| `locations` | Location creation | Synchronous DB count check before INSERT |

Billing and payment processing are **out of scope**. Entitlement tables are in place for enforcement only.

### 7.6 Permission System (RBAC per Facility)

```sql
permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_slug  TEXT NOT NULL,
  action       TEXT NOT NULL,   -- 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export'
  resource     TEXT NOT NULL,   -- 'product' | 'order' | 'prescription_request' | etc.
  description  TEXT,
  UNIQUE(module_slug, action, resource)
)

facility_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  name        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, name)
)
-- System roles auto-created on facility onboarding:
-- owner, pharmacist, manager, staff, viewer

facility_role_permissions (
  role_id       UUID NOT NULL REFERENCES facility_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
)

facility_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  role_id     UUID NOT NULL REFERENCES facility_roles(id),
  status      TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'pending'
  invited_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, facility_id)
)
```

---

## 8. JWT Design, Session Management, and Revocation

### 8.0 Three Mechanisms Are Distinct

These three mechanisms serve different purposes and are checked independently on every request. Do not treat them as alternatives or substitutes for each other.

| Mechanism | What it represents | Answers the question |
|---|---|---|
| `JWT exp` | Maximum lifetime of an access token | Has this token exceeded its allowed age? |
| `auth_version` | Authorization / permissions state version | Is the user still authorized to do what this token claims? |
| `sessionId` + revocation state | Whether this specific login instance is still active | Was this session explicitly terminated? |

**`auth_version`** increments when roles, permissions, plan, or security-sensitive attributes change. A stale `auth_version` means the token's embedded permissions are no longer current — the user must re-authenticate to receive updated claims.

**Session revocation** terminates a specific login instance. A password reset, admin-forced logout, suspension, or security incident revokes sessions. It answers whether this particular session was explicitly cancelled, regardless of whether the permissions are still valid.

**`JWT exp`** is a hard ceiling. Even a non-revoked, up-to-date-auth-version token cannot be used past its expiry.

All three checks run on every authenticated request, in this order: verify JWT signature + exp → check session revocation → check auth_version.

---

### 8.1 Token Structure

**Facility user access token:**
```jsonc
{
  "sub": "user-uuid",
  "sessionId": "session-uuid",
  "facilityId": "facility-uuid",
  "isSuperAdmin": false,
  "roleId": "role-uuid",
  "authVersion": 7,
  "iat": 1234567890,
  "permissions": [
    "ecommerce:product:create",
    "ecommerce:order:read",
    "prescriptions:prescription_request:approve"
  ],
  "modules": ["ecommerce", "prescriptions", "stock_management"],
  "exp": 1234568790
}
```

**Super admin access token:**
```jsonc
{
  "sub": "user-uuid",
  "sessionId": "session-uuid",
  "isSuperAdmin": true,
  "facilityId": null,
  "authVersion": 3,
  "iat": 1234567890,
  "exp": 1234568790
}
```

`iat` (issued-at) is a standard JWT claim required for bulk revocation timestamp comparisons.
`sessionId` uniquely identifies this login instance.
Access token TTL: **15 minutes** from `iat`.

**Refresh token:** 7-day TTL. Bound to exactly one session (stored in `sessions` table). Revoking a session permanently invalidates its refresh token.

---

### 8.2 Sessions Table (Durable Source of Truth)

PostgreSQL is the durable source of truth for all session state. Redis caches revocation state for fast per-request lookup.

```sql
sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  facility_id         UUID REFERENCES facilities(id),     -- NULL for super admin
  refresh_token_hash  TEXT NOT NULL,                      -- Argon2id hash of refresh token
  revoked_at          TIMESTAMPTZ,                        -- NULL = active
  revoked_reason      TEXT,
  --  'logout' | 'password_reset' | 'account_suspended' | 'facility_suspended'
  --  'admin_revoke' | 'security_incident' | 'all_user_sessions' | 'all_facility_sessions'
  revoked_by          UUID REFERENCES users(id),          -- NULL for system-initiated revocations
  user_agent          TEXT,
  ip_address          INET,
  last_used_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL                -- refresh token expiry: now() + 7 days
)

CREATE INDEX sessions_user_id_active_idx    ON sessions(user_id)      WHERE revoked_at IS NULL;
CREATE INDEX sessions_facility_id_active_idx ON sessions(facility_id) WHERE revoked_at IS NULL;
```

There is no separate `refresh_tokens` table. `sessions` is the single source of truth for both session state and refresh token validity.

---

### 8.3 Session Revocation — Redis Fast-Path State

Redis caches revocation state for fast per-request lookup. It is never the source of truth — only a write-through cache. Active sessions are not stored in Redis; only revocations are cached. This means Redis writes happen only when something is revoked (the uncommon path), not on every login.

```
Key:   revoked_session:{sessionId}
Value: "1"
TTL:   (session.expires_at − now()) + 24 h
Use:   per-session revocation lookup

Key:   user_revoked_since:{userId}
Value: ISO 8601 timestamp (e.g. "2026-10-06T14:30:00.000Z")
TTL:   7 days (max session lifetime)
Use:   if this timestamp > JWT iat → all sessions issued before revocation are invalid

Key:   facility_revoked_since:{facilityId}
Value: ISO 8601 timestamp
TTL:   7 days
Use:   if this timestamp > JWT iat → all facility sessions issued before revocation are invalid
```

**Revocation check logic (runs once per request, before any DB transaction opens):**

```typescript
async function isSessionRevoked(
  sessionId: string,
  userId: string,
  facilityId: string | null,
  tokenIssuedAt: number         // JWT iat (seconds since epoch)
): Promise<boolean> {
  if (await redis.exists(`revoked_session:${sessionId}`)) return true

  const userRevokedSince = await redis.get(`user_revoked_since:${userId}`)
  if (userRevokedSince && new Date(userRevokedSince).getTime() > tokenIssuedAt * 1000) return true

  if (facilityId) {
    const facilityRevokedSince = await redis.get(`facility_revoked_since:${facilityId}`)
    if (facilityRevokedSince && new Date(facilityRevokedSince).getTime() > tokenIssuedAt * 1000) return true
  }

  return false
}
```

---

### 8.4 Redis Unavailability — Fail Closed

**Both the session revocation check and the `auth_version` check follow the same fail-closed fallback:**

```
Redis available   → Redis check → pass or 401/503
Redis unavailable → DB fallback check → pass or 401
Both unavailable  → 503 SERVICE_UNAVAILABLE  (fail closed — never accept unknown revocation state)
```

Never accept a request when the revocation or authorization state cannot be confirmed. If neither Redis nor the DB can answer, reject the request.

```typescript
async function checkSessionRevocation(sessionId, userId, facilityId, iat): Promise<void> {
  let revoked: boolean
  try {
    revoked = await isSessionRevoked(sessionId, userId, facilityId, iat)   // Redis
  } catch {
    try {
      revoked = await isSessionRevokedInDb(sessionId, userId, facilityId, iat)  // DB fallback
    } catch {
      throw new ServiceUnavailableError('AUTH_STORE_UNAVAILABLE')           // fail closed
    }
  }
  if (revoked) throw new UnauthorizedError('SESSION_REVOKED')
}

async function verifyAuthVersion(userId: string, jwtAuthVersion: number): Promise<void> {
  let currentVersion: number
  try {
    const cached = await redis.get(`auth:version:${userId}`)
    if (cached !== null) {
      currentVersion = Number(cached)
    } else {
      const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { auth_version: true } })
      currentVersion = user.auth_version
      await redis.setex(`auth:version:${userId}`, 60, currentVersion.toString())
    }
  } catch {
    try {
      const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { auth_version: true } })
      currentVersion = user.auth_version
    } catch {
      throw new ServiceUnavailableError('AUTH_STORE_UNAVAILABLE')           // fail closed
    }
  }
  if (jwtAuthVersion < currentVersion) throw new UnauthorizedError('TOKEN_STALE')
}
```

**Operational implication:** Redis downtime routes all auth checks to the DB. Redis must be treated as a P0 availability dependency (see Risk R8 in §20).

---

### 8.5 Session Revocation — Functions

All revocation functions follow the same three-step order: PostgreSQL first (durable), Redis second (cache), audit log third.

```typescript
type RevokedReason =
  | 'logout' | 'password_reset' | 'account_suspended' | 'facility_suspended'
  | 'admin_revoke' | 'security_incident' | 'all_user_sessions' | 'all_facility_sessions'

// Revoke a single session
async function revokeSession(sessionId: string, reason: RevokedReason, revokedBy: string | null): Promise<void>

// Revoke all active sessions for a user
async function revokeAllUserSessions(userId: string, reason: RevokedReason, revokedBy: string | null): Promise<void>

// Revoke all active sessions for a facility
async function revokeAllFacilitySessions(facilityId: string, reason: RevokedReason, revokedBy: string | null): Promise<void>
```

**`revokeAllUserSessions` implementation pattern:**
1. `UPDATE sessions SET revoked_at = now(), revoked_reason = reason, revoked_by = revokedBy WHERE user_id = ? AND revoked_at IS NULL`
2. `SET user_revoked_since:{userId} = now().toISOString()  EX 604800` (7-day TTL)
3. `writeAuditLog({ action: 'session:revoke_all_user', ... })`

**Automatic revocation triggers:**

| Event | Revocation called |
|---|---|
| User self-logout | `revokeSession(sessionId, 'logout', userId)` |
| Password reset completed | `revokeAllUserSessions(userId, 'password_reset', null)` |
| User account suspended | `revokeAllUserSessions(userId, 'account_suspended', null)` |
| Facility suspended | `revokeAllFacilitySessions(facilityId, 'facility_suspended', null)` |
| Admin revokes specific session | `revokeSession(sessionId, 'admin_revoke', adminId)` |
| Admin revokes all sessions for user | `revokeAllUserSessions(userId, 'admin_revoke', adminId)` |
| Security incident | `revokeAllFacilitySessions` or `revokeAllUserSessions` as appropriate |

---

### 8.6 Refresh Token Behavior After Revocation

A refresh token is permanently bound to its session (`sessions.refresh_token_hash`).

When a session is revoked:
1. `sessions.revoked_at` is set in PostgreSQL (durable, immediate)
2. `revoked_session:{sessionId}` is set in Redis (fast cache, immediate)
3. Any subsequent refresh token exchange checks `sessions.revoked_at IS NULL`
4. If revoked → `401 REFRESH_TOKEN_REVOKED`
5. A revoked session **cannot obtain a new access token** under any circumstances, even if the refresh token's 7-day window has not expired.

---

### 8.7 Long-Running Operation Cancellation

**In-flight HTTP requests** that are executing when a session is revoked complete normally. Revocation takes effect on the next request. There is no mechanism to interrupt a running thread mid-execution.

**BullMQ jobs** store the originating session context and check revocation at logical checkpoints between batches:

```typescript
// When enqueuing a long-running job
await queue.add('generate-export', {
  ...jobData,
  _meta: { sessionId, userId, facilityId, iat: req.auth.iat }
})

// Inside the job processor — check at the start of each batch
for (const batch of batches) {
  const cancelled = await isSessionOrUserRevoked(job.data._meta.sessionId, job.data._meta.userId, job.data._meta.facilityId, job.data._meta.iat)
  if (cancelled) {
    await job.updateData({ ...job.data, status: 'cancelled', cancelReason: 'session_revoked' })
    return  // exit gracefully; job moves to completed state with cancelled status
  }
  // ... process batch
}
```

Jobs check cancellation — they are not forcibly killed. A batch step already executing completes before cancellation is detected. This is acceptable for MVP; strict job termination via `job.discard()` is a Phase 14 item.

---

### 8.8 Auth Version — Stale Token Detection

`auth_version` is an integer on the `users` table, incremented on every security-relevant **authorization** change. It is separate from session revocation — it concerns permissions state, not session state.

**Events that increment `auth_version`:**

| Event | Mechanism |
|---|---|
| Role changed | Increment + `redis.del(auth:version:{userId})` |
| User suspended | Increment + `redis.del` immediately |
| Facility suspended | Increment for all facility users + `redis.del` for each |
| Subscription plan changed | Increment for all facility users + `redis.del` for each |
| Module enabled/disabled | Increment for all facility users + `redis.del` for each |
| Password changed | Increment + `redis.del` immediately |

**Events that wait for token expiry (15-min window is acceptable):**

| Event | Why acceptable |
|---|---|
| New permission added to role | Additive — not a security regression |
| Feature flag added | Non-security — user gains access at next refresh |

**Immediate invalidation:**

```typescript
async function invalidateUserAuth(userId: string) {
  await db.update(users).set({ auth_version: sql`auth_version + 1` }).where(eq(users.id, userId))
  await redis.del(`auth:version:${userId}`)
}
```

Validation logic with fail-closed Redis fallback is shown in §8.4.

---

## 9. API Key Authentication

### 9.1 Separation from Human Auth

API keys are for **machine-to-machine** use (facility frontends calling MediSyn backend). They are entirely separate from the JWT system used by human users in the admin panel.

A request is authenticated by **exactly one** of:
1. A valid JWT (human session)
2. A valid API key (machine request)

### 9.2 Schema

```sql
facility_api_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id         UUID NOT NULL REFERENCES facilities(id),
  name                TEXT NOT NULL,
  key_prefix          TEXT NOT NULL,       -- first 8 chars, shown in UI for identification
  key_hash            TEXT NOT NULL,       -- Argon2id hash of full key (after the prefix)
  scopes              TEXT[] NOT NULL,     -- ['ecommerce:product:read', 'prescriptions:read']
  rate_limit_override INTEGER,             -- req/hour, NULL = plan default
  expires_at          TIMESTAMPTZ,         -- NULL = no expiry
  revoked_at          TIMESTAMPTZ,         -- NULL = active; set on revocation
  grace_period_ends_at TIMESTAMPTZ,        -- set during rotation; old key valid until this time
  last_used_at        TIMESTAMPTZ,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

### 9.3 Key Lifecycle

**Creation:**
1. Generate 32 random bytes → base64url encode → `rawKey`
2. `key_prefix` = first 8 chars of `rawKey`
3. Store `Argon2id(rawKey)` as `key_hash`
4. Return `rawKey` to the user **once** — never stored plaintext
5. Write `audit_log` entry: `api_key:create`

**Verification on each request:**
1. Extract key from `Authorization: Bearer msy_xxxxxxxx...` header
2. Extract prefix (first 8 chars)
3. Look up row by `key_prefix` where `revoked_at IS NULL` and (`expires_at IS NULL` OR `expires_at > now()`)
4. Verify `Argon2id(incomingKey) == key_hash`
5. Check scopes against requested route's permission
6. Increment rate limit counter in Redis
7. Update `last_used_at` asynchronously (non-blocking)
8. Write sampled audit entry (every API key request sampled at 10%, security-sensitive at 100%)

**Rotation:**
1. Generate new key (same process as creation)
2. Set `grace_period_ends_at = now() + 48h` on old key
3. Both old and new keys are valid during grace period
4. Grace period end → old key auto-revoked (cron job)
5. Audit: `api_key:rotate_initiated`, `api_key:rotate_completed`

**Revocation:**
1. Set `revoked_at = now()` on the key row
2. Key hash remains in table for audit trail
3. All subsequent requests with this key immediately fail with `401 API_KEY_REVOKED`
4. Audit: `api_key:revoke`

### 9.4 Scopes

Format: `{module}:{resource}:{action}` or wildcard shorthand `{module}:read` / `{module}:write`

```
ecommerce:read           — read all ecommerce resources
ecommerce:product:write  — create/update products only
prescriptions:read       — read prescription requests
*                        — full access (Enterprise plan only)
```

Scopes are checked against the same `permissions` table used for human RBAC.
A scope can never grant access to a module not enabled on the facility's plan.

### 9.5 Rate Limiting

```
Redis key: rate:{key_prefix}:{YYYY-MM-DD-HH}
Value: INCR atomically
TTL: 2 hours (auto-expiry)

Limit source:
  facility_api_keys.rate_limit_override
    ?? plan_entitlements WHERE metric = 'api_requests_per_day' / 24
```

### 9.6 CORS Is Not Authentication

CORS (`Access-Control-Allow-Origin`) is enforced only in browsers. It is **not** an authentication or authorization mechanism. All server-side authentication and authorization applies to every request regardless of origin.

`facility.settings.api.allowed_origins` is used for CORS header configuration only. A request from an unlisted origin that carries a valid API key or JWT is still authenticated by server-side logic — the CORS headers only affect whether a browser enforces a preflight block.

---

## 10. Patient Domain Model

### 10.1 Architecture Decision: Facility-Scoped Patient Identity

**CONFIRMED:** Patient identity is **facility-specific**.

A patient at Pharmacy A and a patient at Pharmacy B are separate records with no structural link.

**Rationale:**
- Simpler RLS isolation — patient rows are scoped like every other table
- No cross-facility PHI leakage by design
- Aligns with how independent pharmacies work today
- PHI consent management for cross-facility linking is out of scope
- If cross-facility patient linking is required in future, it is an explicit opt-in feature with consent tracking — it is not assumed as a default

### 10.2 Patient Authentication Model

**Patients are authenticated platform users.** They are not a separate identity system.

| Component | How it works for patients |
|---|---|
| `users` table | Patient has a row in `users` — same table as staff |
| `facility_users` table | Patient has a row with role `patient` (a system role) scoped to their facility |
| JWT | Patients receive a standard JWT with `facilityId`, `sessionId`, `authVersion` |
| Permissions | The `patient` system role has patient-facing permissions only (e.g. `prescriptions:prescription_request:create`, not `prescriptions:prescription_request:approve`) |
| `patient_profiles` table | Extends the user record with healthcare domain data (DOB, health card, allergies, etc.) |
| Session revocation | Works identically — `revokeSession()`, `revokeAllUserSessions()` apply to patients |

A patient's JWT is indistinguishable in structure from a staff JWT. The difference is in `permissions` (patient-scoped only) and the absence of any admin-level permissions. The admin panel is not accessible by patients — route-level permission checks prevent it.

**There is no separate patient authentication system.** Patients register, log in, receive access + refresh tokens, and have sessions revoked through the same auth infrastructure as staff.

### 10.3 Schema

```sql
patient_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id           UUID NOT NULL REFERENCES facilities(id),  -- RLS scoped
  user_id               UUID NOT NULL REFERENCES users(id),
  date_of_birth         DATE,
  sex                   TEXT,              -- 'male' | 'female' | 'other' | 'prefer_not_to_say'
  health_card_number    TEXT,              -- encrypted at rest (application-level AES-256-GCM)
  health_card_province  TEXT,
  phone_number          TEXT,
  address               JSONB,
  -- { street, city, province, postal_code, country }
  allergies             TEXT[],
  current_medications   TEXT[],
  emergency_contact     JSONB,
  -- { name, relationship, phone }
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, user_id)
)

-- RLS
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY patient_profiles_tenant_isolation ON patient_profiles
  USING (facility_id = current_facility_id());
```

**Fields mapped to modules:**

| Field | Used by |
|---|---|
| `date_of_birth` | Prescriptions, minor ailments, appointments |
| `health_card_number` | Prescriptions, appointments |
| `health_card_province` | Prescriptions, appointments |
| `allergies` | Prescriptions, compounding, minor ailments |
| `current_medications` | Prescriptions, compounding |
| `phone_number` | Appointments (reminders), ask pharmacist |
| `address` | Ecommerce (shipping) |

`health_card_number` is encrypted at the application layer (AES-256-GCM, key from environment / KMS). The DB stores the ciphertext — the DB itself cannot decrypt it.

---

## 11. Audit Log

### 11.1 Schema

```sql
audit_log (
  id                  BIGSERIAL PRIMARY KEY,    -- efficient append, sortable by time
  facility_id         UUID,                     -- NULL for platform-level (super admin) operations
  actor_id            UUID,                     -- NULL for system/scheduled jobs
  actor_type          TEXT NOT NULL,            -- 'user' | 'api_key' | 'system' | 'super_admin'
  actor_api_key_prefix TEXT,                    -- populated when actor_type = 'api_key'
  action              TEXT NOT NULL,            -- verb: 'create', 'read', 'update', 'delete',
                                                --   'approve', 'reject', 'export', 'login',
                                                --   'logout', 'suspend', 'revoke', 'rotate'
  resource_type       TEXT NOT NULL,            -- table/domain noun
  resource_id         TEXT,                     -- UUID as text, or composite
  metadata            JSONB NOT NULL DEFAULT '{}',
  ip_address          INET,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- RLS: app_user can only SELECT rows belonging to their facility
-- app_super_admin bypasses RLS via BYPASSRLS role attribute
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Facility users: SELECT only their own facility's audit records
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT TO app_user
  USING (facility_id = current_facility_id());

-- Facility users: INSERT only audit records for their own facility
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT TO app_user
  WITH CHECK (facility_id = current_facility_id());

-- No UPDATE or DELETE for any application role
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_super_admin;

-- audit_log rows are NEVER updated or deleted (append-only, enforced by permission revocation)
```

**RLS isolation:**
- `app_user` (facility staff, patients) can only read their own facility's audit records
- Platform-level audit records (`facility_id IS NULL`) are not visible to facility users — they require `app_super_admin`
- `app_super_admin` bypasses RLS (BYPASSRLS role attribute) and can read all records cross-facility
- Both roles can INSERT — but `app_user` inserts are constrained to their own `current_facility_id()` by the INSERT policy

**Session audit events** (`session:revoke`, `session:revoke_all_user`, `session:revoke_all_facility`) carry a `facility_id`, so they are visible to facility admins in their own audit log.

### 11.2 Mandatory Audit Events

| Category | Events |
|---|---|
| **Auth** | Login success/fail, logout, token refresh, password reset request/complete, email verify |
| **Sessions** | Session revoke (single), revoke all user sessions, revoke all facility sessions |
| **Super admin** | Any cross-facility operation (before execution) |
| **Permissions** | Role create/update/delete, permission assigned/revoked, user role changed |
| **PHI access** | `patient_profile` read (any field), `health_card_number` decryption, prescription file download |
| **Prescriptions** | Create, approve, reject, dispense, file upload, file download |
| **Compounding** | Create, approve, reject, complete |
| **API keys** | Create, revoke, rotate initiated, rotation completed, rotation grace period expired |
| **Subscription** | Plan change, module enable/disable, feature flag override |
| **Facility** | Create, suspend, reactivate |
| **Data exports** | Any bulk export operation |
| **Auth version** | Any `auth_version` increment (records what triggered the increment) |

### 11.3 Implementation Pattern

```typescript
// lib/audit.ts
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  // Fire-and-forget for non-blocking operations
  // Uses a separate DB connection to avoid affecting the transaction
  await auditDb.insert(auditLogTable).values(entry)
}

// For super admin pre-execution audit (must complete before the operation)
export async function auditAndExecute<T>(
  entry: AuditEntry,
  fn: () => Promise<T>
): Promise<T> {
  await writeAuditLog({ ...entry, metadata: { ...entry.metadata, status: 'initiated' } })
  const result = await fn()
  await writeAuditLog({ ...entry, metadata: { ...entry.metadata, status: 'completed' } })
  return result
}
```

---

## 12. Facility Settings Schema

```jsonc
// facilities.settings JSONB
{
  "branding": {
    "name": "Greenfield Pharmacy",
    "logo_url": "https://storage.medisyn.ca/facilities/{id}/logo.png",
    "primary_color": "#1677A8",
    "secondary_color": "#F2C14E",
    "favicon_url": null
  },
  "business_rules": {
    "appointment_duration_minutes": 30,
    "cancellation_notice_hours": 24,
    "max_daily_appointments": 50,
    "timezone": "America/Toronto"
  },
  "api": {
    "allowed_origins": ["https://greenfieldpharmacy.com"],
    "webhook_url": "https://greenfieldpharmacy.com/api/webhooks/medisyn",
    "webhook_secret_hash": "<argon2-hash>"  // stored hashed, never plaintext
  },
  "locale": {
    "currency": "CAD",
    "province": "ON",
    "language": "en"
  }
}
```

---

## 13. Request Lifecycle — Canonical Pattern

### 13.1 Two Stages: Middleware Chain, then Tenant Transaction

The request lifecycle has two distinct stages. They must not be conflated.

**Stage 1 — Auth middleware chain (no DB transaction open):**
Auth, revocation, and permission checks run as standard Express middleware. No tenant-scoped DB transaction is open during these checks. These middleware run queries outside a transaction against the `db` pool (regular `app_user` role, but no `set_config` yet — only `users` and `sessions` tables are queried, which are not RLS-scoped by `facility_id`).

**Stage 2 — Route handler, wrapped by `withTenantContext()`:**
The route handler is wrapped by `withTenantContext()` (defined in `lib/tenant-context.ts`, §5.2). This wrapper opens a single Drizzle transaction, sets `app.current_facility_id` via `set_config(..., true)`, runs the handler, and commits or rolls back. All facility-scoped DB queries within the handler use the transaction object `tx` passed by the wrapper.

This is the **one canonical pattern**. There is no "open transaction in middleware and pass it forward" pattern. The transaction always opens inside `withTenantContext()`.

### 13.2 Full Request Flow

```
Incoming request
  │
  ├─── STAGE 1: Auth Middleware (no transaction, no set_config)
  │
  ├── 1. parseJWT() or parseAPIKey()
  │       → JWT: verify signature, check exp, extract sub/sessionId/facilityId/authVersion/iat/permissions/modules
  │       → API key: extract prefix → verify Argon2 hash → load facilityId + scopes from DB
  │       → failure: 401 UNAUTHORIZED / 401 TOKEN_EXPIRED
  │
  ├── 2. checkSessionRevocation()
  │       → Redis: check revoked_session:{sessionId}, user_revoked_since:{userId}, facility_revoked_since:{facilityId}
  │       → Redis unavailable: fall back to DB check
  │       → Both unavailable: 503 AUTH_STORE_UNAVAILABLE  (fail closed)
  │       → revoked: 401 SESSION_REVOKED
  │
  ├── 3. verifyAuthVersion()
  │       → Redis: get auth:version:{userId}  (60s TTL cache)
  │       → Redis miss or unavailable: DB lookup → re-cache if Redis recovers
  │       → Both unavailable: 503 AUTH_STORE_UNAVAILABLE  (fail closed)
  │       → JWT.authVersion < current: 401 TOKEN_STALE
  │
  ├── 4. checkFacilityStatus()
  │       → if facility.status == 'suspended': 403 FACILITY_SUSPENDED
  │
  ├── 5. requireModule('ecommerce')         [applied per-route]
  │       → check JWT.modules or API key scopes includes module
  │       → 403 MODULE_NOT_AVAILABLE
  │
  ├── 6. requirePermission('ecommerce:product:create')   [applied per-route]
  │       → check JWT.permissions or API key scopes
  │       → 403 INSUFFICIENT_PERMISSIONS
  │
  ├── 7. requireFeatureFlag('ecommerce', 'coupons')      [applied per-route, optional]
  │       → load effective flags: plan_modules.feature_flags merged with facility_module_overrides
  │       → 403 FEATURE_NOT_AVAILABLE
  │
  └─── STAGE 2: Route Handler (wrapped by withTenantContext())
  │
  └── withTenantContext(req.auth.facilityId, async (tx) => {
          │
          ├── SELECT set_config('app.current_facility_id', facilityId, true)
          │   (transaction-local — cleared automatically on commit or rollback)
          │
          ├── handler executes
          │   → all queries use tx (Drizzle transaction object)
          │   → RLS policy current_facility_id() returns facilityId from set_config
          │   → audit log written for sensitive operations (uses separate write connection — not tx)
          │
          └── transaction commits or rolls back
      })

  Super admin routes: use superAdminDb (BYPASSRLS role) inside withSuperAdminContext()
  API key routes: facilityId loaded during step 1, same withTenantContext() applies
```

### 13.3 `withTenantContext()` Reference

Defined once in `lib/tenant-context.ts`. Used as a route handler wrapper — not as standalone middleware.

```typescript
// lib/tenant-context.ts
export function withTenantContext(
  facilityId: string,
  fn: (tx: DrizzleTransaction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_facility_id', ${facilityId}, true)`)
        await fn(tx)
      })
    } catch (err) {
      next(err)
    }
  }
}

// Route definition example
router.post(
  '/products',
  requireModule('ecommerce'),
  requirePermission('ecommerce:product:create'),
  (req, res, next) => withTenantContext(req.auth.facilityId, async (tx) => {
    const product = await productService.create(tx, req.body)
    res.json(product)
  })(req, res, next)
)
```

Services receive `tx` as their first argument and never open their own transactions. All DB access within a request goes through the single transaction opened by `withTenantContext()`.

---

## 14. Backend Module Folder Structure

```
backend/src/
├── core/
│   ├── auth/              ← JWT, login, register, password reset, refresh tokens
│   ├── users/             ← user CRUD, auth_version management
│   ├── facilities/        ← facility onboarding, settings, API keys
│   ├── plans/             ← subscription plans, plan_modules, entitlements
│   ├── modules/           ← platform_modules registry, feature flag resolution
│   ├── rbac/              ← roles, permissions, role_permissions, facility_users
│   ├── audit/             ← audit_log write service
│   └── super-admin/       ← ONLY module that imports superAdminDb
│
├── modules/
│   ├── ecommerce/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── coupons/
│   │   └── permissions.seed.ts
│   ├── stock_management/
│   ├── prescriptions/
│   ├── compounding/
│   ├── appointments/
│   ├── ask_pharmacist/
│   ├── minor_ailments/
│   ├── analytics/
│   └── webhooks/
│
├── db/
│   ├── schema/            ← Drizzle schema files (one per module)
│   ├── migrations/        ← Drizzle migration files
│   ├── seeds/             ← platform_modules, permissions seeds
│   └── rls/               ← SQL files: current_facility_id() + per-table RLS policies
│
├── lib/
│   ├── tenant-context.ts  ← withTenantContext() wrapper
│   ├── feature-flags.ts   ← getModuleFlags() helper
│   ├── audit.ts           ← writeAuditLog(), auditAndExecute()
│   ├── mailer.ts
│   ├── storage.ts         ← S3-compatible abstraction
│   ├── queue.ts           ← BullMQ
│   └── redis.ts           ← Redis client
│
└── app.ts
```

---

## 15. Admin Panel (Multi-Tenant UI)

Single app at `admin.vtechmed.ca (TBD — confirm domain)`. Role in JWT determines the view.

```
Super Admin navigation:
  /super-admin/facilities/        ← list, onboard, suspend, view details
  /super-admin/plans/             ← manage plans, modules, feature flags
  /super-admin/entitlements/      ← manage quantitative limits per plan
  /super-admin/audit-log/         ← cross-facility audit log
  /super-admin/settings/          ← platform settings

Facility Admin navigation (module-gated by JWT.modules):
  /dashboard/
  /staff/                         ← invite, assign roles, suspend
  /roles/                         ← create roles, assign permissions
  /settings/                      ← branding, business rules, API keys
  /subscription/                  ← current plan, upgrade request
  /ecommerce/...                  ← visible only if module active
  /stock/...
  /prescriptions/...
  /compounding/...
  /appointments/...
  /analytics/...
```

Navigation is built dynamically from `JWT.modules` — modules not in the plan are not rendered and routes return 403 if accessed directly.

---

## 16. Subscription Plans — Example Tiers

Plans are data-driven — this table illustrates intent, not hardcoded behaviour.

| Module / Feature | Starter | Growth | Enterprise |
|---|:---:|:---:|:---:|
| Core (auth, dashboard, users, settings) | ✓ | ✓ | ✓ |
| Prescriptions | ✓ | ✓ | ✓ |
| Ask Pharmacist | ✓ | ✓ | ✓ |
| Minor Ailments | — | ✓ | ✓ |
| Appointments | — | ✓ | ✓ |
| Ecommerce | — | ✓ | ✓ |
| Stock Management | — | ✓ | ✓ |
| Compounding | — | — | ✓ |
| Analytics (basic) | — | ✓ | ✓ |
| Analytics (full + exports) | — | — | ✓ |
| Webhooks + API Keys | — | — | ✓ |
| Coupons (ecommerce feature flag) | — | — | ✓ |
| Bulk product import (ecommerce flag) | — | — | ✓ |
| Custom branding | logo | logo + colors | full |
| Staff seats | 5 | 20 | unlimited |
| API requests/day | 1,000 | 10,000 | unlimited |
| Storage | 5 GB | 50 GB | unlimited |

---

## 17. Phase Plan

| Phase | Focus | Key Deliverables |
|---|---|---|
| **1** | Foundation + Tenant Isolation | PostgreSQL setup, Drizzle schema (core tables), `current_facility_id()` function, RLS policies on all core tables, two DB roles, two connection pools, `withTenantContext()`, cross-tenant isolation tests passing |
| **2** | Auth + Users | JWT (facility user + super admin), `auth_version`, login, register, email verify, password reset, refresh tokens, `verifyAuthVersion` middleware |
| **3** | Platform + Plans | `platform_modules` seed, subscription plans CRUD, `plan_modules`, `plan_entitlements`, facility onboarding |
| **4** | RBAC | `permissions` seed per module, `facility_roles`, `role_permissions`, permission middleware, JWT permission embedding |
| **5** | Feature Flags + Entitlements | `getModuleFlags()`, flag resolution, `requireModule`, `requireFeatureFlag`, entitlement enforcement helpers |
| **6** | Audit Logging | `audit_log` table, `writeAuditLog()`, `auditAndExecute()`, mandatory event instrumentation for Phase 1–5 operations |
| **7** | Super Admin Panel | Facility management UI, plan management, module/feature flag overrides, entitlement overrides, audit log viewer |
| **8** | Facility Admin Shell | Multi-tenant admin shell, module-gated nav, staff management, role/permission UI |
| **9** | Ecommerce Module | Products, categories, cart, orders, coupons — facility-scoped, feature-flagged |
| **10** | Stock Management | Inventory, movements, low-stock alerts, expiry |
| **11** | Healthcare Modules | Prescriptions, compounding, ask-pharmacist, minor ailments, appointments (patient_profile required first) |
| **12** | Analytics | Per-facility sales, orders, patients, date range |
| **13** | Webhooks + API Keys | API key management UI, key lifecycle, webhook delivery |
| **14** | Hardening | Rate limiting per plan, security audit, OpenAPI docs, integration test coverage |

---

## 18. Phase 1 Acceptance Criteria

Phase 2 does not begin until every item below passes.

### Tenant Isolation (automated tests required)

- [ ] Facility A cannot SELECT rows belonging to Facility B
- [ ] Facility A cannot UPDATE rows belonging to Facility B
- [ ] Facility A cannot DELETE rows belonging to Facility B
- [ ] Missing tenant context raises `MISSING_TENANT_CONTEXT` exception (not silent empty result)
- [ ] Invalid (non-UUID) tenant context raises `INVALID_TENANT_CONTEXT` exception
- [ ] RLS is enabled on every facility-scoped table (schema inspection test: `SELECT tablename FROM pg_tables WHERE rowsecurity = true`)
- [ ] `withTenantContext()` uses `set_config(..., true)` (transaction-local, verified in test)
- [ ] Tenant context does not persist across sequential requests on the same pool connection

### Super Admin

- [ ] `superAdminDb` is only importable from `src/core/super-admin/`
- [ ] ESLint rule enforcing the above import restriction is configured and passing in CI
- [ ] Super admin requests use the `app_super_admin` DB role (verified by `SELECT current_user` in a test)
- [ ] Every super admin DB operation writes an `audit_log` entry before execution

### Audit Log

- [ ] `audit_log` table is append-only (no UPDATE or DELETE permissions granted to `app_user`)
- [ ] Facility suspension writes an audit entry
- [ ] Auth version increment writes an audit entry with the triggering event recorded in `metadata`

### Authorization Failures

- [ ] Request with no JWT returns `401 UNAUTHORIZED`
- [ ] Request with expired JWT returns `401 TOKEN_EXPIRED`
- [ ] Request with stale `authVersion` returns `401 TOKEN_STALE`
- [ ] Request to a route requiring a module the facility does not have returns `403 MODULE_NOT_AVAILABLE`
- [ ] Request to a suspended facility returns `403 FACILITY_SUSPENDED`

### Session Revocation (automated tests required — Phase 2 gate)

- [ ] Revoke one session → that session returns `401 SESSION_REVOKED` on next request
- [ ] Another active session for the same user continues to work after the first is revoked
- [ ] `revokeAllUserSessions()` → all sessions for that user return `401 SESSION_REVOKED`
- [ ] `revokeAllFacilitySessions()` → all facility sessions return `401 SESSION_REVOKED`
- [ ] A revoked refresh token cannot be exchanged for a new access token (`401 REFRESH_TOKEN_REVOKED`)
- [ ] Password reset calls `revokeAllUserSessions()` — existing sessions are invalid after reset
- [ ] Suspended user cannot authenticate using an existing session (`401 SESSION_REVOKED`)
- [ ] Redis unavailable during revocation check → falls back to DB → result is the same pass/fail
- [ ] Redis and DB both unavailable → `503 AUTH_STORE_UNAVAILABLE` (fail closed — request rejected)
- [ ] An audit log entry is written for every revocation operation (single, all-user, all-facility)

### Transaction Isolation (canonical pattern — Phase 1 gate)

- [ ] `withTenantContext()` is the only place `set_config('app.current_facility_id', ...)` is called
- [ ] No route handler opens a Drizzle transaction directly without going through `withTenantContext()`
- [ ] Auth middleware steps 1–7 execute before the transaction opens (verified by test that checks no `set_config` runs during middleware)
- [ ] Services receive `tx` as a parameter — they do not import `db` directly

---

## 19. Remaining Open Decisions

Items that require explicit confirmation before the relevant phase begins.

| # | Decision | Needed by |
|---|---|---|
| 1 | A user can belong to **multiple facilities** (e.g. a contractor at two pharmacies)? The schema supports it (`UNIQUE(user_id, facility_id)` — not `UNIQUE(user_id)`). Confirm this is intentional. | Phase 2 |
| 2 | Self-serve plan upgrade in admin panel, or **super admin manually assigns plans** for now? | Phase 7 |
| 3 | Existing `admin/` codebase — **refactor** into multi-tenant model or **rebuild fresh**? | Phase 7 |
| 4 | Existing `frontend/` (medisyn.ca) — keep as reference implementation, repurpose, or **deprecate**? | Phase 9+ |
| 5 | `health_card_number` encryption key management: **env variable** for now, or a managed KMS from the start? | Phase 11 |
| 6 | Audit log retention period — how long should audit records be kept before archival or deletion? | Phase 6 |
| 7 | Minor ailment list and vaccine list — **configurable per facility** in the DB (as per architecture), or a global platform list with facility opt-in? | Phase 11 |
| 8 | API key format — confirm `msy_` prefix convention for all Vtech-Med-issued keys (helps distinguish from other credentials in logs). | Phase 13 |

---

## 20. Risks to Explicitly Accept Before Implementation

| # | Risk | Severity | Mitigation in architecture |
|---|---|---|---|
| **R1** | **RLS bypass via session-level config** — if a developer uses `SET SESSION` or `set_config(..., false)` instead of the transaction-local form, tenant context leaks to the next request on the same pool connection. | Critical | `withTenantContext()` wrapper enforces the correct form. Code review + lint rule to detect raw `SET SESSION` usage. |
| **R2** | **`superAdminDb` misuse** — if the ESLint import restriction is not enforced in CI, a developer could import `superAdminDb` in a regular route and bypass RLS entirely. | Critical | ESLint rule + CI gate. Rule must fail the build if violated. Accept that enforcement depends on CI being authoritative. |
| **R3** | **JWT stale during 60-second Redis cache window** — after a role change or suspension, up to 60 seconds of requests may still pass with old permissions before the cache expires. | Medium | 60s is the chosen trade-off. For immediate invalidation (suspension), `redis.del` is called synchronously alongside the DB write. For session revocation (suspension/logout), the session revocation check takes effect immediately regardless of the auth_version cache window. Accept the 60s window for non-suspension permission changes only. |
| **R4** | **health_card_number plaintext in application memory** — decrypted health card numbers exist in memory during request processing and may appear in error logs or APM traces if not masked. | High | Masking in error handlers must be applied before Phase 11. This risk must be accepted as a known gap between Phase 6 (audit) and Phase 11 (PHI handling) and explicitly revisited. |
| **R5** | **Argon2 hashing cost for API key verification** — Argon2 is intentionally slow. Under high API key request volume, verification latency may become a bottleneck. | Low-Medium | Rate limiting via Redis reduces total verification calls. If needed, a short-lived Redis cache of `key_prefix → verified_at` can reduce Argon2 calls (with a short TTL). Accept for now; revisit in Phase 14 hardening. |
| **R6** | **Patient identity is facility-scoped — no cross-facility linking** — a patient who uses two different facilities on the platform will have two separate accounts and two separate records. If the product later requires cross-facility patient identity, it is a significant migration. | Medium | This is the explicit, confirmed decision. Accept that cross-facility patient linking is a future feature requiring separate architecture work and patient consent management. |
| **R7** | **Audit log is not tamper-evident** — the `audit_log` table is append-only by permission, but the DB admin (super admin DB role) can still delete rows directly. | Low | Acceptable for an application-level audit log. If regulatory compliance later requires tamper-evident logs (e.g., hash chaining or write-once storage), that is a Phase 14+ item. Accept the current level as sufficient for MVP. |
| **R8** | **Redis is a P0 availability dependency** — Redis unavailability causes all auth checks to fall back to PostgreSQL. For short outages (seconds), the DB handles the load. For extended outages (minutes+), DB auth query volume increases significantly and may affect overall platform latency. | High | Redis must be treated as a critical infrastructure component, not a cache. Monitor Redis availability as P0. Ensure Redis has replication and persistence configured. Accept that Redis downtime = degraded auth performance; the system remains correct (fail-closed) but slower. |
| **R9** | **Argon2 cost for API key verification may become a latency bottleneck** at high API key request volume. | Low-Medium | Rate limiting via Redis reduces total verification calls. A short-lived Redis cache of `key_prefix → verified_at` (with a 60s TTL) can reduce Argon2 calls if needed. Accept for MVP; add the Redis verification cache in Phase 14 hardening if latency targets are not met. |

---

## 21. Confirmed Decisions (as of 2026-10-06)

| Decision | Status |
|---|---|
| Vtech-Med is the platform name; MediSyn is one facility (tenant) on it | CONFIRMED |
| Pharmacies, clinics, health networks are facilities (tenants) | CONFIRMED |
| PostgreSQL replaces MongoDB | CONFIRMED |
| Drizzle ORM | CONFIRMED |
| Shared DB, `facility_id` on every facility-scoped table | CONFIRMED |
| PostgreSQL RLS is the primary DB-level isolation mechanism | CONFIRMED |
| RLS fails closed — missing/invalid context raises exception | CONFIRMED |
| Two DB roles: `app_user` (RLS), `app_super_admin` (BYPASSRLS) | CONFIRMED |
| Two connection pools: one per DB role | CONFIRMED |
| Super admin access is audit-gated (write before execute) | CONFIRMED |
| `auth_version` integer for JWT staleness detection | CONFIRMED |
| Redis cache (60s TTL) for auth version check; DB fallback; 503 if both unavailable (fail closed) | CONFIRMED |
| Immediate Redis invalidation on suspension/plan change | CONFIRMED |
| Session revocation: `sessions` table + Redis fast path + DB fallback + fail closed | CONFIRMED |
| `sessionId` in every JWT; sessions table is source of truth for session + refresh token | CONFIRMED |
| `revokeSession()`, `revokeAllUserSessions()`, `revokeAllFacilitySessions()` revocation functions | CONFIRMED |
| Password reset triggers `revokeAllUserSessions()` | CONFIRMED |
| Account/facility suspension triggers revocation of all associated sessions | CONFIRMED |
| Long-running jobs store session context and check revocation at batch checkpoints | CONFIRMED |
| Canonical transaction pattern: auth middleware runs outside transaction; `withTenantContext()` wraps handler | CONFIRMED |
| Services receive `tx` as a parameter — they do not import `db` directly | CONFIRMED |
| API keys separate from JWT human auth | CONFIRMED |
| CORS is not authentication | CONFIRMED |
| Patients are authenticated platform users — `users` table + `patient` role in `facility_users` | CONFIRMED |
| Patient identity is facility-scoped (no cross-facility linking) | CONFIRMED |
| `health_card_number` encrypted at application layer (AES-256-GCM) | CONFIRMED |
| `audit_log` has RLS: `app_user` reads own facility only; `app_super_admin` bypasses RLS | CONFIRMED |
| `audit_log` is append-only (UPDATE/DELETE revoked for all application roles) | CONFIRMED |
| Plan entitlements are DB-driven (not hardcoded) | CONFIRMED |
| Payment gateway is out of scope | CONFIRMED |
| Monorepo: `frontend/`, `backend/`, `admin/` — all independent apps | CONFIRMED |
| No microservices, no separate DBs per tenant | CONFIRMED |
| Stack: Express + PostgreSQL + Drizzle + Redis + Next.js | CONFIRMED |

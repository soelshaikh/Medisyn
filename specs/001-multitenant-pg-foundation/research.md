# Phase 0 Research: Multi-Tenant Platform Foundation

**Feature**: `001-multitenant-pg-foundation` | **Date**: 2026-10-06

All architectural decisions for this feature were confirmed prior to spec-kit workflow
execution (Architecture V2.1, 2026-10-06). No NEEDS CLARIFICATION items remain from the
spec. This document records the rationale for each decision so implementation choices are
traceable, not just prescribed.

---

## Decision 1: PostgreSQL RLS vs Application-Layer Filtering

**Decision**: Use PostgreSQL Row-Level Security on all facility-scoped tables, with a
`current_facility_id()` function that raises an exception when context is absent.

**Rationale**: Application-layer filtering is only as correct as every query author. A
single missed WHERE clause exposes cross-tenant data. RLS is enforced by the engine
regardless of application code correctness — it is the audit-proof safety net, not the
only filter. The `current_facility_id()` function raising an exception (vs. returning NULL)
is the fail-closed behaviour: the system must never silently return empty rows when context
is missing, because that is indistinguishable from "no records exist for this tenant."

**Alternatives considered**:
- Application-layer `WHERE facility_id = ?` on every query — rejected: one missing WHERE
  exposes PHI; no audit mechanism; cannot prevent future authors from bypassing.
- Separate PostgreSQL schema per tenant — rejected: operational complexity at 100+ tenants
  is prohibitive; migrations must run N times; backup/restore becomes fragmented.
- Separate database per tenant — rejected: connection pool overhead, backup, and DevOps
  burden don't justify the isolation for the current scale.

---

## Decision 2: `set_config('app.current_facility_id', value, true)` vs `SET LOCAL`

**Decision**: Use `SELECT set_config('app.current_facility_id', $1, true)` inside a Drizzle
transaction to set per-transaction tenant context. The third argument `true` scopes the
setting to the current transaction. This is the transaction-local form, equivalent to
`SET LOCAL` for custom parameters.

**Rationale**: PgBouncer in transaction mode reuses connections across requests. A
session-level `set_config(..., false)` or `SET SESSION app.current_facility_id = ...`
would persist tenant context across connection reuse, allowing Tenant B's request to see
Tenant A's data if it lands on the same connection. `true` (transaction-local) guarantees
the setting is cleared when the transaction commits or rolls back — safe for connection
pooling.

**Alternatives considered**:
- `SET LOCAL` — equivalent semantics for custom parameters when inside a transaction, but
  `set_config(key, value, true)` is more explicit and testable via `current_setting()`.
- Session-level `set_config(..., false)` — rejected: leaks tenant context across PgBouncer
  connection reuse. Critical defect if used.
- Per-connection pools per tenant — rejected: 100 tenants × 10 connections = 1000 min
  connections; unworkable at scale.

---

## Decision 3: Two DB Roles + Two Connection Pools

**Decision**: Create two PostgreSQL roles: `app_user` (all regular requests, RLS enforced)
and `app_super_admin` (BYPASSRLS, cross-facility super admin operations only). Two
corresponding connection pools in the Node.js process. The `superAdminDb` pool is
importable only from `src/core/super-admin/`.

**Rationale**: If `app_user` accidentally executes a cross-facility query (e.g., missing
`withTenantContext()`), RLS raises an error — the data is never returned. The
`app_super_admin` role is a deliberate, auditable escalation path, not a fallback. The
ESLint import restriction ensures no developer accidentally uses `superAdminDb` outside
the super-admin module — the restriction is enforced in CI, not by convention.

**Alternatives considered**:
- Single DB role with BYPASSRLS — rejected: removes all engine-level isolation; application
  code becomes the sole isolation mechanism.
- Dynamic `SET ROLE` per request — rejected: stateful within the connection; incompatible
  with PgBouncer transaction mode if role context leaks.

---

## Decision 4: Drizzle ORM over Prisma / TypeORM / raw SQL

**Decision**: Drizzle ORM with postgres.js driver for both pools.

**Rationale**: Drizzle is the only TypeScript-first ORM that exposes the raw SQL transaction
object (needed to call `set_config` as the first statement in a transaction). Prisma uses
a connection proxy that abstracts the underlying connection — setting a PostgreSQL
configuration variable before Prisma's first query is either unsupported or implementation-
dependent. Drizzle's `db.transaction((tx) => tx.execute(sql\`...\`))` pattern gives
explicit, typed control. Drizzle also supports `drizzle-kit` for migrations with no
additional tooling.

**Alternatives considered**:
- Prisma — rejected: connection abstraction makes transaction-local `set_config` unreliable;
  Prisma generates queries internally and the entry point for raw SQL within a transaction
  is awkward.
- TypeORM — rejected: active-record pattern encourages services importing `Repository`
  directly rather than receiving `tx`; difficult to enforce canonical transaction pattern.
- Raw `pg` / `postgres.js` — valid, but Drizzle adds TypeScript-level schema validation,
  migration tooling, and typed query builders without giving up transaction control.

---

## Decision 5: Redis Fallback Semantics for auth_version and Session Revocation

**Decision**: Both auth_version checks and session revocation checks use the same fallback
chain: Redis (60s TTL for auth_version, immediate for revocation) → PostgreSQL → 503 if
both unavailable (fail-closed). Neither check may be skipped.

**Rationale**: Redis being unavailable is a degraded-performance event, not a security
event. The fallback to PostgreSQL ensures the platform continues functioning — just slower.
If PostgreSQL is also unavailable, the system cannot confirm the revocation state of any
session. Accepting sessions without confirmation would allow suspended users or revoked
tokens to remain active. 503 is the correct response: "I cannot verify you right now."

The auth_version counter on the users table allows bulk permission invalidation without
revoking individual sessions. When a role changes, the auth_version is incremented.
Every auth check compares the JWT's cached `authVersion` claim to the current value.

**Alternatives considered**:
- Accept sessions during Redis outage without DB fallback — rejected: violates fail-closed
  principle. Sessions revoked during the outage would remain active.
- Accept sessions during DB+Redis outage (fail-open) — rejected: PHI access must never be
  accepted on unverifiable credentials. 503 is preferable to a data breach.

---

## Decision 6: Audit Log Append-Only Enforcement via REVOKE

**Decision**: REVOKE UPDATE and DELETE on `audit_log` from both `app_user` and
`app_super_admin`. Audit records are INSERT-only. The table has RLS: `app_user` can only
SELECT and INSERT their own facility's records. `app_super_admin` bypasses RLS (can read
all facilities' audit records).

**Rationale**: Audit log integrity is meaningless if records can be modified or deleted,
even by super admins. Database-level REVOKE is the only mechanism that survives application
code bugs, accidental queries, or a compromised super admin session. The pre-execution
audit write for super admin operations (written before the operation, not after) means even
a super admin who modifies a record post-operation cannot erase the evidence.

**Alternatives considered**:
- Application-level append-only enforcement — rejected: any future developer can add a
  `DELETE FROM audit_log` query; no DB-level protection.
- Separate write-only audit database — out of scope; adds operational complexity for Phase 1.
- Time-partitioned audit tables with cold archive — future consideration (Phase 10+).

---

## Decision 7: Subscription Plan + Module + Feature Flag Three-Layer Model

**Decision**: Three layers of access control above RBAC:
1. `plan_modules` — which modules are included in a subscription plan
2. `facility_module_overrides` — super admin overrides per facility (add or remove modules
   from plan defaults)
3. `facility_entitlement_overrides` + `plan_entitlements` — quantitative limits

**Rationale**: The business model requires facilities to subscribe to plans that bundle
modules. A Starter plan may include prescriptions but not ecommerce. A Growth plan adds
ecommerce. Super admins need to override this for trials, special agreements, or
troubleshooting. Quantitative limits (seat counts, API quota) are plan-level defaults with
per-facility overrides. The three-layer model is data-driven — changing a plan or override
takes effect immediately for the next request, with no code deployment.

**Alternatives considered**:
- Hardcoded role checks per module — rejected: cannot add new plans or change module
  bundling without code changes; violates the "configurable via data" requirement (FR-008).
- Feature flags only (no plan model) — rejected: cannot represent the subscription/billing
  concept of plan tiers with module bundling.

---

## Decision 8: Vitest + Real Database for Isolation Tests (No Mocks)

**Decision**: All Phase 1 gate tests run against a real PostgreSQL instance with real RLS
policies applied. No in-memory mocks of the database layer for isolation tests.

**Rationale**: The spec explicitly states this: "Automated tests are written with Vitest
and run against a real database instance — not mocked. Mock-based isolation tests would
not satisfy the Phase 1 gate." A mock that bypasses RLS entirely cannot test that RLS is
correctly configured. Only a real DB with real policies can verify that a query as
`app_user` cannot see another tenant's rows.

**Alternatives considered**:
- Mocked DB layer — rejected: would test application-layer filters only, not RLS policies.
  The Phase 1 gate requires engine-level verification.
- Testcontainers — valid approach; Docker Compose (simpler, no extra dependency) is
  preferred for local dev. CI can use either.

---

## Summary: No NEEDS CLARIFICATION Items

All questions from the spec are resolved by Architecture V2.1 confirmed decisions.
The implementation may proceed directly to Phase 1 design artifacts.

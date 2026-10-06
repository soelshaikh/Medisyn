<!--
SYNC IMPACT REPORT (remove before committing)
=============================================
Version change: [blank template] → 1.0.0
Added sections:
  - Core Principles (I–V)
  - Security & Compliance Constraints
  - Development Workflow
  - Governance
Modified principles: N/A (initial population)
Removed sections: N/A (initial population)
Follow-up TODOs: None — all placeholders resolved from Architecture V2.1
-->

# Vtech-Med Platform Constitution

## Core Principles

### I. Tenant Isolation is Non-Negotiable

Every database query against a facility-scoped table MUST execute inside `withTenantContext()`,
which opens a Drizzle transaction and sets `app.current_facility_id` via
`SELECT set_config('app.current_facility_id', facilityId, true)` (transaction-local only —
never session-level). PostgreSQL Row-Level Security enforces isolation at the engine level.
The `current_facility_id()` DB function MUST raise an exception — not return empty rows —
when context is missing or malformed (fail closed). Cross-facility access is only permitted
through the `app_super_admin` DB role (BYPASSRLS) via the `superAdminDb` connection pool,
which is importable exclusively from `src/core/super-admin/`. This restriction is enforced
by an ESLint import rule that must pass in CI. Violating tenant isolation is a critical defect
that blocks merge regardless of feature completeness.

### II. Explicit Authorization at Every Request

Every authenticated request MUST pass ALL of the following checks in order before any
facility-scoped DB transaction opens:
1. JWT signature + expiry verification
2. Session revocation check (Redis → DB fallback → 503 if both unavailable)
3. Auth-version staleness check (Redis 60s TTL → DB fallback → 503 if both unavailable)
4. Facility status check (suspended → 403)
5. Module entitlement check (plan + overrides)
6. Permission check (RBAC role → permissions)
7. Feature-flag check (per-route, where applicable)

No middleware step may be skipped for convenience. Authorization checks are additive —
they are never removed or combined. Redis unavailability MUST fall back to PostgreSQL for
both session and auth-version checks. If PostgreSQL is also unavailable, the system returns
503 SERVICE_UNAVAILABLE. The system never accepts a request whose revocation or
authorization state cannot be confirmed.

### III. PostgreSQL is the Source of Truth — Redis is a Cache

PostgreSQL holds all durable state: session records, auth versions, revocation state,
tenant data, audit log. Redis holds only performance caches and fast-path revocation flags.
Every Redis key has a defined TTL. No system behavior may depend on Redis being populated —
all Redis reads MUST have a PostgreSQL fallback. Redis downtime is a degraded-performance
event, not a data-loss event. The `audit_log` table is append-only: UPDATE and DELETE
permissions are revoked for all application roles.

### IV. Audit All Security-Sensitive Operations

The following categories MUST be written to `audit_log` without exception:
PHI access (patient_profile reads, health_card_number decryption, prescription file downloads),
all auth events (login success/fail, logout, password reset, token refresh, email verify),
all session revocation events (single, all-user, all-facility),
all permission and role changes,
all super admin cross-facility operations (written BEFORE execution),
all API key lifecycle events (create, revoke, rotate),
all subscription and module changes,
all data exports,
all facility suspension/reactivation events.

Audit writes for super admin operations MUST complete before the operation executes.
The `audit_log` table has RLS: `app_user` can SELECT and INSERT only their own facility's
records; `app_super_admin` bypasses RLS. No application role has UPDATE or DELETE on
`audit_log`.

### V. Phase-Gated, Architecture-First Development

No phase begins until the predecessor phase's acceptance criteria are fully green (automated
tests passing, not manual sign-off). Architecture decisions live in
`docs/MediSyn_SaaS_Platform_Architecture_V2.md` — this document is the authoritative source
of truth for all design decisions. Material decisions (security, tenant isolation, patient
identity, billing, authorization semantics) MUST be flagged for confirmation and recorded
as CONFIRMED in the architecture document before implementation. Decisions are never made
silently. The spec-kit workflow (specify → plan → tasks → implement) MUST be used before
beginning any significant feature implementation.

## Security & Compliance Constraints

**Stack (locked):** Express.js + PostgreSQL + Drizzle ORM + PgBouncer (transaction mode) +
Redis + BullMQ + Next.js (admin panel + frontend). No microservices. No separate databases
per tenant. No Kubernetes. These are confirmed architectural constraints — not open for
per-feature reconsideration.

**Connection pooling:** PgBouncer in transaction mode. Tenant context set exclusively via
`set_config('app.current_facility_id', value, true)` (transaction-local). `SET SESSION` and
`set_config(..., false)` are prohibited — their use is a critical defect.

**DB roles:** Two PostgreSQL roles — `app_user` (RLS enforced, all regular requests) and
`app_super_admin` (BYPASSRLS, cross-facility super admin operations only). Two separate
connection pools. The `superAdminDb` pool is only accessible from `src/core/super-admin/`.

**PHI handling:** `health_card_number` and other PHI fields are encrypted at the application
layer using AES-256-GCM. The database stores ciphertext only — it cannot decrypt PHI.
PHI MUST be masked in error handlers, logs, and APM traces before any healthcare module
ships (Phase 11 gate).

**CORS:** CORS (`Access-Control-Allow-Origin`) is a browser-enforcement mechanism only.
It is not an authentication or authorization control. All server-side auth applies to every
request regardless of origin.

**Payments:** Online payment gateway is out of scope for all current phases.

**Patient identity:** Patients are authenticated platform users (row in `users` table, row
in `facility_users` with `patient` role). Patient identity is facility-scoped — no
cross-facility patient linking. This decision requires explicit re-architecture if changed.

## Development Workflow

**Decision labelling (CLAUDE.md rule):** Every decision in conversation or documentation
MUST be labelled: CONFIRMED | PROPOSED | OPEN QUESTION | ASSUMPTION. Silently implementing
PROPOSED items as if CONFIRMED is a process violation.

**Worklog rule (CLAUDE.md rule — non-negotiable):** At the end of every session, write
`worklog/YYYY-MM-DD.md` (detailed) and update `worklog.md` (cumulative). Every modified
file, every decision, every bug fix, every deferred item must be recorded.

**Services and transactions:** Services receive `tx` (a Drizzle transaction object) as their
first argument. Services MUST NOT import `db` directly. All facility-scoped DB access goes
through the single transaction opened by `withTenantContext()`. This is the one canonical
pattern — no exceptions.

**spec-kit workflow:** For every significant implementation task, run the spec-kit skills
in order: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
Use `/speckit-clarify` when requirements are ambiguous. Use `/speckit-analyze` after task
generation to verify cross-artifact consistency. Skipping spec-kit for significant tasks
requires explicit user approval.

**RLS coverage:** Every facility-scoped table MUST have `ENABLE ROW LEVEL SECURITY` and a
policy using `current_facility_id()`. RLS coverage is verified by an automated schema
inspection test that is part of the Phase 1 acceptance gate and runs in CI on every PR.

**No guessing:** Material requirements, business rules, and security constraints that are
unclear MUST be raised as OPEN QUESTIONs and answered before implementation. Do not invent
answers to unresolved architectural questions.

## Governance

This constitution supersedes all in-session style preferences, shortcut requests, or
conveniences that conflict with its principles. It applies to every file in every subfolder
of this monorepo (`frontend/`, `backend/`, `admin/`).

**Amendment procedure:**
1. Identify the principle or rule requiring change.
2. Update `docs/MediSyn_SaaS_Platform_Architecture_V2.md` with the new decision (CONFIRMED).
3. Update this constitution file and increment the version number.
4. Record the amendment in `worklog/YYYY-MM-DD.md` with full rationale.
5. Major amendments (security model, tenant isolation, auth architecture) require explicit
   user confirmation before the update is written.

**Versioning policy:**
- MAJOR: Backward-incompatible removal or redefinition of a core security or isolation principle.
- MINOR: New principle or materially expanded guidance added.
- PATCH: Clarifications, wording corrections, non-semantic refinements.

**Phase compliance review:** At each phase gate, verify that all new code complies with
this constitution before the next phase begins. Phase gate tests are automated, not manual.

**Reference documents:**
- Architecture: `docs/MediSyn_SaaS_Platform_Architecture_V2.md`
- Project rules: `CLAUDE.md`
- Running history: `worklog.md` + `worklog/`

**Version**: 1.0.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-06

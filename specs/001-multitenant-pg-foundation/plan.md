# Implementation Plan: Multi-Tenant Platform Foundation

**Branch**: `001-multitenant-pg-foundation` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the existing MongoDB/Mongoose backend with a PostgreSQL + Drizzle foundation that
enforces multi-tenant isolation at the database engine level via Row-Level Security. The
foundation establishes two PostgreSQL roles (regular and super-admin), two connection pools,
a transaction-scoped tenant context mechanism, the full authentication middleware chain
skeleton, and automated cross-tenant isolation tests that gate Phase 2.

## Technical Context

**Language/Version**: TypeScript 5.x strict, Node.js 22.x LTS

**Primary Dependencies**:
- `drizzle-orm` + `drizzle-kit` — ORM and migration tooling
- `postgres` (postgres.js) — PostgreSQL driver (native async, PgBouncer-compatible)
- `ioredis` — Redis client with connection error handling
- `argon2` — password and token hashing
- `jsonwebtoken` — JWT sign/verify
- `zod` — runtime validation
- `vitest` — test runner (integration tests against real DB, no mocks)
- `express` + `@types/express` — HTTP framework
- `helmet`, `cors`, `express-rate-limit` — HTTP hardening

**Storage**: PostgreSQL 16 (primary data store + RLS enforcement), Redis 7 (auth cache)

**Testing**: Vitest with a real PostgreSQL test database — no mocks for isolation tests.
Each test suite creates isolated test facilities and tears down after. The Phase 1 gate
requires all isolation tests to pass against a real DB instance.

**Target Platform**: Linux server, Node.js process. Local dev via Docker Compose
(PostgreSQL + Redis). PgBouncer runs in transaction mode.

**Project Type**: REST API (web service) — backend only for Phase 1.

**Performance Goals**: Authentication middleware chain <50ms p95 (all 7 steps). Connection
pool check-in/check-out <5ms. RLS policy evaluation overhead <2ms per query.

**Constraints**:
- PgBouncer transaction mode — tenant context MUST use `set_config(..., true)` (transaction-
  local). `SET SESSION` is prohibited.
- Redis unavailability MUST fall back to PostgreSQL — never fail open.
- `superAdminDb` importable ONLY from `src/core/super-admin/` (ESLint enforced in CI).
- All facility-scoped tables MUST have RLS enabled — verified by automated schema test.

**Scale/Scope**: Foundation supports 100+ facilities, thousands of concurrent users. Phase 1
establishes the pattern; module-level load is introduced in later phases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Compliant? | Notes |
|---|---|---|
| I. Tenant Isolation Non-Negotiable | ✅ | `withTenantContext()` + RLS + `current_facility_id()` fail-closed. `superAdminDb` import restriction enforced by ESLint. |
| II. Explicit Authorization at Every Request | ✅ | Full 7-step middleware chain scaffolded in Phase 1. Steps 2–7 are stubs; Phase 2 fills them. |
| III. PostgreSQL Source of Truth | ✅ | Redis is cache only. Both auth checks fall back to DB; fail closed (503) if both unavailable. |
| IV. Audit All Security-Sensitive Operations | ✅ | `audit_log` table with RLS + append-only permissions. Super admin pre-execution audit enforced in `superAdminQuery()`. |
| V. Phase-Gated Development | ✅ | All Phase 1 acceptance criteria from Architecture V2.1 §18 are automated tests. Phase 2 blocked until they pass. |

**No violations.** No complexity justification required.

## Project Structure

### Documentation (this feature)

```
specs/001-multitenant-pg-foundation/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── middleware-chain.md
│   ├── tenant-context.md
│   └── db-roles.md
└── tasks.md             ← Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (backend/ only — Phase 1 scope)

```
backend/
├── src/
│   ├── app.ts                         ← Express app factory
│   ├── index.ts                       ← Server entry point
│   ├── core/
│   │   ├── auth/
│   │   │   └── middleware/
│   │   │       ├── parse-jwt.ts       ← Step 1: JWT/API key parse
│   │   │       ├── check-session.ts   ← Step 2: session revocation (stub → Phase 2)
│   │   │       ├── verify-auth-version.ts  ← Step 3: auth_version (stub → Phase 2)
│   │   │       ├── check-facility-status.ts  ← Step 4 (stub → Phase 2)
│   │   │       ├── require-module.ts  ← Step 5 (stub → Phase 2)
│   │   │       └── require-permission.ts  ← Step 6 (stub → Phase 2)
│   │   ├── super-admin/
│   │   │   └── super-admin.service.ts ← Only file importing superAdminDb
│   │   ├── rbac/
│   │   └── audit/
│   │       └── audit.service.ts
│   ├── db/
│   │   ├── index.ts                   ← db + superAdminDb pool exports
│   │   ├── schema/
│   │   │   ├── core.ts                ← users, facilities, sessions
│   │   │   ├── plans.ts               ← subscription_plans, plan_modules, entitlements
│   │   │   ├── rbac.ts                ← permissions, facility_roles, facility_users
│   │   │   ├── audit.ts               ← audit_log
│   │   │   └── patient.ts             ← patient_profiles
│   │   ├── migrations/
│   │   ├── seeds/
│   │   │   └── platform-modules.ts    ← platform_modules + permissions seed
│   │   └── rls/
│   │       ├── current-facility-id.sql
│   │       └── policies.sql           ← RLS policies for all facility-scoped tables
│   └── lib/
│       ├── tenant-context.ts          ← withTenantContext() — canonical pattern
│       ├── redis.ts                   ← Redis client with error handling
│       └── errors.ts                  ← typed error classes
├── tests/
│   ├── isolation/
│   │   ├── cross-tenant.test.ts       ← Phase 1 gate: all §18 isolation tests
│   │   └── rls-coverage.test.ts       ← schema inspection: RLS on every table
│   └── setup/
│       ├── db.ts                      ← test DB setup/teardown helpers
│       └── fixtures.ts                ← facility + user fixture factories
├── .eslintrc.json                     ← superAdminDb import restriction rule
├── docker-compose.yml                 ← PostgreSQL + Redis for local dev/test
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

**Structure Decision**: Single backend project. No frontend work in Phase 1.
All new source code goes into `backend/src/`. Existing MongoDB code is removed entirely
before new code is written.

## Phase 0 Output: Research

**Status**: COMPLETE

`research.md` resolves 8 confirmed architectural decisions. No NEEDS CLARIFICATION items
remain. All decisions were confirmed in Architecture V2.1 (2026-10-06) prior to spec-kit
workflow — research.md records the rationale.

Decisions covered:
1. PostgreSQL RLS over application-layer filtering
2. `set_config(..., true)` vs `SET LOCAL` for PgBouncer compatibility
3. Two DB roles + two connection pools
4. Drizzle ORM selection rationale
5. Redis fail-closed fallback semantics
6. Audit log append-only via REVOKE
7. Three-layer subscription/module/feature-flag model
8. Vitest + real DB (no mocks) for isolation tests

## Phase 1 Output: Design Artifacts

**Status**: COMPLETE

| Artifact | Path | Description |
|---|---|---|
| data-model.md | `specs/001-multitenant-pg-foundation/data-model.md` | 16 tables with fields, relationships, RLS coverage list, validation rules, state transitions |
| contracts/middleware-chain.md | `specs/001-multitenant-pg-foundation/contracts/middleware-chain.md` | 7-step middleware chain: inputs, outputs, failure modes, error codes |
| contracts/tenant-context.md | `specs/001-multitenant-pg-foundation/contracts/tenant-context.md` | `withTenantContext()` behaviour contract, invariants, failure modes |
| contracts/db-roles.md | `specs/001-multitenant-pg-foundation/contracts/db-roles.md` | Two DB roles, two pools, ESLint restriction, PgBouncer compatibility |
| quickstart.md | `specs/001-multitenant-pg-foundation/quickstart.md` | 9-step validation guide, 20 named test cases, Phase 1 gate checklist |

## Constitution Re-Check (Post-Design)

*Re-evaluated after Phase 1 design artifacts are complete.*

| Principle | Status | Evidence |
|---|---|---|
| I. Tenant Isolation | ✅ PASS | `current_facility_id()` raises on missing/invalid context (contracts/tenant-context.md). All 9 facility-scoped tables identified (data-model.md). ESLint rule in contracts/db-roles.md. 10 ISO tests in quickstart.md. |
| II. Explicit Authorization | ✅ PASS | Full 7-step chain with typed failure modes documented (contracts/middleware-chain.md). Phase 2 stubs scaffold the shape; no step is optional. |
| III. PostgreSQL Source of Truth | ✅ PASS | Both Redis fallback chains (session revocation + auth_version) documented with explicit 503 for dual unavailability in contracts/middleware-chain.md steps 2–3. |
| IV. Audit Everything | ✅ PASS | `audit_log` append-only via REVOKE documented in data-model.md + contracts/db-roles.md. Pre-execution audit write in `superAdminQuery()` in contracts/tenant-context.md. AUX tests in quickstart.md. |
| V. Phase-Gated Development | ✅ PASS | quickstart.md §9 gate checklist: 20 named tests (ISO + REV + AUX), ESLint, TypeScript, manual smokes. Phase 2 blocked until all green. |

**No violations found post-design.** Plan is ready for `/speckit-tasks`.

## Complexity Tracking

No constitution violations. Section not required.

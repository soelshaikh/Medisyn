# Implementation Plan: API Hardening

**Branch**: `010-api-hardening` | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-api-hardening/spec.md`

---

## Summary

Harden the MediSyn Express.js backend for production: tighten rate limiting with per-route windows, lock down CORS + Helmet configuration, add OpenAPI/Swagger documentation at `/api/docs`, and establish an integration test suite using Jest + Supertest against an isolated test database.

**Current state (from `backend/src/app.ts`):**
- `express-rate-limit` is already imported — one global limiter at 300 req/15 min (~20/min). Auth-specific and healthcare-specific limiters are missing.
- `helmet()` is called bare — no custom CSP, no explicit HSTS config.
- CORS uses `FRONTEND_URL` + `ADMIN_URL` env vars (two variables, no fail-fast in production).
- Body size limit is already `1mb` ✓
- Error handler already strips stack traces in production ✓
- No Swagger/OpenAPI setup exists.
- No test suite exists.

---

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 20 LTS

**Primary Dependencies (existing)**:
- `express` 4.x — HTTP framework
- `helmet` — security headers (already in use, bare call)
- `cors` — CORS middleware (already in use)
- `express-rate-limit` — rate limiting (already in use, one global limiter)
- `drizzle-orm` + `postgres` (postgres.js) — database ORM

**New Dependencies (this phase)**:
- `swagger-jsdoc` — reads `@openapi` JSDoc comments from route files, generates OpenAPI 3.0 spec object
- `swagger-ui-express` — serves the interactive Swagger UI at `/api/docs`
- `@types/swagger-ui-express` — TypeScript types for swagger-ui-express
- `jest` — test runner
- `ts-jest` — TypeScript transform for Jest
- `supertest` — HTTP assertion library for Express.js integration tests
- `@types/jest` — TypeScript types for Jest
- `@types/supertest` — TypeScript types for supertest

**Storage**: PostgreSQL (Drizzle ORM) — test suite uses a separate `TEST_DATABASE_URL` pointing to an isolated database or schema

**Testing**: Jest + Supertest (integration tests hitting a live test database)

**Target Platform**: Linux server (production), Windows dev (local)

**Performance Goals**: Rate limit responses under 5ms overhead; documentation page loads under 2 seconds

**Constraints**:
- Rate limiter must not break existing auth middleware chain
- CORS change from `FRONTEND_URL`/`ADMIN_URL` to `ALLOWED_ORIGINS` must be backward-compatible during transition (keep both working until env vars are updated)
- OpenAPI annotations added as JSDoc comments — no structural refactoring of existing routers
- Tests must never touch `DATABASE_URL` (production/dev database)

**Scale/Scope**: ~30 REST endpoints across 8 modules; 12–15 integration test cases for MVP

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Tenant Isolation** — rate limiters run before `withTenantContext()`, no tenant data accessed | PASS | Rate limiting is IP-based middleware, no DB queries involved |
| **Explicit Authorization** — rate limiting does not short-circuit or replace auth middleware | PASS | Rate limiters run before auth; auth chain is unchanged — they are additive, not a replacement |
| **PostgreSQL as source of truth** — no new Redis state introduced | PASS | Rate limiter uses in-memory store (default); no Redis state added this phase |
| **Audit logging** — no new security-sensitive operations that bypass audit | PASS | No new data mutations; OpenAPI endpoint is read-only public; test suite writes to isolated DB |
| **Phase-Gated** — spec-kit workflow followed | PASS | specify → plan → tasks → implement in progress |

**Constitution note on CORS**: The constitution explicitly states: "CORS is a browser-enforcement mechanism only. It is not an authentication or authorization control. All server-side auth applies to every request regardless of origin." — strict CORS is for browser clients; it is not a substitute for auth.

**No Complexity Tracking violations** — no new DB role, no additional project, no new isolation boundary.

---

## Project Structure

### Documentation (this feature)

```text
specs/010-api-hardening/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── contracts/           ← Phase 1 output (API test contracts)
├── quickstart.md        ← Phase 1 output (test run guide)
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code Changes

```text
backend/
├── src/
│   ├── app.ts                          ← MODIFY: CORS + Helmet + rate limiters
│   ├── middleware/
│   │   └── rate-limit.ts               ← NEW: per-route limiter factory + auth/healthcare limiters
│   └── lib/
│       └── swagger/
│           ├── swagger.config.ts       ← NEW: swagger-jsdoc config (title, version, servers, securitySchemes)
│           └── swagger.router.ts       ← NEW: mounts swagger-ui-express at GET /api/docs
├── tests/
│   ├── helpers/
│   │   ├── app.helper.ts               ← NEW: createTestApp(), test database setup/teardown
│   │   └── seed.helper.ts              ← NEW: seed a test user + facility for integration tests
│   ├── auth/
│   │   └── login.test.ts               ← NEW: login happy path + wrong credentials 401
│   ├── healthcare/
│   │   └── prescriptions.test.ts       ← NEW: submit prescription happy path + unauth 401
│   ├── commerce/
│   │   └── checkout.test.ts            ← NEW: cart → checkout happy path
│   └── appointments/
│       └── appointments.test.ts        ← NEW: appointment booking happy path
├── jest.config.ts                      ← NEW: jest config (ts-jest, testMatch, setup files)
└── package.json                        ← MODIFY: add new devDeps, add "test" script
```

---

## Complexity Tracking

No constitution violations. No additional section needed.

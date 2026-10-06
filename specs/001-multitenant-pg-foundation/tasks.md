# Tasks: Multi-Tenant Platform Foundation

**Feature**: `001-multitenant-pg-foundation` | **Branch**: `001-multitenant-pg-foundation`

**Input**: `specs/001-multitenant-pg-foundation/` — plan.md, spec.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — test tasks are in-scope per spec.md ("Automated cross-tenant isolation
tests, all Phase 1 acceptance criteria from Architecture V2.1 §18") and quickstart.md (20
named test cases).

**User Stories**:
- **US1** (P1): Facility Data is Completely Isolated — `withTenantContext()` + RLS + ISO tests
- **US2** (P2): Super Admin Can Operate Across Facilities Safely — `superAdminQuery()` + audit + middleware skeleton
- **US3** (P3): Subscription Plans Control Feature Access at Runtime — `requireModule` + `checkFacilityStatus` middleware
- **US4** (P4): Platform Fails Safely Under Adverse Conditions — `checkSessionRevocation` + `verifyAuthVersion` + REV tests

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Clean break from MongoDB, install PostgreSQL stack, configure tooling.
No user story work can begin until setup is complete.

- [x] T001 Remove all MongoDB/Mongoose source files from `backend/src/` — delete all `*.module.ts`, `*.schema.ts`, `*.service.ts`, `*.controller.ts`, `*.dto.ts` files rooted in existing Mongoose modules; preserve only `backend/src/app.ts` and `backend/index.ts` as empty shells
- [x] T002 Replace `backend/package.json` with Phase 1 dependencies: `express`, `drizzle-orm`, `drizzle-kit`, `postgres`, `ioredis`, `argon2`, `jsonwebtoken`, `zod`, `helmet`, `cors`, `express-rate-limit`, `uuid`, `@types/express`, `@types/jsonwebtoken`, `@types/uuid`, `typescript`, `vitest`, `@vitest/coverage-v8`, `tsx`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`; run `npm install`
- [x] T003 [P] Create `backend/tsconfig.json` with `"strict": true`, `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"outDir": "dist"`, `"rootDir": "src"`, `"baseUrl": "."`, `"paths": { "@/*": ["src/*"] }`
- [x] T004 [P] Create `backend/.eslintrc.json` with `no-restricted-imports` rule that blocks importing `superAdminDb` from `@/db` in any file outside `src/core/super-admin/`; add `lint` script to package.json (`eslint "src/**/*.ts"`)
- [x] T005 [P] Create `backend/docker-compose.yml` with PostgreSQL 16 service (port 5432, health check via `pg_isready`, user/password/db from env vars) and Redis 7 service (port 6379, health check via `redis-cli ping`)
- [x] T006 Create `backend/drizzle.config.ts` pointing to `src/db/schema/*.ts` for schema, `src/db/migrations/` for output, using `postgres` dialect; add `db:generate`, `db:migrate`, `db:seed` npm scripts

**Checkpoint**: `npm install` succeeds; `npm run lint` runs without crashing; Docker containers start healthy.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database infrastructure — schema, roles, RLS function, connection pools, Redis,
error types, test helpers, Express skeleton. MUST be complete before ANY user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Create `backend/scripts/create-roles.sql` — DDL for `app_user` (NOLOGIN, NOSUPERUSER), `app_super_admin` (NOLOGIN, BYPASSRLS), login roles `app_user_login` and `app_super_admin_login`, REVOKE public schema defaults, GRANT USAGE on `public` to both roles; document separate `DATABASE_URL` and `DATABASE_SUPER_ADMIN_URL` env vars
- [x] T008 Create `backend/src/db/schema/core.ts` — Drizzle table definitions for `facilities` (id UUID PK, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'active' — enum: `active`|`suspended`|`deactivated`, subscription_plan_id UUID FK, settings JSONB DEFAULT '{}', timestamps), `users` (id UUID PK, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, is_platform_super_admin BOOLEAN DEFAULT false, auth_version INTEGER DEFAULT 1 NOT NULL, email_verified BOOLEAN DEFAULT false, email_verify_token NULLABLE, email_verify_expires_at NULLABLE, password_reset_token NULLABLE, password_reset_expires_at NULLABLE, last_login_at NULLABLE, timestamps), `sessions` (id UUID PK, user_id UUID FK→users ON DELETE CASCADE, facility_id UUID NULLABLE FK→facilities, refresh_token_hash TEXT NOT NULL, user_agent NULLABLE, ip_address NULLABLE, revoked_at TIMESTAMPTZ NULLABLE, revoked_reason TEXT NULLABLE — enum: `user_logout`|`admin_revoked`|`facility_suspended`|`password_changed`, expires_at TIMESTAMPTZ NOT NULL, created_at, last_used_at)
- [x] T009 [P] Create `backend/src/db/schema/plans.ts` — Drizzle table definitions for `platform_modules` (id UUID PK, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description NULLABLE, is_active BOOLEAN DEFAULT true, created_at), `subscription_plans` (id UUID PK, key TEXT UNIQUE NOT NULL — enum: `starter`|`growth`|`enterprise`, name TEXT NOT NULL, description NULLABLE, is_active BOOLEAN DEFAULT true, timestamps), `plan_modules` (id UUID PK, plan_id UUID FK→subscription_plans, module_id UUID FK→platform_modules, UNIQUE(plan_id, module_id), created_at), `plan_entitlements` (id UUID PK, plan_id UUID FK, resource_key TEXT NOT NULL, limit_value INTEGER NOT NULL — -1=unlimited, UNIQUE(plan_id, resource_key), created_at)
- [x] T010 [P] Create `backend/src/db/schema/rbac.ts` — Drizzle table definitions for `permissions` (id UUID PK, module_id UUID NULLABLE FK→platform_modules, key TEXT UNIQUE NOT NULL — format `{module}:{resource}:{action}`, name TEXT NOT NULL, description NULLABLE, created_at), `facility_roles` (id UUID PK, facility_id UUID FK→facilities, name TEXT NOT NULL, is_system_role BOOLEAN DEFAULT false, timestamps, UNIQUE(facility_id, name)), `facility_role_permissions` (id UUID PK, facility_id UUID FK — denormalised for RLS, role_id UUID FK→facility_roles, permission_id UUID FK→permissions, UNIQUE(role_id, permission_id), created_at), `facility_users` (id UUID PK, facility_id UUID FK, user_id UUID FK→users, role_id UUID FK→facility_roles, is_active BOOLEAN DEFAULT true, joined_at TIMESTAMPTZ DEFAULT now(), updated_at, UNIQUE(facility_id, user_id)), `facility_module_overrides` (id UUID PK, facility_id UUID FK, module_id UUID FK, enabled BOOLEAN NOT NULL, reason NULLABLE, timestamps, created_by UUID FK→users, UNIQUE(facility_id, module_id)), `facility_entitlement_overrides` (id UUID PK, facility_id UUID FK, resource_key TEXT NOT NULL, limit_value INTEGER NOT NULL, reason NULLABLE, timestamps, created_by UUID FK, UNIQUE(facility_id, resource_key)), `facility_usage_records` (id UUID PK, facility_id UUID FK, resource_key TEXT NOT NULL, current_usage INTEGER DEFAULT 0, period_start DATE NULLABLE, updated_at, UNIQUE(facility_id, resource_key, period_start))
- [x] T011 [P] Create `backend/src/db/schema/audit.ts` — Drizzle table definition for `audit_log` (id BIGSERIAL PK, facility_id UUID NULLABLE FK, actor_id UUID NULLABLE FK, actor_type TEXT NOT NULL — enum: `user`|`system`|`api_key`, action TEXT NOT NULL — format `{domain}.{event}`, resource_type NULLABLE, resource_id NULLABLE, metadata JSONB DEFAULT '{}', ip_address NULLABLE, user_agent NULLABLE, created_at TIMESTAMPTZ DEFAULT now() NOT NULL); add index on `(facility_id, created_at DESC)`, `(actor_id)`, `(action)`, `(resource_type, resource_id)`
- [x] T012 [P] Create `backend/src/db/schema/patient.ts` — Drizzle table definition for `patient_profiles` (id UUID PK, facility_id UUID FK, user_id UUID FK, date_of_birth DATE NULLABLE, health_card_number_encrypted TEXT NULLABLE — note: AES-256-GCM ciphertext only, health_card_province TEXT NULLABLE, phone NULLABLE, address_line1 NULLABLE, address_line2 NULLABLE, city NULLABLE, province NULLABLE, postal_code NULLABLE, allergies NULLABLE, medical_notes NULLABLE, timestamps, UNIQUE(facility_id, user_id))
- [x] T013 Create `backend/src/db/index.ts` — export `db` (postgres.js pool connecting as `app_user_login` via `DATABASE_URL`) and `superAdminDb` (pool connecting as `app_super_admin_login` via `DATABASE_SUPER_ADMIN_URL`); both pools use `postgres` (postgres.js) with `max` connections from env; export `TenantTransaction` and `SuperAdminTransaction` types
- [x] T014 [P] Create `backend/src/lib/errors.ts` — typed error classes extending `Error`: `AppError` (base, with `statusCode: number`, `code: string`), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `ServiceUnavailableError` (503); error codes: `AUTH_MISSING`, `AUTH_MALFORMED`, `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`, `SESSION_REVOKED`, `AUTH_VERSION_STALE`, `FACILITY_NOT_FOUND`, `FACILITY_SUSPENDED`, `FACILITY_DEACTIVATED`, `MODULE_NOT_AVAILABLE`, `MODULE_DISABLED`, `FEATURE_DISABLED`, `FORBIDDEN`, `USER_SUSPENDED`, `SERVICE_UNAVAILABLE`
- [x] T015 [P] Create `backend/src/lib/redis.ts` — export `redis` (ioredis client from `REDIS_URL` env); wrap `redis.get()` and `redis.set()` in helpers that catch connection errors and rethrow as a typed `RedisUnavailableError` (distinguish from key-miss — miss returns null, connection error throws); export `isRedisUnavailableError(err)` type guard
- [x] T016 Run `npm run db:generate` then `npm run db:migrate` — verify Drizzle generates migration files for all 5 schema files and applies them to the test database without errors; fix any Drizzle schema errors before proceeding
- [x] T017 Create `backend/src/db/rls/current-facility-id.sql` — PostgreSQL function `current_facility_id() RETURNS UUID` that reads `current_setting('app.current_facility_id', true)`, raises `EXCEPTION 'tenant context not set: app.current_facility_id is missing'` when NULL/empty, raises `EXCEPTION 'tenant context invalid: ...'` on invalid UUID (catches `invalid_text_representation`); `LANGUAGE plpgsql STABLE SECURITY DEFINER`; run this SQL via psql against the dev database
- [x] T018 Create `backend/scripts/grant-permissions.sql` — GRANT SELECT, INSERT, UPDATE, DELETE on ALL TABLES to `app_user` and `app_super_admin`; REVOKE UPDATE, DELETE on `audit_log` from BOTH `app_user` AND `app_super_admin`; ALTER DEFAULT PRIVILEGES for future tables; run via psql
- [x] T019 Create `backend/src/db/seeds/platform-modules.ts` — seed `platform_modules` with 7 rows: `ask_pharmacist`, `appointments`, `compounding`, `ecommerce`, `minor_ailments`, `prescriptions`, `stock_management`; seed baseline `permissions` rows (minimum: one permission per module in `{module}:read` and `{module}:write` format); export `seedPlatformData()` async function; add `db:seed` script to package.json
- [x] T020 Create `backend/tests/setup/db.ts` — exports `createTestFacility(overrides?)` and `createTestUser(facilityId, roleId, overrides?)` fixture helpers that INSERT into real test DB and return created IDs; exports `cleanupTestData(facilityIds: string[])` that deletes test data by facility_id cascade; create `backend/tests/setup/fixtures.ts` with fixture data constants (test plan, test modules)
- [x] T021 Create `backend/src/app.ts` — Express app factory: mount `helmet()`, `cors()`, `express.json()`, `express-rate-limit` global limiter, request ID middleware (sets `req.id` to a UUID), global error handler (catches `AppError` subclasses → correct HTTP status; catches unknown errors → 500 with `INTERNAL_ERROR` code; never exposes stack traces in production); create `backend/src/index.ts` — start server on `PORT` env var, graceful shutdown on SIGTERM

**Checkpoint**: `npm run db:migrate` runs clean; `SELECT current_facility_id()` raises exception; both pools connect; `npm run lint` passes; Express app starts on `PORT`.

---

## Phase 3: User Story 1 — Facility Data is Completely Isolated (P1) 🎯 MVP

**Goal**: `withTenantContext()` wraps every facility-scoped query, RLS policies are applied
on all 9 facility-scoped tables, and all 10 ISO cross-tenant isolation tests pass.

**Independent Test**: `npm run test -- tests/isolation/` — ISO-001 through ISO-010 all pass.
Facility A queries return only Facility A data. Missing/invalid context raises exceptions.

### Tests for User Story 1

> Write tests FIRST — they will fail until T024 (RLS policies) and T023 (withTenantContext) are complete.

- [x] T022 [P] [US1] Write `backend/tests/isolation/rls-coverage.test.ts` — queries PostgreSQL `pg_tables` + `pg_policies` system catalogue to assert all 9 facility-scoped tables (`sessions`, `facility_module_overrides`, `facility_entitlement_overrides`, `facility_usage_records`, `facility_roles`, `facility_role_permissions`, `facility_users`, `audit_log`, `patient_profiles`) have `rowsecurity = true` and at least one policy; test must connect as `app_user_login` (regular pool)
- [x] T023 [P] [US1] Write `backend/tests/isolation/cross-tenant.test.ts` — ISO test cases using `beforeAll` to create two test facilities (Facility A, Facility B) with records in all 9 RLS tables; ISO-001: Facility A session reads only Facility A rows; ISO-002: Facility A attempts UPDATE on Facility B row by ID → 0 rows affected; ISO-003: Facility A attempts DELETE on Facility B row → 0 rows affected; ISO-004: query facility-scoped table with no `set_config` call → exception thrown (not empty array); ISO-005: `set_config('app.current_facility_id', 'not-a-uuid', true)` → exception thrown; ISO-006: `superAdminDb` query (no `set_config`) → returns rows from both facilities; ISO-007: `withTenantContext(facilityId, fn)` sets context before `fn` executes; ISO-008: context is cleared after transaction commits (subsequent query without context raises); ISO-009: context is cleared after transaction rolls back; ISO-010: two concurrent `withTenantContext()` calls with different facility IDs don't cross-contaminate (verify via `Promise.all`)

### Implementation for User Story 1

- [x] T024 [US1] Create `backend/src/db/rls/policies.sql` — `ENABLE ROW LEVEL SECURITY` on all 9 facility-scoped tables; for each table create policy: `CREATE POLICY tenant_isolation ON {table} USING (facility_id = current_facility_id())` (for INSERT also `WITH CHECK (facility_id = current_facility_id())`); for `audit_log` also add `FOR SELECT` + `FOR INSERT` policies explicitly (no UPDATE/DELETE policies needed since permissions are revoked); apply via psql against the dev database
- [x] T025 [US1] Implement `backend/src/lib/tenant-context.ts` — `withTenantContext<T>(facilityId: string, fn: (tx: TenantTransaction) => Promise<T>): Promise<T>` that opens `db.transaction(async (tx) => { await tx.execute(sql\`SELECT set_config('app.current_facility_id', ${facilityId}, true)\`); return fn(tx); })`; validate `facilityId` is a non-empty string before opening the transaction; re-throw all errors from `fn`; export `TenantTransaction` type as `Parameters<Parameters<typeof db.transaction>[0]>[0]`
- [ ] T026 [US1] Run `npm run test -- tests/isolation/` — all ISO-001 through ISO-010 must be green; fix any failures before marking this phase complete (common failure points: missing `set_config` parameter order, RLS policy syntax errors, incorrect schema `facility_id` references)

**Checkpoint (US1)**: `npm run test -- tests/isolation/rls-coverage.test.ts tests/isolation/cross-tenant.test.ts --reporter=verbose` — all 10 ISO tests green, all 9 tables verified in RLS coverage test.

---

## Phase 4: User Story 2 — Super Admin Can Operate Across Facilities Safely (P2)

**Goal**: `superAdminQuery()` writes a pre-execution audit entry before every cross-facility
operation, `superAdminDb` import is ESLint-blocked outside `src/core/super-admin/`, and
AUX-001 through AUX-004 (audit append-only) tests pass.

**Independent Test**: `npm run test -- tests/isolation/ --reporter=verbose` — AUX-001
through AUX-004 pass alongside ISO tests. `npm run lint` shows no `superAdminDb` imports
from outside `src/core/super-admin/`.

### Tests for User Story 2

- [x] T027 [P] [US2] Add AUX test cases to `backend/tests/isolation/cross-tenant.test.ts` — AUX-001: `audit_log` INSERT succeeds as `app_user_login` (via regular pool); AUX-002: `audit_log` UPDATE as `app_user_login` → `ERROR: permission denied`; AUX-003: `audit_log` DELETE as `app_user_login` → `ERROR: permission denied`; AUX-004: `audit_log` UPDATE as `app_super_admin_login` (via superAdminDb) → `ERROR: permission denied`

### Implementation for User Story 2

- [x] T028 [P] [US2] Create `backend/src/core/audit/audit.service.ts` — export `createAuditEntry(params: { facilityId?: string; actorId?: string; actorType: 'user'|'system'|'api_key'; action: string; resourceType?: string; resourceId?: string; metadata?: object; ipAddress?: string; userAgent?: string; }, tx: TenantTransaction | SuperAdminTransaction): Promise<void>` — inserts one row into `audit_log`; this function is the ONLY way audit entries are written; `action` must match pattern `{domain}.{event}` (validated by zod in function body)
- [x] T029 [US2] Create `backend/src/core/super-admin/super-admin.service.ts` — export `superAdminQuery<T>(auditParams: { actorId: string; action: string; metadata: object }, fn: (tx: SuperAdminTransaction) => Promise<T>): Promise<T>` — writes pre-execution audit entry via `createAuditEntry()` BEFORE opening the data transaction; opens `superAdminDb.transaction(fn)`; if audit write fails, throws without opening the data transaction; this is the ONLY file in the project that imports `superAdminDb`
- [x] T030 [US2] Create `backend/src/core/auth/middleware/parse-jwt.ts` — full Step 1 implementation: extract `Authorization: Bearer <token>` header; verify with `jsonwebtoken.verify(token, JWT_SECRET)`; extract claims `sub` (userId), `sessionId`, `facilityId`, `authVersion`, `iat`, `role`, `isSuperAdmin`; attach to `req.auth: AuthContext`; throw `AuthError` with the correct error codes from `contracts/middleware-chain.md` (AUTH_MISSING, AUTH_MALFORMED, AUTH_INVALID_TOKEN, AUTH_TOKEN_EXPIRED); export `AuthContext` interface from this file
- [x] T031 [P] [US2] Create stub middleware files — `backend/src/core/auth/middleware/check-session.ts`, `verify-auth-version.ts`, `check-facility-status.ts`, `require-module.ts`, `require-permission.ts` — each exports a function with correct Express `RequestHandler` type signature; all stubs call `next()` unconditionally; add `// TODO Phase 2: implement` comment with reference to the corresponding step in `contracts/middleware-chain.md`; stubs MUST compile without TypeScript errors
- [x] T032 [US2] Wire middleware chain in `backend/src/app.ts` — import all 7 middleware files; export `authMiddleware` array `[parseJWT, checkSession, verifyAuthVersion, checkFacilityStatus]`; export `requireModule(key: string): RequestHandler` and `requirePermission(key: string): RequestHandler` factories for route-level use; add a `GET /health` route (no auth) returning `{ status: 'ok', timestamp: ISO8601 }`; add a `GET /api/v1/ping` route (with auth chain) returning `{ userId: req.auth.userId, facilityId: req.auth.facilityId }`
- [x] T033 [US2] Verify ESLint import restriction — create a temporary test file `backend/src/temp-test-import.ts` that imports `superAdminDb` from `@/db`; run `npm run lint` and confirm the lint error fires; delete the temp file

**Checkpoint (US2)**: `npm run test -- tests/isolation/` — ISO + AUX all green. `npm run lint` — no `superAdminDb` import violations (after T033 temp file is deleted). `GET /api/v1/ping` with a valid JWT returns 200.

---

## Phase 5: User Story 3 — Subscription Plans Control Feature Access at Runtime (P3)

**Goal**: `requireModule` and `checkFacilityStatus` middleware steps fully implemented.
A facility on a plan without module X receives 403 on module X routes. A facility override
immediately adds or removes access. Facility suspension blocks all requests.

**Independent Test**: Add an integration test for the module gate — create a facility on
the Starter plan (no ecommerce module), call a route protected by `requireModule('ecommerce')`,
assert 403 `MODULE_NOT_AVAILABLE`. Add ecommerce module override (`enabled: true`), call
again, assert 200.

### Implementation for User Story 3

- [x] T034 [P] [US3] Replace stub in `backend/src/core/auth/middleware/check-facility-status.ts` — full Step 4 implementation: skip if `req.auth.isSuperAdmin`; query `facilities` table via `superAdminDb` WHERE `id = req.auth.facilityId`; throw `ForbiddenError('FACILITY_NOT_FOUND')` if no row; throw `ForbiddenError('FACILITY_SUSPENDED')` if status = `suspended`; throw `ForbiddenError('FACILITY_DEACTIVATED')` if status = `deactivated`; call `next()` on `active`
- [x] T035 [US3] Replace stub in `backend/src/core/auth/middleware/require-module.ts` — full Step 5 factory implementation: `requireModule(moduleKey: string): RequestHandler` — skip if `req.auth.isSuperAdmin`; check `facility_module_overrides` for `(req.auth.facilityId, module.key = moduleKey)` via `superAdminDb`; if override `enabled=false` throw `ForbiddenError('MODULE_DISABLED')`; if override `enabled=true` call `next()`; if no override check `plan_modules` JOIN `subscription_plans` JOIN `facilities` — if module not in plan throw `ForbiddenError('MODULE_NOT_AVAILABLE')`; if in plan call `next()`

**Checkpoint (US3)**: Manual test: `GET /api/v1/ping` guarded by `requireModule('ecommerce')` → 403 for a facility on Starter plan (no ecommerce) → 200 after adding `facility_module_overrides` override. Facility suspension → 403 on all routes.

---

## Phase 6: User Story 4 — Platform Fails Safely Under Adverse Conditions (P4)

**Goal**: `checkSessionRevocation` and `verifyAuthVersion` middleware steps fully implemented
with Redis → DB fallback and 503 on dual unavailability. All 6 REV tests pass.

**Independent Test**: `npm run test -- tests/isolation/cross-tenant.test.ts --reporter=verbose`
— REV-001 through REV-006 all pass.

### Tests for User Story 4

- [x] T036 [P] [US4] Add REV test cases to `backend/tests/isolation/cross-tenant.test.ts` — REV-001: session in Redis `revoked_session:{id}` set → next middleware step gets 401 `SESSION_REVOKED`; REV-002: `revoked_at` non-null in `sessions` table, Redis unavailable (mock `redis.get` to throw) → 401 `SESSION_REVOKED` via DB fallback; REV-003: active session (revoked_at NULL, Redis miss) → passes step 2; REV-004: `revokeAllUserSessions(userId)` → all rows for user have `revoked_at` set; REV-005: `revokeAllFacilitySessions(facilityId)` → all rows for facility have `revoked_at` set; REV-006: Redis throws AND DB pool throws → 503 `SERVICE_UNAVAILABLE`

### Implementation for User Story 4

- [x] T037 [P] [US4] Replace stub in `backend/src/core/auth/middleware/check-session.ts` — full Step 2 implementation: check Redis key `revoked_session:{sessionId}` via `redis.get()`; if key exists → throw `AuthError('SESSION_REVOKED')`; if Redis unavailable (catch `RedisUnavailableError`) → fall back to `superAdminDb` query `sessions` WHERE `id = sessionId AND revoked_at IS NULL`; if DB row not found or `revoked_at` set → throw `AuthError('SESSION_REVOKED')`; if DB also throws → throw `ServiceUnavailableError('SERVICE_UNAVAILABLE')`; also implement `revokeSession(sessionId)`, `revokeAllUserSessions(userId)`, `revokeAllFacilitySessions(facilityId)` as exported functions in `backend/src/core/auth/session.service.ts` — each sets `revoked_at` + `revoked_reason` in DB and writes `revoked_session:{id}` key to Redis with 30-day TTL
- [x] T038 [US4] Replace stub in `backend/src/core/auth/middleware/verify-auth-version.ts` — full Step 3 implementation: check Redis key `auth_version:{userId}` (TTL 60s); if cache hit and value matches JWT `authVersion` → call `next()`; if Redis unavailable (catch `RedisUnavailableError`) or cache miss → query `users.auth_version` WHERE `id = userId` via `superAdminDb`; if DB value > JWT `authVersion` → throw `AuthError('AUTH_VERSION_STALE')`; if DB also unavailable → throw `ServiceUnavailableError('SERVICE_UNAVAILABLE')`; on DB hit, populate Redis cache with 60s TTL

**Checkpoint (US4)**: `npm run test -- tests/isolation/cross-tenant.test.ts` — all 20 tests (ISO + REV + AUX) green.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Full gate validation, type safety, lint clean, quickstart verified.

- [ ] T039 Run full test suite `npm run test` — all 20 Phase 1 gate tests green (ISO-001–010, REV-001–006, AUX-001–004); if any fail, diagnose and fix before marking complete
- [x] T040 [P] Run TypeScript type check `npm run typecheck` (add script: `"typecheck": "tsc --noEmit"`) — zero errors; fix any type errors found
- [x] T041 [P] Run `npm run lint` — zero errors including `no-restricted-imports` rule for `superAdminDb`; fix any violations
- [ ] T042 Validate `quickstart.md` manually — follow all 9 steps: `docker compose up`, create roles, run migrations, apply RLS, grant permissions, seed, run RLS coverage test, run isolation tests, verify manual smoke checks; all pass
- [ ] T043 [P] Add `npm run db:seed` to package.json (already defined in T006) and verify `seedPlatformData()` is idempotent — running twice does not produce duplicate rows (use INSERT ... ON CONFLICT DO NOTHING)

**Checkpoint (Final)**: Phase 1 gate checklist from `quickstart.md §9` is fully checked. Ready for `/speckit-implement` or Phase 2 planning.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 complete — blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — RLS policies + `withTenantContext()`
- **Phase 4 (US2)**: Depends on Phase 2 + Phase 3 complete — needs `withTenantContext()` working
- **Phase 5 (US3)**: Depends on Phase 2 + Phase 4 (needs `parseJWT` and stub middleware chain)
- **Phase 6 (US4)**: Depends on Phase 2 + Phase 4 (needs Redis client + session service)
- **Phase 7 (Polish)**: Depends on Phases 3–6 complete

### Within Each Phase

- Tasks marked [P] within the same phase can run in parallel
- Tasks without [P] must run after all [P] tasks in their phase complete
- Within US phases: Tests first (they fail) → models/schema (T008–T012 already done) → implementation → run tests

### Critical Sequential Chain

```
T001 → T002 → T016 (migration requires schema + install)
T017 → T018 → T024 (RLS policies require function + permissions)
T013 → T025 (tenant-context requires pool exports)
T015 → T037 (check-session requires Redis client)
T030 → T031 → T032 (middleware chain requires parse-jwt then stubs then wiring)
```

---

## Parallel Opportunities

### Phase 1 (parallel after T001+T002):
```
T003 [tsconfig] ‖ T004 [eslint] ‖ T005 [docker-compose]
then T006 [drizzle config]
```

### Phase 2 (parallel after T007):
```
T008 [core schema] ‖ T009 [plans schema] ‖ T010 [rbac schema] ‖ T011 [audit schema] ‖ T012 [patient schema]
then T013 [db/index.ts — needs all schemas]
T014 [errors.ts] ‖ T015 [redis.ts] ‖ T016 [migrate — needs T008–T012] → T017 → T018 → T019
T020 [test setup] ‖ T021 [express skeleton]
```

### Phase 3 (parallel test writing + docs):
```
T022 [rls-coverage test] ‖ T023 [ISO tests]
then T024 [RLS policies] → T025 [withTenantContext] → T026 [run tests]
```

### Phase 4 (some parallel):
```
T027 [AUX tests] ‖ T028 [audit.service] ‖ T031 [middleware stubs]
then T029 [super-admin.service — needs T028]
then T030 [parse-jwt — needs errors.ts]
then T032 [wire chain — needs T030+T031]
then T033 [verify ESLint restriction]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — CRITICAL gate
3. Complete Phase 3: US1 — `withTenantContext()` + RLS
4. **STOP and VALIDATE**: 10 ISO tests green, RLS coverage clean
5. This is the core isolation guarantee — safe foundation for all modules

### Incremental Delivery

1. Setup + Foundational → database and Express skeleton working
2. US1 complete → tenant isolation proven at engine level (ISO tests green)
3. US2 complete → super admin access + audit log + full middleware skeleton (AUX tests green)
4. US3 complete → subscription module gating working (runtime plan control)
5. US4 complete → fail-closed Redis behaviour (REV tests green)
6. Polish → all 20 gate tests green; Phase 1 gate fully passed

### Single Developer Sequential Order

```
T001 → T002 → T003 → T004 → T005 → T006
→ T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015
→ T016 → T017 → T018 → T019 → T020 → T021
→ T022 → T023 → T024 → T025 → T026     ← US1 gate: ISO tests green
→ T027 → T028 → T029 → T030 → T031 → T032 → T033   ← US2: AUX tests green
→ T034 → T035                           ← US3: module gating
→ T036 → T037 → T038                   ← US4: fail-closed + REV tests green
→ T039 → T040 → T041 → T042 → T043    ← Polish: all 20 tests green
```

---

## Notes

- `[P]` tasks = different files, no shared state dependencies; safe to run concurrently
- `[USN]` label = maps task to user story for traceability; each story independently testable
- Tests are RED before implementation — verify they fail first, then implement
- All `src/core/auth/middleware/*.ts` stubs in T031 must compile before wiring in T032
- `superAdminDb` is used in `check-facility-status`, `require-module`, `check-session`,
  `verify-auth-version` — these MUST be inside `src/core/super-admin/` OR they must only
  use `superAdminDb` indirectly via the services. Confirm with constitution: the ESLint
  restriction is on DIRECT imports of `superAdminDb`. Services that call `superAdminDb`
  internally and expose a typed function are the preferred pattern.
- The middleware stubs (T031) call `next()` unconditionally — this means Phase 3 tests
  (ISO) work even before Phase 4/5/6 fill in the stubs
- Stop at every **Checkpoint** to validate independently before moving to the next phase

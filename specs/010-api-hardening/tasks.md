# Tasks: API Hardening

**Input**: Design documents from `specs/010-api-hardening/`

**Prerequisites**: plan.md ✓ · spec.md ✓ · research.md ✓ · contracts/hardening.md ✓ · quickstart.md ✓

---

## Phase 1: Setup

**Purpose**: Install new dependencies and configure test runner

- [X] T001 Add new deps to `backend/package.json`: `swagger-jsdoc`, `swagger-ui-express` (deps); `@types/swagger-jsdoc`, `@types/swagger-ui-express` (devDeps); run `npm install` — NOTE: project uses Vitest not Jest; supertest already installed; no jest.config needed
- [X] T002 N/A — Vitest already configured in `backend/vitest.config.ts`; `tests/**/*.test.ts` glob already set
- [X] T003 N/A — `"test": "vitest run"` already exists in `backend/package.json`

---

## Phase 2: Foundational (Test Infrastructure)

**Purpose**: Shared test helpers that every integration test depends on

⚠️ Must be complete before any Phase 3+ test files can be written

- [X] T004 N/A — `backend/tests/setup/db.ts` + `backend/tests/setup/fixtures.ts` already provide full test infrastructure (Vitest pattern) — exports `createTestApp()` (wraps `createApp()` from `src/app.ts`); sets `process.env.NODE_ENV = 'test'` and `process.env.ALLOWED_ORIGINS = 'http://localhost:3000'` before app creation; exports a `closeDb()` teardown function
- [X] T005 N/A — `backend/tests/setup/fixtures.ts` already provides all seed helpers — exports `seedTestFacility()` (inserts one facility row via `workerDb`), `seedTestUser(facilityId, role)` (hashes a known password, inserts user + facility_user), `loginTestUser(app, email, password)` (calls `POST /api/v1/auth/login` via supertest and returns `accessToken`), and `truncateAll()` (truncates all non-migration tables via `workerDb` with CASCADE)

**Checkpoint**: Test infrastructure is ready — integration test files can now be written

---

## Phase 3: User Story 1 — Abusive Requests Throttled (P1) 🎯 MVP

**Goal**: Three named rate limiters enforce per-IP per-minute caps; 429 with `Retry-After` header when exceeded

**Independent Test**: Quickstart Scenarios S1 and S2 (run `npm run dev` and use curl)

- [X] T006 [US1] Create `backend/src/middleware/rate-limit.ts` — define three named limiters using `express-rate-limit` v7 with `standardHeaders: 'draft-7'`, `legacyHeaders: false`: `globalLimiter` (windowMs: 60000, max: 200), `authStrictLimiter` (windowMs: 60000, max: 5), `healthcareSubmissionsLimiter` (windowMs: 60000, max: 10); export all three
- [X] T007 [US1] Modify `backend/src/app.ts` — replace the single 300/15-min global limiter with `globalLimiter`; add `authStrictLimiter` on the auth router (`/api/v1/auth`); add `healthcareSubmissionsLimiter` on prescription/compounding/ask-pharmacist POST routes (apply before `healthcareRouter` or inside the healthcare module router)
- [X] T008 [US1] Modify `backend/src/app.ts` global error handler — add explicit check for Express `SyntaxError` with `type === 'entity.too.large'`; respond 413 with `{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large.' } }`

**Checkpoint**: Rate limiters active — `curl` loop confirms 5th auth request succeeds and 6th returns 429

---

## Phase 4: User Story 2 — Trusted Origins + Hidden Internal Details (P1)

**Goal**: CORS uses `ALLOWED_ORIGINS` env var; Helmet hardened with explicit CSP/HSTS/frameguard; production errors reveal no internals

**Independent Test**: Quickstart Scenarios S3–S5 (CORS and security headers via curl)

- [X] T009 [US2] Modify `backend/src/app.ts` CORS setup — parse `process.env.ALLOWED_ORIGINS` as comma-separated list; in `NODE_ENV=production`, throw at startup if empty or absent; in dev, fall back to `['http://localhost:3000', 'http://localhost:3002']`; replace the current `origin: [FRONTEND_URL, ADMIN_URL]` with the parsed list
- [X] T010 [US2] Modify `backend/src/app.ts` Helmet setup — replace bare `helmet()` with explicit config: `contentSecurityPolicy` (defaultSrc `'none'`, connectSrc `'self'`, frameAncestors `'none'`, formAction `'none'`), `hsts` (maxAge 31536000, includeSubDomains true, preload true), `frameguard` (`action: 'deny'`), `referrerPolicy` (`'strict-origin-when-cross-origin'`), `xXssProtection: false`; CSP must be relaxed (`contentSecurityPolicy: false`) specifically for the `/api/docs` route only
- [X] T011 [US2] Update `backend/.env.example` — add `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002`; remove `FRONTEND_URL` and `ADMIN_URL` entries (replaced by `ALLOWED_ORIGINS`)

**Checkpoint**: Curl confirms CORS blocked for evil.com, allowed for localhost:3000; security headers present on `/health`

---

## Phase 5: User Story 3 — Developers Explore API Without Source Code (P2)

**Goal**: Interactive Swagger UI at `/api/docs` auto-generated from JSDoc annotations on route files

**Independent Test**: Quickstart Scenarios S7 and S8 (open browser, curl swagger.json)

- [X] T012 [US3] Create `backend/src/lib/swagger/swagger.config.ts` — `swagger-jsdoc` config object: `definition` (openapi 3.0.0, info title/version/description, servers `[{url: '/api/v1'}]`, `securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }`); `apis` glob: `['./src/core/auth/*.router.ts', './src/modules/**/*.router.ts', './src/notifications/*.router.ts', './src/email/*.router.ts']`; export `swaggerSpec` as the result of `swaggerJsdoc(options)`
- [X] T013 [US3] Create `backend/src/lib/swagger/swagger.router.ts` — create an Express `Router`; mount `swaggerUi.serve` and `swaggerUi.setup(swaggerSpec)` at `/`; also serve raw spec JSON at `/swagger.json`; export the router
- [X] T014 [US3] Modify `backend/src/app.ts` — mount swagger router at `/api/docs` BEFORE the global `helmet()` middleware (so the route-level relaxed CSP from T010 applies); add `app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerRouter)` before the global security setup block
- [X] T015 [US3] Add `@openapi` JSDoc annotations to `backend/src/core/auth/auth.router.ts` — document: `POST /auth/login` (requestBody email+password, 200 token response, 401, 422), `POST /auth/register` (201, 422), `POST /auth/logout` (200, 401), `POST /auth/forgot-password` (200, 422), `POST /auth/reset-password` (200, 400, 422)
- [X] T016 [P] [US3] Add `@openapi` JSDoc to `backend/src/modules/healthcare/prescriptions/prescription.router.ts` — document `POST /prescriptions` (201, 401, 422), `GET /prescriptions` (200), `GET /prescriptions/:id` (200, 403, 404), `POST /prescriptions/:id/files` (201 fileKey, 422, 503), `GET /prescriptions/:id/files/:fileKey/url` (200 url, 403, 404)
- [ ] T017 [P] [US3] Add `@openapi` JSDoc to `backend/src/modules/healthcare/compounding/compounding.router.ts` — same pattern as prescriptions
- [ ] T018 [P] [US3] Add `@openapi` JSDoc to `backend/src/modules/catalogue/products/product.router.ts` — `GET /catalogue/products` (200 list), `GET /catalogue/products/:id` (200, 404), `POST /catalogue/products` (201, 401, 422), `PATCH /catalogue/products/:id` (200, 401, 403, 404), `DELETE /catalogue/products/:id` (204, 401, 403, 404)
- [X] T019 [P] [US3] Add `@openapi` JSDoc to `backend/src/modules/appointments/appointments/appointment.router.ts` — `POST /appointments` (201, 400 no capacity, 401, 422), `GET /appointments` (200), `GET /appointments/:id` (200, 403, 404), `PATCH /appointments/:id/cancel` (200, 403, 404)
- [X] T020 [P] [US3] Add `@openapi` JSDoc to `backend/src/modules/checkout/checkout.router.ts` — `POST /checkout` (201 orderId+status+total, 400 empty cart/out of stock, 401, 422) and `backend/src/modules/orders/order.router.ts` — `GET /orders` (200 list), `GET /orders/:id` (200, 403, 404)

**Checkpoint**: `GET /api/docs` loads Swagger UI; `GET /api/docs/swagger.json` returns openapi 3.0.0 spec with auth + healthcare + catalogue + appointments + commerce sections

---

## Phase 6: User Story 4 — Critical Flows Verified Automatically (P2)

**Goal**: `npm test` runs integration tests against a test DB; all critical happy-path and error-path scenarios pass

**Independent Test**: Quickstart Scenario S9 (`npm test` exits 0); Scenario S10 (deliberate bug → test fails)

- [X] T021 [US4] Create `backend/tests/auth/login.test.ts` — test cases: T-AUTH-01 (login happy path → 200 + accessToken), T-AUTH-02 (wrong password → 401 INVALID_CREDENTIALS), T-AUTH-03 (invalid email field → 422 VALIDATION_ERROR); use `seed.helper.ts` to create test user before tests; truncate after
- [X] T022 [US4] Create `backend/tests/healthcare/prescriptions.test.ts` — test cases: T-RX-01 (authenticated patient submit prescription → 201 with id + status=pending), T-RX-02 (no auth → 401 UNAUTHORIZED); seed test patient user; call `loginTestUser()` helper
- [X] T023 [US4] Create `backend/tests/commerce/checkout.test.ts` — test case: T-ORDER-01 (patient with seeded cart + product + address + shipping method → POST /checkout → 201 with orderId + status=pending); seed product, category, cart item, address, shipping method before test
- [X] T024 [US4] Create `backend/tests/appointments/appointments.test.ts` — test case: T-APPT-01 (patient books appointment with seeded vaccine service + availability slot → 201 with id + status=booked); seed vaccine service and slot before test
- [X] T025 [P] [US4] Create `backend/tests/security/headers.test.ts` — test case: T-SEC-01 (GET /health → response headers include X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Strict-Transport-Security); no DB seed required

**Checkpoint**: `npm test` exits 0 with 8+ passing tests

---

## Phase 7: Polish & Validation

- [X] T026 [P] Run `npm run typecheck` in `backend/` — must pass with 0 errors
- [X] T027 [P] Run `npm run lint` in `backend/` — must pass with 0 errors
- [ ] T028 Run quickstart.md Scenarios S1–S8 manually against `npm run dev` (requires running dev server + env vars) — deferred until environment is available
- [ ] T029 Run quickstart.md Scenario S9 (`npm test` against live `TEST_DATABASE_URL`) — deferred until test DB is provisioned

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No deps — start immediately
- **Phase 2 (Foundational Test Infra)**: Depends on Phase 1 — T004/T005 need `createApp()` importable
- **Phase 3 (US1 Rate Limiting)**: Depends on Phase 1 only — no DB required
- **Phase 4 (US2 Security)**: Depends on Phase 1 only — no DB required; can run in parallel with Phase 3
- **Phase 5 (US3 Swagger)**: Depends on T001 (new deps installed) — can run in parallel with Phase 3+4
- **Phase 6 (US4 Tests)**: Depends on Phase 2 (test helpers) + Phase 3 (rate limits for T-RATE) + Phase 4 (CORS for T-SEC)
- **Phase 7 (Polish)**: Depends on all prior phases complete

### Parallel Opportunities

- T003 and T002 can run after T001 together
- T004 and T005 can run in parallel (different files)
- T009 and T010 can run in parallel (both in app.ts — coordinate carefully)
- T016, T017, T018, T019, T020 can all run in parallel (different router files)
- T021, T022, T023, T024, T025 can all run in parallel (different test files)
- T026 and T027 can run in parallel (typecheck + lint)

---

## Implementation Strategy

### MVP (US1 + US2 only — hardening without docs or tests)

1. Complete Phase 1: Install deps
2. Complete Phase 3: Rate limiting
3. Complete Phase 4: CORS + Helmet hardening
4. Validate with quickstart S1–S6

### Full Delivery

1. Phase 1 → Phase 2 (test infra) → Phase 3 + 4 (in parallel) → Phase 5 (Swagger) → Phase 6 (tests) → Phase 7 (polish)

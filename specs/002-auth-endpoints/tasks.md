# Tasks: Auth Endpoints (002)

**Feature**: `002-auth-endpoints` | **Branch**: `002-auth-endpoints`

**Input**: `specs/002-auth-endpoints/` — plan.md, spec.md, data-model.md, contracts/auth-endpoints.md, research.md, quickstart.md

**Tests**: Included — 9 REST endpoints require integration tests against a real database. Vitest + supertest + real PostgreSQL (Phase 1 test infrastructure reused).

**User Stories**:
- **US1** (P1): Patient Self-Registration
- **US2** (P1): Login & Session Creation
- **US3** (P2): Silent Session Renewal (token refresh + rotation + theft detection)
- **US4** (P2): Logout (single session + all sessions)
- **US5** (P3): Forgotten Password Reset
- **US6** (P3): Email Verification

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)

---

## Phase 1: Setup

**Purpose**: Install the one new package (nodemailer) and make a minor schema type update. No user story work can begin until setup is complete.

- [X] T001 Add `nodemailer` and `@types/nodemailer` to `backend/package.json` dependencies + devDependencies and run `npm install` in `backend/`
- [X] T002 [P] Update `backend/src/db/schema/core.ts` — add `'rotated'` to the `revokedReason` string union type comment on the `sessions` table (TEXT column, no migration needed; used when a session is superseded by token rotation)

**Checkpoint**: `npm install` succeeds; `npm run typecheck` still clean.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared auth infrastructure — email service, validators, service skeleton, router skeleton, app mount, test fixtures, facility seed. MUST be complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create `backend/src/core/auth/email.service.ts` — create nodemailer transporter from env vars (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`); export `sendVerificationEmail(to: string, firstName: string, token: string, facilityName: string): Promise<void>` — subject "Verify your email — {facilityName}", body with placeholder verification URL containing token; export `sendPasswordResetEmail(to: string, firstName: string, token: string, facilityName: string): Promise<void>` — subject "Reset your password — {facilityName}", 30-minute expiry note in body; wrap `transporter.sendMail()` in try/catch — log errors but do NOT rethrow (email failure is non-fatal and must not block the HTTP response)
- [X] T004 Extend `backend/src/core/super-admin/auth-queries.service.ts` with Phase 2 helper functions — all use `superAdminDb` (BYPASSRLS); add: `getFacilityBySlug(slug: string)`, `getUserByEmail(email: string)`, `createUser(data: {email, passwordHash, firstName, lastName})`, `createSession(data: {id, userId, facilityId, refreshTokenHash, userAgent, ipAddress, expiresAt, lastUsedAt})`, `getSessionById(sessionId: string)`, `revokeSessionOnRotation(sessionId: string)` — sets `revokedAt=now, revokedReason='rotated'`, `incrementAuthVersion(userId: string)`, `updateUserPasswordAndVersion(userId: string, newHash: string)` — updates `passwordHash` AND increments `authVersion` in one UPDATE, `setPasswordResetToken(userId: string, token: string, expiresAt: Date)`, `getUserByPasswordResetToken(token: string)`, `clearPasswordResetToken(userId: string)`, `setEmailVerifyToken(userId: string, token: string, expiresAt: Date)`, `getUserByEmailVerifyToken(token: string)`, `clearEmailVerifyTokenAndMarkVerified(userId: string)` — sets `emailVerified=true` and clears token + expiry, `updateLastLoginAt(userId: string)`; also add two functions that accept `TenantTransaction` (not `superAdminDb`): `createFacilityPatientRole(tx: TenantTransaction, facilityId: string): Promise<{id: string}>` — `INSERT INTO facility_roles (id, facilityId, name, isSystemRole) VALUES (gen_random_uuid(), $1, 'patient', true) ON CONFLICT (facilityId, name) DO NOTHING` then SELECT back the id, `createFacilityUserLink(tx: TenantTransaction, data: {facilityId: string, userId: string, roleId: string}): Promise<void>` — INSERT INTO facilityUsers ON CONFLICT (facilityId, userId) DO NOTHING
- [X] T005 [P] Create `backend/src/core/auth/auth.validator.ts` — zod schemas for all 9 request bodies: `RegisterBodySchema` (firstName: string min 1 max 100, lastName: string min 1 max 100, email: z.string().email().max(255), password: z.string().min(8).max(128), facilitySlug: z.string().regex(/^[a-z0-9-]+$/).max(100)), `LoginBodySchema` (email: z.string().email(), password: z.string().min(1).max(128), facilitySlug: z.string().optional()), `ForgotPasswordBodySchema` (email: z.string().email()), `ResetPasswordBodySchema` (token: z.string().min(1), password: z.string().min(8).max(128)), `VerifyEmailBodySchema` (token: z.string().min(1)), `ResendVerificationBodySchema` (email: z.string().email()); export TypeScript types inferred via `z.infer<>` for each schema
- [X] T006 [P] Create `backend/src/core/auth/auth.service.ts` — skeleton file: import all helper functions from `@/core/super-admin/auth-queries.service`; import `withTenantContext` from `@/lib/tenant-context`; import `sendVerificationEmail`, `sendPasswordResetEmail` from `./email.service`; import error classes from `@/lib/errors`; import `createAuditEntry` from `@/core/audit/audit.service`; import `argon2`, `jsonwebtoken`, `{ v4 as uuidv4 }`, `{ randomBytes }` from `'crypto'`; export `authService` object with 9 async stub functions — `register`, `login`, `refreshToken`, `logout`, `logoutAll`, `forgotPassword`, `resetPassword`, `verifyEmail`, `resendVerification` — each stub throws `new AppError('NOT_IMPLEMENTED', 'not yet implemented', 501)`
- [X] T007 [P] Create `backend/src/core/auth/auth.router.ts` — Express Router; import `authService` from `./auth.service`; import all zod schemas from `./auth.validator`; import `authMiddleware` from `@/app`; mount all 9 routes with correct HTTP methods and paths (see `contracts/auth-endpoints.md`); for each route: parse and validate request body using the corresponding zod schema (on failure: call `next(new ValidationError(...))` with 422); call the corresponding `authService` method inside a try/catch that forwards errors to `next(err)`; routes for `/logout` and `/logout-all` use `...authMiddleware` before the handler
- [X] T008 Update `backend/src/app.ts` — install `cookie-parser` package (`npm install cookie-parser @types/cookie-parser`); add `import cookieParser from 'cookie-parser'` and `app.use(cookieParser())` before route handlers; import `authRouter` from `./core/auth/auth.router` and mount `app.use('/api/v1/auth', authRouter)`
- [X] T009 [P] Create `backend/src/db/seeds/facilities.ts` — seeds two test facilities: `{ name: 'Test Pharmacy', slug: 'test-pharmacy', status: 'active' }` and `{ name: 'Suspended Pharmacy', slug: 'suspended-pharmacy', status: 'suspended' }`; both inserts use `ON CONFLICT (slug) DO NOTHING`; export `seedFacilities()` async function; add `"db:seed:facilities": "tsx src/db/seeds/facilities.ts"` to `backend/package.json` scripts; run `npm run db:seed:facilities` to verify it runs without error
- [X] T010 [P] Update `backend/tests/setup/fixtures.ts` — add `getTestFacilityBySlug(slug: string)` that queries facilities by slug and returns the row; add `createTestPatientAccount(facilitySlug: string, overrides?: Partial<RegisterBody>)` that calls `POST /api/v1/auth/register` via supertest against the running app and returns `{ userId, email, password }` (useful for test setup in login/refresh tests)

**Checkpoint**: `npm run typecheck` zero errors; `npm run lint` zero errors; `POST /api/v1/auth/register` returns 501 (wired but not implemented); `POST /api/v1/auth/login` returns 501; all auth route stubs respond without crashing.

---

## Phase 3: User Story 1 — Patient Self-Registration (P1) 🎯 MVP

**Goal**: `POST /api/v1/auth/register` creates a user + facility_users link, sends a verification email, and returns 201.

**Independent Test**: `npm run test -- tests/auth/register.test.ts` — all REG tests green.

### Tests for User Story 1

> Write these tests FIRST — they will fail (501) until T011 is implemented.

- [X] T011 [P] [US1] Write `backend/tests/auth/register.test.ts` — test cases using supertest against the Express app + real test DB: **REG-001** valid registration with active facility slug returns 201 with `{ data: { message, userId } }`; **REG-002** same email + same facility slug returns 409 `EMAIL_IN_USE`; **REG-003** unknown facilitySlug returns 404 `FACILITY_NOT_FOUND`; **REG-004** `slug='suspended-pharmacy'` returns 403 `FACILITY_INACTIVE`; **REG-005** password with 7 chars returns 422 `VALIDATION_ERROR`; **REG-006** cross-pharmacy: register at 'test-pharmacy', then register same email+password at a second active facility → 201 (same userId, second facilityUsers row created); **REG-007** cross-pharmacy with wrong password → 409 `ACCOUNT_EXISTS_LOGIN`; **REG-008** after REG-001, query `audit_log` directly and assert one row with `action='auth.register'` and `actorId=userId`; use `afterAll` to clean up test data

### Implementation for User Story 1

- [X] T012 [US1] Implement `authService.register(dto, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: (1) `getFacilityBySlug(dto.facilitySlug)` → throw `NotFoundError('FACILITY_NOT_FOUND')` if null; throw `ForbiddenError('FACILITY_INACTIVE')` if `status !== 'active'`; (2) `getUserByEmail(dto.email)` — if found: check `facilityUsers` link for this facility (call `getExistingFacilityUserLink(userId, facilityId)` added in T004 or check in T004 if missing); if link exists → throw `ConflictError('EMAIL_IN_USE')`; if link absent → `argon2.verify(user.passwordHash, dto.password)` → if mismatch throw `ConflictError('ACCOUNT_EXISTS_LOGIN')`; (3) if user not found: `createUser({email: dto.email, passwordHash: await argon2.hash(dto.password), firstName: dto.firstName, lastName: dto.lastName})`; (4) `await withTenantContext(facility.id, async (tx) => { const role = await createFacilityPatientRole(tx, facility.id); await createFacilityUserLink(tx, {facilityId: facility.id, userId, roleId: role.id}); })`; (5) `const verifyToken = uuidv4(); await setEmailVerifyToken(userId, verifyToken, addHours(new Date(), 24))`; (6) `sendVerificationEmail(dto.email, dto.firstName, verifyToken, facility.name)`; (7) `createAuditEntry({facilityId: facility.id, actorId: userId, actorType: 'user', action: 'auth.register', ipAddress, userAgent}, superAdminTx)` — use `superAdminQuery` wrapper from super-admin.service; return `{ userId }`
- [X] T013 [US1] Implement `POST /api/v1/auth/register` route in `backend/src/core/auth/auth.router.ts` — replace stub: validate body with `RegisterBodySchema`; call `await authService.register(dto, req.ip, req.headers['user-agent'] ?? '')`; return `res.status(201).json({ data: { message: 'Registration successful. Please check your email to verify your account.', userId: result.userId } })`

**Checkpoint (US1)**: `npm run test -- tests/auth/register.test.ts` — all 8 REG tests green.

---

## Phase 4: User Story 2 — Login & Session Creation (P1)

**Goal**: `POST /api/v1/auth/login` returns an access token in the response body and a `refresh_token` HttpOnly cookie on success.

**Independent Test**: `npm run test -- tests/auth/login.test.ts` — all LOG tests green. A registered test account can log in and the returned access token authenticates `GET /api/v1/ping`.

### Tests for User Story 2

- [X] T014 [P] [US2] Write `backend/tests/auth/login.test.ts` — use a registered test account (via `createTestPatientAccount` fixture from T010): **LOG-001** valid credentials return 200 with `accessToken` in body and `Set-Cookie: refresh_token=...;HttpOnly` header; **LOG-002** wrong password returns 401 `INVALID_CREDENTIALS`; **LOG-003** email not found returns 401 `INVALID_CREDENTIALS` (identical response to LOG-002 — no enumeration); **LOG-004** `slug='suspended-pharmacy'` with valid user returns 403 `FACILITY_INACTIVE`; **LOG-005** `facilityUsers.isActive=false` returns 403 `ACCOUNT_INACTIVE`; **LOG-006** decode the returned JWT and assert claims: `sub=userId`, `sessionId` is a UUID, `facilityId=facility.id`, `authVersion=1`, `role='patient'`, `isSuperAdmin=false`; **LOG-007** query `sessions` table and assert one row with correct `userId`, `facilityId`, `expiresAt ≈ now+30days`, `revokedAt IS NULL`; **LOG-008** `audit_log` has one row with `action='auth.login'`, `actorId=userId`; **LOG-009** after LOG-002 wrong password attempt, `audit_log` has row with `action='auth.login_failed'`

### Implementation for User Story 2

- [X] T015 [US2] Implement `authService.login(dto, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: (1) `getFacilityBySlug(dto.facilitySlug)` → FACILITY_NOT_FOUND / FACILITY_INACTIVE; (2) `getUserByEmail(dto.email)` — if null: `createAuditEntry(auth.login_failed, {metadata:{reason:'email_not_found'}})` → throw `AuthError('INVALID_CREDENTIALS')`; (3) `argon2.verify(user.passwordHash, dto.password)` — if false: audit + throw `AuthError('INVALID_CREDENTIALS')`; (4) look up `facilityUser` for `(userId, facilityId)` via `withTenantContext` — if not found or `isActive=false`: throw `ForbiddenError('ACCOUNT_INACTIVE')`; (5) look up role name from `facilityRoles` via `facilityUser.roleId` inside same `withTenantContext`; (6) `const sessionId = uuidv4(); const rawToken = randomBytes(32).toString('hex'); const tokenHash = await argon2.hash(rawToken)`; (7) `createSession({id:sessionId, userId, facilityId, refreshTokenHash:tokenHash, userAgent, ipAddress, expiresAt: addDays(new Date(), 30), lastUsedAt: new Date()})`; (8) sign JWT `{ sub: userId, sessionId, facilityId, authVersion: user.authVersion, role: roleName, isSuperAdmin: user.isPlatformSuperAdmin }` with `JWT_SECRET`, `expiresIn: '15m'`; (9) `updateLastLoginAt(userId)`; (10) `createAuditEntry(auth.login, {facilityId, actorId:userId, actorType:'user', ipAddress, userAgent})`; return `{ accessToken, rawRefreshToken: rawToken, user: {id, email, firstName, lastName, emailVerified, role, facilityId} }`
- [X] T016 [US2] Implement `POST /api/v1/auth/login` route in `backend/src/core/auth/auth.router.ts` — replace stub: validate `LoginBodySchema`; call `authService.login(dto, req.ip, req.headers['user-agent'] ?? '')`; set cookie `res.cookie('refresh_token', result.rawRefreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/auth', maxAge: 30 * 24 * 60 * 60 * 1000 })`; return `200 { data: { accessToken: result.accessToken, user: result.user } }`
- [ ] T017 [US2] Run `npm run test -- tests/auth/login.test.ts` — all LOG-001 through LOG-009 must be green; also manually verify `GET /api/v1/ping` with the returned accessToken returns 200 (quickstart.md S4 + S6)

**Checkpoint (US2)**: Both register and login work end-to-end. A patient can register, log in, and authenticate to a protected route.

---

## Phase 5: User Story 3 — Silent Session Renewal (P2)

**Goal**: `POST /api/v1/auth/refresh` rotates the refresh token, issues a new access token, and detects reuse of an already-rotated token.

**Independent Test**: `npm run test -- tests/auth/refresh.test.ts` — all REF tests green.

### Tests for User Story 3

- [X] T018 [P] [US3] Write `backend/tests/auth/refresh.test.ts` — set up a test account + login to get `{ accessToken, refresh_token cookie }`: **REF-001** valid cookie + valid (or expired) access token → 200 with new `accessToken` in body and new `Set-Cookie: refresh_token`; **REF-002** no cookie → 401 `REFRESH_TOKEN_MISSING`; **REF-003** tampered cookie value (wrong random bytes, same sessionId) → 401 `REFRESH_TOKEN_INVALID`; **REF-004** manually set `sessions.expiresAt = past` → 401 `REFRESH_TOKEN_EXPIRED`; **REF-005** manually set `sessions.revokedAt = now, revokedReason='user_logout'` → 401 `SESSION_REVOKED`; **REF-006** perform one valid refresh, then re-send the OLD cookie (before rotation) → 401 `REFRESH_TOKEN_REUSE`; after REF-006, query DB and assert ALL user sessions have `revokedAt IS NOT NULL`; **REF-007** after REF-001, old cookie value is rejected on a second refresh attempt; **REF-008** `audit_log` has `action='auth.token_refresh'` row after REF-001

### Implementation for User Story 3

- [X] T019 [US3] Implement `authService.refreshToken(expiredAccessToken: string|undefined, rawRefreshToken: string|undefined, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: (1) if `!rawRefreshToken` → throw `AuthError('REFRESH_TOKEN_MISSING')`; (2) if `!expiredAccessToken` → throw `AuthError('REFRESH_TOKEN_INVALID')`; (3) parse JWT with `jwt.verify(token, secret, { ignoreExpiration: true })` to extract `sessionId` — if signature invalid → throw `AuthError('REFRESH_TOKEN_INVALID')`; (4) `getSessionById(sessionId)` — if null → `AuthError('REFRESH_TOKEN_INVALID')`; (5) if `session.revokedAt IS NOT NULL AND session.revokedReason === 'rotated'` → theft detected → `revokeAllUserSessions(userId, 'admin_revoked')` → `createAuditEntry(auth.logout_all, {metadata:{reason:'theft_detected'}})` → throw `AuthError('REFRESH_TOKEN_REUSE')`; (6) if `session.revokedAt IS NOT NULL` (any other reason) → throw `AuthError('SESSION_REVOKED')`; (7) if `session.expiresAt < new Date()` → throw `AuthError('REFRESH_TOKEN_EXPIRED')`; (8) `argon2.verify(session.refreshTokenHash, rawRefreshToken)` — if false → throw `AuthError('REFRESH_TOKEN_INVALID')`; (9) generate new `sessionId=uuidv4()`, new `rawToken=randomBytes(32).toString('hex')`, new `tokenHash=argon2.hash(rawToken)`; (10) `createSession({id: newSessionId, userId, facilityId, refreshTokenHash: tokenHash, userAgent, ipAddress, expiresAt: addDays(30), lastUsedAt: now})`; (11) `revokeSessionOnRotation(oldSessionId)` — sets `revokedAt=now, revokedReason='rotated'`; (12) sign new JWT with `newSessionId`; (13) `createAuditEntry(auth.token_refresh)`; return `{ accessToken, rawRefreshToken: rawToken }`
- [X] T020 [US3] Implement `POST /api/v1/auth/refresh` route in `backend/src/core/auth/auth.router.ts` — replace stub: read `req.cookies.refresh_token`; read `req.headers.authorization?.slice(7)`; call `authService.refreshToken(authHeader, cookieToken, req.ip, req.headers['user-agent']??'')`; set new cookie (same options as login); return `200 { data: { accessToken } }`
- [ ] T021 [US3] Run `npm run test -- tests/auth/refresh.test.ts` — all REF-001 through REF-008 must be green

**Checkpoint (US3)**: Token rotation works; old tokens are rejected; theft detection revokes all sessions.

---

## Phase 6: User Story 4 — Logout (P2)

**Goal**: `POST /api/v1/auth/logout` revokes the current session immediately. `POST /api/v1/auth/logout-all` revokes all sessions and increments `authVersion`.

**Independent Test**: `npm run test -- tests/auth/logout.test.ts` — all OUT tests green.

### Tests for User Story 4

- [X] T022 [P] [US4] Write `backend/tests/auth/logout.test.ts` — set up registered + logged-in test account: **OUT-001** `POST /auth/logout` with valid Bearer token → 200, `sessions.revokedAt IS NOT NULL`, `Set-Cookie: refresh_token=; Max-Age=0` header; **OUT-002** after OUT-001, `GET /api/v1/ping` with same token → 401 `SESSION_REVOKED`; **OUT-003** `POST /auth/logout-all` → 200, ALL user sessions have `revokedAt IS NOT NULL`, `users.authVersion` incremented by 1; **OUT-004** after OUT-003, a previously-valid access token → 401 `AUTH_VERSION_STALE` (caught by `verifyAuthVersion` middleware); **OUT-005** `POST /auth/logout` without Authorization header → 401 `AUTH_MISSING`; **OUT-006** `audit_log` has `auth.logout` after OUT-001; `audit_log` has `auth.logout_all` after OUT-003

### Implementation for User Story 4

- [X] T023 [US4] Implement `authService.logout(sessionId, userId, facilityId, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: `revokeSession(sessionId, 'user_logout')` (already exists in auth-queries.service from Phase 1); write Redis key `revoked_session:{sessionId}` with 30-day TTL via `redisSet()`; `createAuditEntry({facilityId, actorId:userId, actorType:'user', action:'auth.logout', ipAddress, userAgent})`; NOTE: authVersion is NOT incremented for single logout
- [X] T024 [US4] Implement `authService.logoutAll(userId, facilityId, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: `revokeAllUserSessions(userId)` (Phase 1 — returns list of revoked session IDs); for each session ID write `revoked_session:{id}` to Redis (30d TTL); `incrementAuthVersion(userId)`; `createAuditEntry({facilityId, actorId:userId, actorType:'user', action:'auth.logout_all', ipAddress, userAgent})`
- [X] T025 [US4] Implement `POST /auth/logout` and `POST /auth/logout-all` routes in `backend/src/core/auth/auth.router.ts` — replace stubs: both use `...authMiddleware` guard; logout calls `authService.logout(req.auth.sessionId, req.auth.userId, req.auth.facilityId, req.ip, req.headers['user-agent']??'')`; logout-all calls `authService.logoutAll(req.auth.userId, req.auth.facilityId, req.ip, req.headers['user-agent']??'')`; both clear cookie `res.clearCookie('refresh_token', {path:'/api/v1/auth'})`; return `200 { data: { message } }`; run `npm run test -- tests/auth/logout.test.ts`

**Checkpoint (US4)**: Logout revokes sessions immediately. Logout-all invalidates all access tokens via authVersion increment.

---

## Phase 7: User Story 5 — Forgotten Password Reset (P3)

**Goal**: `POST /api/v1/auth/forgot-password` sends a reset email (same response whether email exists or not). `POST /api/v1/auth/reset-password` validates the token and replaces the password.

**Independent Test**: `npm run test -- tests/auth/password-reset-verify.test.ts` — PW-001 through PW-007 green.

### Tests for User Story 5

- [X] T026 [P] [US5] Write `backend/tests/auth/password-reset-verify.test.ts` — password reset cases (set up registered test account): **PW-001** `POST /auth/forgot-password` with registered email → 200 with generic message; **PW-002** `POST /auth/forgot-password` with unknown email → 200 with IDENTICAL message (no enumeration); **PW-003** read `passwordResetToken` from DB, `POST /auth/reset-password` with valid token + new password ≥8 chars → 200, `users.passwordHash` updated, `users.authVersion` incremented, all sessions have `revokedAt IS NOT NULL`; **PW-004** set `passwordResetExpiresAt = past` → 400 `RESET_TOKEN_INVALID`; **PW-005** use same token again (already cleared) → 400 `RESET_TOKEN_INVALID`; **PW-006** `POST /auth/reset-password` with 7-char new password → 422 `VALIDATION_ERROR`; **PW-007** login with new password after PW-003 succeeds; login with old password after PW-003 fails; `audit_log` has `auth.password_reset_request` and `auth.password_reset_complete` rows

### Implementation for User Story 5

- [X] T027 [US5] Implement `authService.forgotPassword(email, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: `getUserByEmail(email)` — if NOT found: return generic response immediately (no audit, no email); if found: generate `resetToken = uuidv4()`, `expiresAt = addMinutes(new Date(), 30)`; `setPasswordResetToken(userId, resetToken, expiresAt)`; look up facility name for context (get user's most recently active `facilityUser` via a new helper or use 'our platform' fallback); `sendPasswordResetEmail(user.email, user.firstName, resetToken, facilityName)`; `createAuditEntry({actorId:userId, actorType:'user', action:'auth.password_reset_request', ipAddress, userAgent})`; ALWAYS return `{ message: "If that email address is registered, you will receive a reset link shortly." }`
- [X] T028 [US5] Implement `authService.resetPassword(token, newPassword, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: `getUserByPasswordResetToken(token)` — if null OR `user.passwordResetExpiresAt < new Date()` → throw `ValidationError('RESET_TOKEN_INVALID', 400)`; `updateUserPasswordAndVersion(userId, await argon2.hash(newPassword))` — atomically updates `passwordHash` and increments `authVersion`; `clearPasswordResetToken(userId)`; `revokeAllUserSessions(userId)` + write Redis revocation keys; `createAuditEntry({actorId:userId, actorType:'user', action:'auth.password_reset_complete', ipAddress, userAgent})`; return `{ message: "Password updated. Please log in with your new password." }`
- [X] T029 [US5] Implement `POST /auth/forgot-password` and `POST /auth/reset-password` routes in `backend/src/core/auth/auth.router.ts` — replace stubs: validate schemas; call service methods; return 200; run PW tests

**Checkpoint (US5)**: Forgot/reset password flow complete. Old sessions are revoked on reset. Same response for known/unknown emails.

---

## Phase 8: User Story 6 — Email Verification (P3)

**Goal**: `POST /api/v1/auth/verify-email` marks the account as verified. `POST /api/v1/auth/resend-verification` issues a fresh token.

**Independent Test**: `npm run test -- tests/auth/password-reset-verify.test.ts` — EV-001 through EV-006 green (appended to same test file as US5).

### Tests for User Story 6

- [X] T030 [P] [US6] Append email verification test cases to `backend/tests/auth/password-reset-verify.test.ts` — set up unverified test account: **EV-001** read `emailVerifyToken` from DB, `POST /auth/verify-email` with valid token → 200, `users.emailVerified=true`, token + expiry columns cleared; **EV-002** set `emailVerifyExpiresAt = past` → 400 `VERIFY_TOKEN_INVALID`; **EV-003** call `POST /auth/verify-email` on an already-verified account → 200 (idempotent, no error); **EV-004** `POST /auth/resend-verification` with unverified email → 200 generic message, new `emailVerifyToken` written to DB, previous token is different; **EV-005** `POST /auth/resend-verification` with unknown email → 200 with IDENTICAL generic message (no enumeration); **EV-006** `POST /auth/resend-verification` for already-verified account → 200 generic message (no-op); `audit_log` has `auth.email_verify` and `auth.email_verify_resend` rows

### Implementation for User Story 6

- [X] T031 [US6] Implement `authService.verifyEmail(token)` in `backend/src/core/auth/auth.service.ts` — replace stub: `getUserByEmailVerifyToken(token)` — if null: check if any user has `emailVerified=true` with this token as a stale match (skip — just throw VERIFY_TOKEN_INVALID); more simply: if null → throw `ValidationError('VERIFY_TOKEN_INVALID', 400)`; if `user.emailVerifyExpiresAt < new Date()` → throw `ValidationError('VERIFY_TOKEN_INVALID', 400)`; if `user.emailVerified === true` → return success (idempotent); `clearEmailVerifyTokenAndMarkVerified(userId)`; `createAuditEntry({actorId:userId, actorType:'user', action:'auth.email_verify'})`; return `{ message: "Email verified successfully." }`
- [X] T032 [US6] Implement `authService.resendVerification(email, ipAddress, userAgent)` in `backend/src/core/auth/auth.service.ts` — replace stub: `getUserByEmail(email)` — if not found OR `user.emailVerified === true` → return generic response immediately (no action); generate `newToken = uuidv4()`, `expiresAt = addHours(new Date(), 24)`; `setEmailVerifyToken(userId, newToken, expiresAt)` (overwrites previous token); `sendVerificationEmail(user.email, user.firstName, newToken, 'our platform')`; `createAuditEntry({actorId:userId, actorType:'user', action:'auth.email_verify_resend', ipAddress, userAgent})`; ALWAYS return `{ message: "If that email has an unverified account, a new verification link has been sent." }`
- [X] T033 [US6] Implement `POST /auth/verify-email` and `POST /auth/resend-verification` routes in `backend/src/core/auth/auth.router.ts` — replace stubs: validate schemas; call service methods; return 200; run EV tests

**Checkpoint (US6)**: All 9 auth endpoints are fully implemented. All auth test files pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation — all tests green, typecheck clean, lint clean, smoke tests pass.

- [ ] T034 Run full Phase 2 test suite `npm run test -- tests/auth/` — all tests green (REG-001–008, LOG-001–009, REF-001–008, OUT-001–006, PW-001–007, EV-001–006); fix any failures before marking complete
- [X] T035 [P] Run `npm run typecheck` — zero TypeScript errors across all Phase 2 files (`auth.service.ts`, `auth.router.ts`, `auth.validator.ts`, `email.service.ts`, `auth-queries.service.ts` additions)
- [X] T036 [P] Run `npm run lint` — zero ESLint errors; confirm no `superAdminDb` imports outside `src/core/super-admin/` (no new violations from Phase 2 auth files)
- [ ] T037 Run Phase 2 gate checklist from `quickstart.md` — follow all 11 smoke tests (S1–S11) against the running dev server with Docker; confirm all pass including `refresh_token` cookie is HttpOnly and S5/S9 return identical responses for known/unknown emails
- [ ] T038 [P] Verify `nodemailer` sends correctly in dev environment — trigger registration smoke test (S1), check EMAIL_USER inbox (or inspect nodemailer transport logs if using SMTP capture like Mailtrap) and confirm verification email was received with a valid token in the URL

**Checkpoint (Final)**: Phase 2 gate checklist from `quickstart.md §Phase 2 Gate Checklist` fully checked. All 38 tasks marked [x]. Ready for `/speckit-implement`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user stories
- **Phase 3 (US1 — Register)**: Depends on Phase 2
- **Phase 4 (US2 — Login)**: Depends on Phase 3 (login tests need a registered account)
- **Phase 5 (US3 — Refresh)**: Depends on Phase 4 (refresh tests need a session)
- **Phase 6 (US4 — Logout)**: Depends on Phase 4 (logout needs a session); can run in parallel with Phase 5
- **Phase 7 (US5 — Password Reset)**: Depends on Phase 3 (needs a registered user); can run independently of US3/US4
- **Phase 8 (US6 — Email Verify)**: Depends on Phase 3; can run in parallel with Phase 7
- **Phase 9 (Polish)**: Depends on Phases 3–8 complete

### Critical Sequential Chain

```
T001 → T008 (cookie-parser must be installed before app.ts is updated)
T004 → T006 (auth.service.ts imports auth-queries.service helpers)
T006 → T007 (auth.router.ts imports authService)
T007 → T008 (app.ts mounts authRouter)
T009 → T011 (tests need facilities seeded)
T011 → T012 → T013 → T017 (register → implement → verify login)
T017 → T019 → T021 (login → refresh → verify)
```

### Parallel Opportunities

```
Phase 1:  T001 ‖ T002
Phase 2:  T003 ‖ T005 ‖ T006 ‖ T007 ‖ T009 ‖ T010
          then T004 (may depend on types from T006)
          then T008 (mounts router, needs T007 complete)
Phase 3:  T011 (test) ‖ T012 (impl) → T013 → T017
Phase 5+6: T018 ‖ T022 (tests can be written in parallel)
Phase 7+8: T026 ‖ T030 (tests can be written in parallel)
Phase 9:  T035 ‖ T036 ‖ T038
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — CRITICAL gate
3. Complete Phase 3: US1 (Registration) — 8 test cases green
4. Complete Phase 4: US2 (Login) — 9 test cases green
5. **STOP and VALIDATE**: Patient can register, receive email, log in, and call a protected route with the access token

### Incremental Delivery

1. Setup + Foundational → skeleton wired, all routes return 501
2. US1 (Register) → 8 tests green
3. US2 (Login) → 9 tests green, full auth loop works
4. US3 (Refresh) + US4 (Logout) in parallel → session lifecycle complete
5. US5 (Password Reset) + US6 (Email Verify) in parallel → account management complete
6. Polish → gate checklist fully checked

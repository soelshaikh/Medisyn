# Research: Auth Endpoints (002)

All stack decisions are inherited from Phase 1 (Express + PostgreSQL + Drizzle + argon2 + jsonwebtoken + ioredis). This document resolves the 6 open decisions specific to Phase 2.

---

## Decision 1: Refresh Token Delivery — HttpOnly Cookie

**Decision**: Refresh token is delivered as an `HttpOnly; SameSite=Lax; Secure` cookie named `refresh_token`. Access token is returned in the JSON response body only (short-lived, stored in memory by the client).

**Rationale**: HttpOnly cookies are invisible to JavaScript, eliminating XSS-based token theft. This is the correct choice for a pharmacy platform that handles PHI. `SameSite=Lax` blocks cross-site POST forgery for the vast majority of cases. `Secure` ensures the cookie only travels over HTTPS in production.

**Alternatives considered**:
- Response body / localStorage — rejected: localStorage is directly readable by XSS payloads; not acceptable for a healthcare platform.
- Response body / in-memory JS — rejected: token is lost on tab close or page refresh, forcing re-login constantly — unacceptable UX.
- Both tokens in body — rejected: same XSS risk as localStorage if frontend persists either token.

**Implementation notes**:
- Cookie name: `refresh_token`
- `httpOnly: true`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`
- `maxAge`: 30 days in milliseconds
- On logout: clear cookie by setting `maxAge: 0`

---

## Decision 2: Email Transport — nodemailer + Brevo SMTP (Phase 2 only)

**Decision**: Use `nodemailer` with Brevo SMTP credentials already present in `.env` for synchronous transactional emails. Phase 7 replaces this with a BullMQ async queue.

**Rationale**: Brevo SMTP credentials (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`) are already configured. `nodemailer` is the standard Node.js mailer and adds one dev dependency. No new credentials or accounts are needed. Synchronous send in Phase 2 is acceptable because the auth endpoints are not high-throughput; the async queue becomes necessary only at scale or when email reliability/retry is required.

**Alternatives considered**:
- Brevo HTTP API directly — more robust retry semantics but requires implementing the Brevo REST client, which is more work for the same Phase 2 outcome.
- SendGrid / Postmark — rejected: credentials already exist for Brevo; no reason to change providers.
- No email in Phase 2 — rejected: FR-002 and FR-016 require email verification and password reset emails; these are core to the auth feature.

**New package required**: `nodemailer` + `@types/nodemailer`

---

## Decision 3: Refresh Token Format — crypto.randomBytes + argon2 Hash

**Decision**: Raw refresh token = `crypto.randomBytes(32).toString('hex')` (64-char hex string). Stored in `sessions.refresh_token_hash` = `argon2.hash(rawToken)`. Only the raw token is sent to the client.

**Rationale**: Storing the hash means a DB breach does not expose reusable refresh tokens. argon2 is already installed. `crypto.randomBytes(32)` provides 256 bits of cryptographic entropy, making brute-force impossible.

**Alternatives considered**:
- JWT as refresh token — rejected: JWTs are self-verifying and cannot be individually revoked without a blocklist. The session-record model (DB-backed, per-session revocation) is already established in Phase 1 and must be respected.
- bcrypt instead of argon2 — rejected: argon2 is already installed and is the project-wide password hashing standard (constitution §II).
- Plaintext storage — rejected: DB breach would expose all active refresh tokens.

**Verification on use**: On refresh, call `argon2.verify(session.refreshTokenHash, incomingToken)` for each candidate session row. Because there is only one active row per session (sessions are keyed by ID in the JWT), the lookup is direct: find session by `sessionId` from the current access token, then verify the hash.

---

## Decision 4: Cross-Pharmacy Registration — Verify-Then-Link

**Decision**: When a registration email already exists in the global `users` table but not in `facility_users` for the target facility, require the registering user to prove ownership by verifying their existing password. If the password matches, create the `facility_users` link. If it does not match, return 409 with message "An account with this email already exists on our platform. Please log in."

**Rationale**: Silent linking without password verification would allow an attacker to register at a new pharmacy using someone else's known email, gaining a foothold at that facility. Password verification confirms the registrant owns the account.

**Flow**:
1. Lookup user by email via `superAdminDb` (cross-facility, no tenant context)
2. If found AND `facilityId` already in `facility_users` → 409 "email already registered at this pharmacy"
3. If found AND NOT in `facility_users` → `argon2.verify(user.passwordHash, submittedPassword)` → if matches, create `facility_users` link; if fails, 409 "account exists, please log in"
4. If not found → create new `users` row + `facility_users` link (standard path)

**Alternatives considered**:
- Silent link without password check — rejected: security risk as described above.
- Require manual account merge via admin — rejected: too much friction for a patient registering at a second pharmacy.

---

## Decision 5: Patient Role Seeding — Lazy Creation at Registration

**Decision**: The registration endpoint uses `INSERT INTO facility_roles ... ON CONFLICT DO NOTHING` to ensure a `patient` system role exists for the target facility before creating the `facility_users` record. This is executed inside `withTenantContext(facilityId)`.

**Rationale**: There is no facility-creation flow yet (admin panel is a later phase). Testing requires facilities to be seeded manually. Requiring a pre-seeded "patient" role for every facility before registration can work adds a fragile prerequisite. Lazy creation with idempotent INSERT is simpler and correct.

**Role definition**: name=`'patient'`, isSystemRole=`true`. System roles are never deleted by facility admins.

**Alternatives considered**:
- Seed patient role in facility creation trigger — rejected: no facility creation flow exists in Phase 2.
- Seed via db:seed script — rejected: the seed script is platform-level (modules, plans); facility-level system roles belong to the registration flow.
- Hard-code a UUID for the patient role — rejected: fragile, breaks across environments.

---

## Decision 6: authVersion Increment Rules

**Decision**:
- **Single-session logout** (`POST /auth/logout`): Do NOT increment `authVersion`. Only revoke the current session in DB + Redis. Outstanding access tokens from other sessions remain valid.
- **Logout-all** (`POST /auth/logout-all`): Increment `authVersion` by 1. All outstanding access tokens from all sessions become stale immediately (caught by `verifyAuthVersion` middleware on next use). Also revoke all sessions in DB + Redis.
- **Password reset completion** (`POST /auth/reset-password`): Increment `authVersion` by 1. Revoke all sessions in DB + Redis.
- **Password change** (future): Same as password reset — increment `authVersion` + revoke all sessions.

**Rationale**: `verifyAuthVersion` middleware (Phase 1) checks `users.auth_version` against the `authVersion` claim in the JWT. Incrementing on logout-all and password reset ensures that access tokens issued before the event cannot be used again — critical security guarantee for "I think my account was compromised" flows.

**Alternatives considered**:
- Increment authVersion on every logout — rejected: too aggressive. Single-session logout is a normal user action (closing a browser tab); invalidating all other sessions is not the intent.
- Never increment authVersion (rely only on session revocation) — rejected: access tokens are short-lived JWTs not tracked in Redis. Until they expire naturally, they remain usable even after session revocation (session revocation only blocks refresh). authVersion is the mechanism to kill outstanding access tokens instantly.

---

## Decision 7: Verification Token Expiry Windows

**Decision**:
- Email verification token: **24 hours** from issuance
- Password reset token: **30 minutes** from issuance (per FR-017)

**Token format**: UUID v4, stored as plaintext in `users.email_verify_token` / `users.password_reset_token`. No need to hash these — they are single-use, short-lived, and deleted on use. If a column value is leaked from the DB, the attacker has at most 24h / 30min to act, and email delivery to the legitimate user provides an implicit alert.

**On new token issuance**: overwrite the existing token and timestamp (previous token is immediately invalidated by replacement).

---

## Summary of New Packages

| Package | Purpose | Already installed? |
|---------|---------|-------------------|
| `nodemailer` | SMTP email sending | No — add to dependencies |
| `@types/nodemailer` | TypeScript types | No — add to devDependencies |

All other packages (`argon2`, `jsonwebtoken`, `ioredis`, `zod`, `uuid`, `express`, `drizzle-orm`, `postgres`) are already installed from Phase 1.

`crypto` is a Node.js built-in — no package needed.

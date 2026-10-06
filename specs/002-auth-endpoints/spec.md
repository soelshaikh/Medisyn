# Feature Specification: Auth Endpoints

**Feature Branch**: `002-auth-endpoints`

**Created**: 2026-10-06

**Status**: Draft

**Input**: Phase 2 — Auth endpoints. Register, login, JWT access + refresh token issuance, refresh token rotation, logout (single session + all sessions), email verification flow, forgot/reset password flow. Uses the foundation from Phase 1: Drizzle + PostgreSQL, sessions table, users table, withTenantContext(), authVersion field, argon2 password hashing, ioredis session revocation.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Patient Self-Registration (Priority: P1)

A new patient creates an account at a specific pharmacy on the platform. They provide their email address, a password, their name, and the pharmacy they are registering with. The system creates their account and sends them a verification email. The account is active immediately but email verification is required to access sensitive healthcare features.

**Why this priority**: Registration is the entry point — no other auth flow is possible without an account. Every other user story depends on an account existing.

**Independent Test**: A new email address can complete registration at a pharmacy, and the account appears in the system associated with the correct pharmacy with the patient role.

**Acceptance Scenarios**:

1. **Given** a visitor with a valid email address and a known active pharmacy, **When** they submit their first name, last name, email, password, and pharmacy identifier, **Then** their account is created, assigned the patient role at that pharmacy, and a verification email is dispatched.
2. **Given** an email address already registered at that pharmacy, **When** registration is submitted with the same email, **Then** the system rejects the request with a clear conflict error.
3. **Given** a user already registered at one pharmacy, **When** they register at a second pharmacy using the same email, **Then** the existing account is linked to the new pharmacy rather than creating a duplicate account.
4. **Given** a registration attempt referencing an unknown or suspended pharmacy, **When** submitted, **Then** the system rejects the registration.
5. **Given** a password shorter than 8 characters, **When** registration is submitted, **Then** the system rejects it with a validation error before creating any account.

---

### User Story 2 — Login & Session Creation (Priority: P1)

A registered user provides their email and password to access their account. On success, the user receives a session that persists across page loads without requiring credentials again. The login event is recorded for audit purposes.

**Why this priority**: Login is required before any authenticated feature can be used. P1 alongside registration.

**Independent Test**: A registered account can log in, and the returned session allows accessing a protected resource.

**Acceptance Scenarios**:

1. **Given** a registered account with correct credentials, **When** the user submits their email and password, **Then** they receive a short-lived access credential and a long-lived renewal credential, and a session record is created.
2. **Given** a correct email but wrong password, **When** submitted, **Then** the system returns an error that does not indicate whether the email is registered (no account enumeration).
3. **Given** an email with no account, **When** login is attempted, **Then** the system returns the same generic error as an incorrect password.
4. **Given** a user whose pharmacy is suspended, **When** they attempt to log in, **Then** login is rejected with an appropriate error.
5. **Given** a successful login, **When** the short-lived access credential expires, **Then** the session can be silently renewed without prompting the user (see User Story 3).

---

### User Story 3 — Silent Session Renewal (Priority: P2)

A logged-in user's session stays active as long as they continue using the platform, without being prompted to re-enter credentials. Sessions expire only after a long period of inactivity or explicit logout.

**Why this priority**: Without session renewal, users are interrupted every 15 minutes. Critical for usability but not blocking for day-one smoke testing.

**Independent Test**: After the short-lived access credential expires, a client can obtain a new access credential using the long-lived renewal credential with no user interaction.

**Acceptance Scenarios**:

1. **Given** a valid active session, **When** the access credential expires, **Then** the client can exchange the renewal credential for a new access credential and a new renewal credential.
2. **Given** a renewal credential that has been revoked, **When** exchanged, **Then** the request is rejected with an authentication error.
3. **Given** a valid renewal credential, **When** exchanged, **Then** the old renewal credential is immediately invalidated and cannot be reused (rotation).
4. **Given** a renewal credential that has already been rotated and someone presents the old one, **When** exchanged, **Then** the system detects potential theft and revokes all sessions for that user.
5. **Given** a renewal credential older than 30 days, **When** exchanged, **Then** the request is rejected and the user must log in again.

---

### User Story 4 — Logout (Priority: P2)

A logged-in user can end their session. If they suspect account compromise, they can end all active sessions simultaneously across all devices.

**Why this priority**: Security baseline. Any platform handling health data must allow immediate session revocation.

**Independent Test**: After logout, any subsequent request using the revoked session's credentials is rejected immediately — not just after the token expires naturally.

**Acceptance Scenarios**:

1. **Given** an active session, **When** the user logs out of the current device, **Then** the current session is revoked and any further request with that credential is rejected.
2. **Given** a user with sessions on multiple devices, **When** they choose to log out of all devices, **Then** every session for that user is revoked simultaneously.
3. **Given** a revoked session, **When** any subsequent request is made, **Then** the system returns an explicit authentication error (not a silent failure or redirect).
4. **Given** a "log out all devices" action, **When** completed, **Then** any currently valid access credentials issued before that moment are also rejected on next use (not just after they expire naturally).

---

### User Story 5 — Forgotten Password Reset (Priority: P3)

A user who has forgotten their password can request a time-limited reset link by email and set a new password. For security, all existing sessions are ended when the reset completes.

**Why this priority**: Necessary for account recovery but not blocking initial launch testing, which uses accounts with known passwords.

**Independent Test**: A user with a known email can request a reset, complete it with a new password, and log in with the new credentials. Previous sessions are rejected.

**Acceptance Scenarios**:

1. **Given** a registered email, **When** a password reset is requested, **Then** a reset link is sent to that address, and the response is identical whether the email is registered or not (no enumeration).
2. **Given** a valid reset link, **When** a new password is submitted within the expiry window, **Then** the password is updated, all active sessions are revoked, and the reset link is consumed.
3. **Given** an expired reset link, **When** a new password is submitted, **Then** the request is rejected and the user is directed to request a new link.
4. **Given** a reset link that has already been used, **When** submitted again, **Then** the request is rejected.
5. **Given** a new password shorter than 8 characters, **When** submitted during reset, **Then** the request is rejected with a validation error.

---

### User Story 6 — Email Verification (Priority: P3)

A newly registered user verifies their email address to confirm account ownership. Unverified users can request a new verification email if their link expired.

**Why this priority**: Prevents fake accounts and ensures the platform can contact patients for health communications, but does not block basic platform access.

**Independent Test**: A registered user can click the verification link in their email and have their account marked as email-verified.

**Acceptance Scenarios**:

1. **Given** an unverified account, **When** the user clicks the verification link, **Then** their account is marked as email-verified.
2. **Given** an expired verification link, **When** clicked, **Then** the user receives an error and is offered the option to request a new verification email.
3. **Given** an unverified account, **When** a new verification email is requested, **Then** any previous verification tokens for that account are invalidated and a fresh link is sent.
4. **Given** an already-verified account, **When** the verification endpoint is called again, **Then** the request is accepted gracefully without error (idempotent).

---

### Edge Cases

- What happens if a user registers with an email that exists in the global user database but not at that specific pharmacy? They are linked to the new pharmacy without a duplicate account being created.
- What happens when a password reset succeeds but a follow-up request fails partway through revoking sessions? The password change and session revocation must be atomic — either both complete or neither does.
- What happens when a renewal credential is replayed after rotation? The system detects the reuse and revokes all sessions for that user as a compromise response.
- What happens if an email verification token is requested multiple times in quick succession? Only the latest token is valid; previous tokens are invalidated immediately.
- What happens if a user's pharmacy is suspended after they are already logged in? Their next authenticated request must be rejected (not just new logins).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a new patient to create an account at an active pharmacy by providing their first name, last name, email address, password, and pharmacy identifier.
- **FR-002**: The system MUST send an email verification link to the provided email address immediately upon successful registration.
- **FR-003**: The system MUST reject registration if the email address is already registered at the same pharmacy.
- **FR-004**: The system MUST allow a user already registered at one pharmacy to register at a second pharmacy by linking the existing account rather than creating a duplicate.
- **FR-005**: The system MUST reject registration if the pharmacy identifier is unknown or the pharmacy is not in an active state.
- **FR-006**: The system MUST reject passwords shorter than 8 characters at registration and at password reset.
- **FR-007**: The system MUST authenticate users by verifying their email and password and, on success, issue a short-lived access credential and a long-lived renewal credential.
- **FR-008**: The system MUST create a session record on every successful login, capturing device information and the login time.
- **FR-009**: The system MUST return the same error response for "email not found" and "incorrect password" to prevent account enumeration.
- **FR-010**: The system MUST allow the long-lived renewal credential to be exchanged for a new access credential and a new renewal credential (rotation), without requiring the user to re-enter their password.
- **FR-011**: The system MUST invalidate the previous renewal credential immediately upon successful rotation — each renewal credential can only be used once.
- **FR-012**: The system MUST detect reuse of an already-rotated renewal credential and revoke all sessions for that user as a theft-response measure.
- **FR-013**: The system MUST allow a user to log out of their current session, immediately revoking access.
- **FR-014**: The system MUST allow a user to log out of all active sessions simultaneously, across all devices.
- **FR-015**: The system MUST ensure that session revocation takes effect within seconds — not only after the access credential's natural expiry.
- **FR-016**: The system MUST allow a user to request a password reset link by providing their email address, with no indication of whether the address is registered.
- **FR-017**: The system MUST expire password reset links after 30 minutes.
- **FR-018**: The system MUST consume the password reset token on first use so it cannot be reused.
- **FR-019**: The system MUST revoke all active sessions when a password reset is successfully completed.
- **FR-020**: The system MUST allow a user to verify their email by clicking a time-limited link sent to their address.
- **FR-021**: The system MUST allow a user to request a new email verification link if the previous one has expired.
- **FR-022**: The system MUST record all auth events — registration, login, logout, session renewal, password reset request, password reset completion, and email verification — in the audit log with actor, action, timestamp, and IP address.
- **FR-023**: The system MUST reject all requests from a pharmacy whose status changes to suspended, including requests from currently valid sessions at that pharmacy.

### Key Entities

- **User**: A person with a platform account. Has a name, email address, a verified/unverified flag, and an internal version counter that increments whenever their password changes — invalidating any outstanding access credentials.
- **Session**: A record of an active login. Tied to a user and optionally a pharmacy. Records when it was created, last used, and whether it has been revoked and why.
- **Pharmacy (Facility)**: The organisation a patient registers with. Only pharmacies in active status accept new patient registrations or logins.
- **Verification Token**: A single-use, time-limited code sent by email to confirm account ownership. Invalidated when a newer token is issued for the same account.
- **Password Reset Token**: A single-use, 30-minute token sent by email to authorise a password change.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new patient completes account registration in under 2 minutes from first form interaction.
- **SC-002**: Login completes and the user is authenticated in under 1 second under normal operating conditions.
- **SC-003**: A revoked session is rejected within 1 second of revocation — not deferred to natural token expiry.
- **SC-004**: A password reset email arrives in the user's inbox within 60 seconds of the request.
- **SC-005**: Session renewal completes transparently — the user experiences no interruption when their access credential is silently renewed in the background.
- **SC-006**: Zero sensitive data — passwords, tokens, health information — appears in application logs, error responses, or audit records.
- **SC-007**: Every auth event is traceable in the audit log, including actor identity, action type, timestamp, and originating IP address.
- **SC-008**: Account enumeration is not possible via any combination of registration, login, or password reset endpoints.

---

## Assumptions

- Patient self-registration is in scope. Staff accounts are created by administrators (out of scope for this phase — covered in the admin panel phase).
- Registration is open — no invitation code required for patients to create an account.
- Platform super-admins (internal operations users) use the same login endpoint but are not scoped to a specific pharmacy; their session carries no pharmacy identifier.
- Access credentials expire after 15 minutes; renewal credentials expire after 30 days.
- Email sending in this phase is synchronous (direct send). An asynchronous email queue is out of scope and will be introduced in a later infrastructure phase.
- The transactional email service is already configured in the project environment; this phase does not introduce a new email provider.
- Refresh token theft detection (FR-012) revokes all sessions for the affected user immediately and requires them to log in again.
- The minimum password length of 8 characters is the floor; the spec does not define a maximum (a reasonable upper bound will be set during implementation planning).

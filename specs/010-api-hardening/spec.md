# Feature Specification: API Hardening

**Feature Branch**: `010-api-hardening`

**Created**: 2026-10-11

**Status**: Draft

**Input**: Phase 10 — harden the MediSyn Express.js REST API for production readiness: rate limiting, security headers, strict CORS, OpenAPI documentation, and an automated integration test suite.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Abusive Requests Are Throttled Before They Cause Harm (Priority: P1)

The platform needs to protect itself from brute-force login attempts, credential stuffing, and bot-driven form flooding. Any user or automated agent that sends too many requests to sensitive endpoints within a short window is blocked before the system is harmed, without affecting legitimate users.

**Why this priority**: Brute-force attacks on login and password-reset endpoints are the most common attack vector for healthcare platforms. If rate limiting is absent, patient accounts can be compromised. This is also a PHIPA/PIPEDA compliance concern because it protects PHI indirectly.

**Independent Test**: Send 10 login requests with wrong credentials in quick succession from the same IP → the 6th request onwards receives a "too many requests" response. Wait 1 minute → requests succeed again.

**Acceptance Scenarios**:

1. **Given** an unauthenticated client sends more than 5 login attempts per minute from the same IP, **When** the 6th attempt arrives, **Then** the server responds with a rate-limit error and does not process the request.
2. **Given** a client sends more than 3 password-reset or forgot-password requests per minute from the same IP, **When** the 4th request arrives, **Then** it is rejected with a rate-limit response.
3. **Given** a patient submits more than 10 prescription or healthcare requests per minute, **When** the 11th submission arrives in the same window, **Then** it is rejected without being persisted.
4. **Given** a general API client sends more than 200 requests per minute across any endpoint, **When** the 201st request arrives, **Then** it is rate-limited regardless of endpoint.
5. **Given** a rate-limited client waits for the reset window to pass, **When** they send a new request, **Then** the request is processed normally.

---

### User Story 2 — The API Communicates Only With Trusted Origins and Hides Internal Details (Priority: P1)

Browsers and bots attempting to call the API from untrusted origins are blocked. Responses never reveal stack traces, internal error messages, or server fingerprints in production. Security headers prevent the most common browser-based attacks (clickjacking, MIME sniffing, cross-site scripting via injected scripts).

**Why this priority**: The API is public-facing (fronted by the patient portal and admin panel). Without strict CORS and security headers, XSS, clickjacking, and information disclosure vulnerabilities are trivially exploitable. These protections are near-zero implementation cost but prevent entire classes of attacks.

**Independent Test**: Send a request from an origin not in the allowed list → browser receives a CORS error (no `Access-Control-Allow-Origin` header matching the request origin). Trigger a 500 error in production mode → response body contains only a generic message, no stack trace.

**Acceptance Scenarios**:

1. **Given** a browser sends a cross-origin request from an origin not listed in the allowed origins environment variable, **When** the preflight or actual request arrives, **Then** the API does not include a permissive `Access-Control-Allow-Origin` header and the browser blocks the response.
2. **Given** the allowed origins are configured via environment variables, **When** the app starts, **Then** only those exact origins are accepted — no wildcard (`*`) is used in production.
3. **Given** the server encounters an unexpected internal error in production mode, **When** the client receives the error response, **Then** the body contains a generic error message and code only — no stack trace, file paths, or internal variable names.
4. **Given** any API response is inspected, **When** the response headers are examined, **Then** they include security headers preventing clickjacking (`X-Frame-Options`), MIME sniffing (`X-Content-Type-Options`), and include a `Strict-Transport-Security` header.
5. **Given** a client sends a request body larger than the configured maximum size, **When** the request arrives, **Then** the server rejects it with a payload-too-large error before parsing the body.

---

### User Story 3 — Developers Can Explore the Full API Without Reading Source Code (Priority: P2)

Every REST endpoint across all modules (auth, catalogue, commerce, healthcare, appointments, notifications, reports, file storage) is documented in an interactive API reference. Developers can see required parameters, authentication requirements, example request/response shapes, and every possible error code — all from a browser, without touching the codebase.

**Why this priority**: The admin frontend (Phase 11), partner integrations, and future mobile clients all depend on a clear, accurate API contract. Without documentation, every frontend developer must read backend source code to understand the API. Documentation is also required before any external audit or compliance review.

**Independent Test**: Visit `/api/docs` in a browser → the interactive documentation page loads. Click on `POST /api/v1/auth/login` → the parameters, request body schema, 200 response shape, and error codes (401, 422) are shown. The page is accessible without authentication.

**Acceptance Scenarios**:

1. **Given** a developer opens the API documentation URL in a browser, **When** the page loads, **Then** they see a structured, interactive list of all available endpoints grouped by module (auth, catalogue, commerce, healthcare, etc.).
2. **Given** a developer clicks on any endpoint, **When** they view the endpoint detail, **Then** they see: HTTP method, path, description, required authentication (if any), all request parameters/body fields with types and validation rules, all possible response shapes, and all documented error codes.
3. **Given** an authenticated endpoint is viewed in the documentation, **When** the developer tries to execute it without providing a token, **Then** the documentation UI shows a 401 response.
4. **Given** the backend code is updated (a new endpoint is added), **When** the documentation page is refreshed, **Then** the new endpoint appears automatically — documentation is derived from code, not maintained separately.

---

### User Story 4 — Critical API Flows Are Verified Automatically on Every Code Change (Priority: P2)

An automated test suite runs on every commit and confirms that the most important flows — login, prescription submission, order placement, and appointment booking — work end-to-end. If a code change breaks any of these flows, the test run fails and the developer is notified before the code is merged.

**Why this priority**: The codebase has grown to 10 modules over 9 phases with no automated regression safety net. Manual testing of all critical paths before every deploy is unsustainable. An integration test suite catches regressions automatically and gives the team confidence to ship faster.

**Independent Test**: Run `npm test` → all test cases execute against a test database → output shows pass/fail counts. Break a deliberately introduced bug → at least one test fails and identifies which flow broke.

**Acceptance Scenarios**:

1. **Given** a developer runs the test suite locally, **When** all tests pass, **Then** the output shows green with a count of passed tests and zero failures.
2. **Given** a test exists for the login flow, **When** valid credentials are submitted, **Then** the test confirms a JWT access token is returned in the response.
3. **Given** a test exists for prescription submission, **When** a patient submits a valid prescription request, **Then** the test confirms the record is created and the response contains the prescription ID and status.
4. **Given** a test exists for order placement, **When** a cart is checked out successfully, **Then** the test confirms an order record is created with `pending` status.
5. **Given** a code change introduces a bug that breaks the login endpoint, **When** the test suite runs, **Then** the login test fails with a descriptive error message identifying the failure.
6. **Given** the test suite runs in CI, **When** any test fails, **Then** the CI pipeline reports a failure and prevents merge until the tests are green.

---

### Edge Cases

- What if `ALLOWED_ORIGINS` environment variable is missing or empty? → The API must refuse to start (fail-fast) — allowing all origins by default in production would be a critical security misconfiguration.
- What if a rate-limited IP is a shared corporate NAT (many users behind one IP)? → Rate limits are set conservatively to avoid over-blocking; this trade-off is accepted; per-user rate limits are out of scope for this phase.
- What if the API documentation endpoint is accessed by a crawler? → The `/api/docs` page is public (no auth required) but rate-limited by the global rate limiter.
- What if a test database is unavailable during CI? → The test suite must fail clearly with a connection error, not silently skip tests.
- What if a request body is missing `Content-Type: application/json`? → Body size limit check still applies; the JSON parser rejects the body gracefully.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST apply a global rate limit of 200 requests per minute per IP address to all API routes.
- **FR-002**: The system MUST apply a strict rate limit of 5 requests per minute per IP to auth endpoints: login, register, forgot-password, reset-password, and verify-email.
- **FR-003**: The system MUST apply a rate limit of 10 requests per minute per IP to healthcare submission endpoints: prescription submit, compounding submit, and ask-pharmacist new conversation.
- **FR-004**: Rate limit responses MUST use HTTP 429 and include a `Retry-After` header indicating when the client may retry.
- **FR-005**: The system MUST enforce CORS using an allowlist of origins configured via environment variable (`ALLOWED_ORIGINS`). No wildcard (`*`) origin is permitted in production.
- **FR-006**: The system MUST reject requests with bodies larger than 1 MB with a 413 Payload Too Large response.
- **FR-007**: In production mode, error responses MUST contain only the error `code` and a generic `message` — no stack traces, file paths, line numbers, or internal variable names.
- **FR-008**: All API responses MUST include security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (HSTS with min 1-year max-age), and `X-XSS-Protection: 0` (disabled in favour of CSP).
- **FR-009**: The system MUST expose interactive API documentation at `GET /api/docs` covering all REST endpoints across all modules.
- **FR-010**: The API documentation MUST display for each endpoint: HTTP method, path, summary, authentication requirement, request body/parameter schemas, all response shapes with status codes, and all documented error codes.
- **FR-011**: The API documentation endpoint MUST be accessible without authentication.
- **FR-012**: The test suite MUST include at least one happy-path integration test for each of: user login, prescription submit, order placement (cart checkout), and appointment booking.
- **FR-013**: The test suite MUST include error-path tests for: login with wrong credentials (401), prescription submit without auth (401), and request body validation failure (422).
- **FR-014**: The test suite MUST run with `npm test` and exit with code 0 on all-pass, non-zero on any failure.
- **FR-015**: The test suite MUST use an isolated test database — it MUST NOT read from or write to the production or development database.

### Key Entities

- **Rate Limit Window**: A sliding time window (per IP, per route group) that counts requests and enforces thresholds.
- **Allowed Origins List**: A set of origins (URLs) configured via environment variables that the API accepts cross-origin requests from.
- **API Documentation**: A machine-generated, browser-renderable reference of all REST endpoints, auto-updated when code changes.
- **Integration Test**: An automated test case that exercises a full request-response cycle against a live test database.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A brute-force script sending 60 login attempts per minute is blocked after the 5th attempt — no more than 5 attempts per minute per IP reach the authentication logic.
- **SC-002**: A request from an unlisted origin receives no permissive CORS header — verified by inspecting response headers in a browser devtools network tab.
- **SC-003**: A triggered 500 error in production mode returns a response body containing only `code` and `message` fields — no stack trace present.
- **SC-004**: All security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`) are present on every API response — verifiable with a header inspection tool.
- **SC-005**: The API documentation page at `/api/docs` loads in under 2 seconds and lists all modules and endpoints.
- **SC-006**: `npm test` completes in under 60 seconds and reports a pass/fail count.
- **SC-007**: 100% of the defined integration test scenarios pass on a clean test database with no prior state.
- **SC-008**: A deliberately introduced bug in the login endpoint causes at least one test to fail with a descriptive message.

---

## Assumptions

- Rate limits are per-IP address only — per-user (post-authentication) rate limiting is out of scope for this phase.
- The `ALLOWED_ORIGINS` environment variable contains a comma-separated list of allowed origins (e.g., `https://medisyn.ca,https://admin.medisyn.ca`). If the variable is absent or empty, the server refuses to start in production mode.
- Body size limit of 1 MB applies to all JSON endpoints. File upload endpoints (multipart/form-data) are exempt — they are governed by the 10 MB file-size limit already implemented in Phase 9.
- OpenAPI documentation is generated automatically from code annotations — it is not maintained as a separate YAML/JSON file.
- The test database is a dedicated PostgreSQL instance (or the same instance with a separate test schema/database) seeded fresh before each test run.
- Tests cover the critical happy-path and one or two error-path scenarios per module — full test coverage of all edge cases is out of scope for this phase.
- Performance profiling and query optimisation are deferred — this phase focuses on security hardening and test infrastructure, not throughput tuning.
- The `/api/docs` page is publicly accessible (no auth gate) because it documents the public API contract used by frontend developers.

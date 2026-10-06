# Feature Specification: Multi-Tenant Platform Foundation

**Feature Branch**: `001-multitenant-pg-foundation`

**Created**: 2026-10-06

**Status**: Draft

## User Scenarios & Testing

### User Story 1 — Facility Data is Completely Isolated (Priority: P1)

A facility admin at Pharmacy A uses the platform with full confidence that their patients,
prescriptions, orders, and staff records are invisible to Pharmacy B — and vice versa. No
bug, misconfigured request, or missing filter in application code can expose one facility's
data to another. The isolation is enforced at a layer below application code.

**Why this priority**: Tenant isolation is the foundational safety guarantee of a
multi-tenant platform. Every other feature depends on it. A breach here is a catastrophic
PHI exposure, not a minor bug.

**Independent Test**: Given Facility A and Facility B each have records in all core tables,
a request authenticated as Facility A receives only Facility A's records. Facility A cannot
read, update, or delete any Facility B record — and this is verified at the database layer,
not by application-level filtering.

**Acceptance Scenarios**:

1. **Given** a valid session for Facility A, **When** the session queries any facility-scoped
   resource, **Then** only Facility A's records are returned — never Facility B's.
2. **Given** a valid session for Facility A, **When** the session attempts to update a
   Facility B record by ID, **Then** the operation affects zero rows and returns not found.
3. **Given** a request with no tenant identity set, **When** the request reaches any
   facility-scoped data layer, **Then** the system raises a hard error — it does not return
   empty results or silently succeed.
4. **Given** a request carrying a syntactically invalid tenant identity, **When** it reaches
   the data layer, **Then** the system raises a hard error — it does not fall back to a
   default tenant or return any data.

---

### User Story 2 — Super Admin Can Operate Across Facilities Safely (Priority: P2)

A Vtech-Med super admin can view all facilities, modify subscription plans, enable modules,
and override feature flags across any tenant — while every such action is logged before it
executes. Regular facility staff have no path to escalate to this level of access, even if
they craft a malicious request.

**Why this priority**: The super admin capability is required to onboard new facilities and
manage the platform. Insecure cross-facility access would undermine the entire isolation model.

**Independent Test**: A super admin session can query records from multiple facilities in
one operation. A facility user session cannot access another facility's data regardless of
the request shape. Every super admin cross-facility query produces an audit log entry
recorded before the data is returned.

**Acceptance Scenarios**:

1. **Given** a super admin session, **When** it queries all facilities, **Then** it receives
   data from all tenants without restriction.
2. **Given** a regular facility user session, **When** it attempts any operation that would
   require cross-facility access, **Then** the system denies the request with a permission error.
3. **Given** a super admin performing any cross-facility read or write, **When** the
   operation completes, **Then** an audit record exists that was written before the operation
   executed.

---

### User Story 3 — Subscription Plans Control Feature Access at Runtime (Priority: P3)

A facility's subscription plan determines which modules and features are available to its
staff. When a super admin changes a facility's plan or toggles a module, the change takes
effect immediately for new requests — no code deployment or server restart is required.
Staff in a facility whose plan does not include ecommerce cannot access ecommerce routes,
regardless of their individual role permissions.

**Why this priority**: Module gating is the business model enforcement layer. It must work
correctly before any module is built on top of it.

**Independent Test**: A facility on the Starter plan receives a 403 response on any Growth-
only module route. After a super admin upgrades the plan, the same facility immediately
accesses those routes. A downgrade immediately blocks access.

**Acceptance Scenarios**:

1. **Given** a facility on a plan without module X, **When** a staff member calls a route
   belonging to module X, **Then** the system returns a clear "module not available" response.
2. **Given** a super admin enables module X for a facility, **When** staff immediately retry
   the request, **Then** access is granted without any server restart.
3. **Given** a facility role that includes permissions for module X, **When** module X is
   disabled for that facility, **Then** the role permissions become irrelevant — the module
   gate blocks access before permission evaluation.

---

### User Story 4 — Platform Fails Safely Under Adverse Conditions (Priority: P4)

When the authentication cache is unavailable, the platform falls back to the primary data
store and continues operating correctly. When both are unavailable, the platform explicitly
rejects requests rather than accepting sessions whose validity cannot be confirmed. The
platform never silently accepts an unverifiable or potentially revoked session.

**Why this priority**: Fail-closed behaviour under infrastructure failure is a security
requirement. Silent acceptance of unverifiable state would allow suspended users or revoked
sessions to remain active during outages.

**Independent Test**: With the authentication cache deliberately made unavailable, all
authenticated requests complete correctly via the fallback path. With both the cache and
the primary data store unavailable, all authenticated requests receive a 503 response —
no request is accepted without verified session state.

**Acceptance Scenarios**:

1. **Given** the authentication cache is offline, **When** an authenticated request arrives,
   **Then** the system validates the session against the primary data store and proceeds normally.
2. **Given** both the authentication cache and primary data store are offline, **When** an
   authenticated request arrives, **Then** the system returns a service-unavailable error —
   it does not accept the session.
3. **Given** a session that was explicitly revoked, **When** a request arrives using that
   session, **Then** the system returns a session-revoked error — even if the JWT has not
   yet expired.

---

### Edge Cases

- What happens when a connection pool is exhausted — does a queued request inherit tenant
  context from a previous request that used the same underlying connection?
- How does the system behave when a facility's plan is changed while an existing request is
  mid-execution?
- What happens when a user belongs to two facilities and authenticates — which session's
  tenant context applies?
- What if an audit log write fails — does the associated operation proceed or roll back?

## Requirements

### Functional Requirements

- **FR-001**: The platform MUST ensure that no facility-scoped query returns data belonging
  to a different facility, enforced at the database engine level independently of application
  code correctness.
- **FR-002**: The platform MUST reject any request where tenant identity is absent or
  malformed with a hard error — it MUST NOT return empty results or silently succeed.
- **FR-003**: The platform MUST support exactly two access levels for the data store:
  facility-scoped access (subject to tenant isolation) and platform-level access (cross-
  facility, available only to super admins).
- **FR-004**: Super admin cross-facility operations MUST produce an audit record written
  before the operation executes. If the audit write fails, the operation MUST NOT proceed.
- **FR-005**: The platform MUST enforce module-based access: a facility can only use modules
  included in its active subscription plan plus any super admin overrides.
- **FR-006**: Within a facility, access to specific actions MUST be governed by a role-based
  permission system: users can only perform actions their assigned role permits.
- **FR-007**: The platform MUST support a feature-flag system within modules: individual
  features can be enabled or disabled per facility, overriding plan-level defaults.
- **FR-008**: Subscription plans, module access, and feature flags MUST be configurable via
  data — changes MUST take effect without code deployment or server restart.
- **FR-009**: The platform MUST support individual session revocation, all-session revocation
  for a user, and all-session revocation for a facility, each taking effect immediately.
- **FR-010**: When the authentication cache is unavailable, the platform MUST fall back to
  the primary data store for all authentication and revocation checks.
- **FR-011**: When both the authentication cache and primary data store are unavailable, the
  platform MUST reject all authenticated requests — it MUST NOT accept sessions whose
  revocation or authorization state cannot be confirmed.
- **FR-012**: The audit log MUST be append-only: no modification or deletion of audit records
  is permitted for any application role, including the platform administration role.
- **FR-013**: Tenant context MUST be scoped to a single database transaction — it MUST NOT
  persist beyond the transaction boundary or leak to subsequent operations on the same
  database connection.

### Key Entities

- **Facility**: A tenant organization (pharmacy, clinic, health network). Has a subscription
  plan, operational settings, and associated staff and patients.
- **User**: A platform user — either facility staff or a patient. Has credentials, an
  authorization-state version counter, and belongs to one or more facilities with a role.
- **Session**: A single login instance for a user. Independently revocable. Holds a refresh
  token. Belongs to exactly one facility (or none, for super admins).
- **Platform Module**: A named capability unit (e.g. ecommerce, prescriptions). Controlled
  at the platform level; enabled per facility via subscription.
- **Subscription Plan**: A bundle of module access rights and quantitative entitlements
  (seats, storage, API quota). Assigned to a facility; configurable without deployment.
- **Permission**: An atomic authorization unit describing one allowed action on one resource
  within one module. Assigned to roles, not directly to users.
- **Facility Role**: A named collection of permissions scoped to one facility. System roles
  are created automatically; facility admins can define custom roles.
- **Audit Log**: A permanent, append-only record of security-sensitive platform events.
  Facility users see only their own facility's records; super admins see all.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All cross-tenant isolation tests pass with zero failures — Facility A data is
  never returned in any Facility B request, covering reads, updates, and deletes.
- **SC-002**: Requests with missing or malformed tenant identity are rejected with an explicit
  error in 100% of cases — zero silent data returns or empty-result fallbacks.
- **SC-003**: 100% of super admin cross-facility operations produce a pre-execution audit
  record — zero unlogged cross-facility actions.
- **SC-004**: With the authentication cache offline, all authenticated requests succeed via
  fallback with latency under 3× the normal baseline — zero silent failures.
- **SC-005**: With both the authentication cache and primary data store offline, 100% of
  authenticated requests receive an explicit service-unavailable response — zero silent
  acceptances.
- **SC-006**: Modifying a facility's plan or module access takes effect for the next request
  — no deployment or restart required.
- **SC-007**: All Phase 1 acceptance criteria defined in the Architecture V2.1 document
  (§18) pass as automated tests before Phase 2 begins.
- **SC-008**: The audit log remains append-only — no automated test or manual operation
  can successfully UPDATE or DELETE an audit record via the application data layer.

## Assumptions

- PostgreSQL is available as the primary data store. A local or containerised instance is
  sufficient for development; a managed instance is assumed for production.
- PgBouncer is used as the connection pooler in transaction mode. This is required for the
  transaction-scoped tenant context mechanism to work safely.
- Redis is available as the authentication cache. A local or containerised instance is
  sufficient for development.
- The existing MongoDB-based backend will be removed entirely before Phase 1 code is
  written. There is no migration of existing data — this is a clean break.
- Automated tests are written with Vitest and run against a real database instance — not
  mocked. Mock-based isolation tests would not satisfy the Phase 1 gate.
- The platform currently has no paying customers on the MongoDB backend, so the clean break
  carries no production data risk.
- Quantitative entitlement enforcement (staff seats, API quota, storage) is in scope for
  schema and helper logic, but billing and payment processing are out of scope.

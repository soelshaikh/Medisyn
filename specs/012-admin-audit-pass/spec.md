# Feature Specification: Admin Panel Audit Pass

**Feature Branch**: `012-admin-audit-pass`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "Phase 12 — Admin Panel Audit Pass for MediSyn. The admin/ Next.js app has ~80+ pre-built pages covering users, roles, permissions, dashboard, orders, products, inventory, invoices, healthcare (prescriptions, compounding, ask-pharmacist, minor ailments, appointments), reports, audit log, FAQs, clinics, partners, and settings. TypeScript is clean (0 errors). The audit must verify: (1) every API module calls the correct backend endpoint path and correctly extracts the response shape; (2) every page that needs auth-permission guards has hasPermission() checks wired up; (3) the dashboard page shows live metrics from the backend; (4) the roles and permissions management pages are fully functional end-to-end; (5) any placeholder or stub pages are identified and brought to minimum viable state."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — API Integration Verified (Priority: P1)

A platform operator opens any page in the admin panel and sees real data from the pharmacy backend — not empty results from broken endpoint paths or mis-parsed response envelopes.

**Why this priority**: Without correct API wiring, the entire admin panel is non-functional regardless of visual polish. This is the foundational correctness gate for all other stories.

**Independent Test**: Can be tested by opening each module page (users, orders, prescriptions, appointments, etc.), confirming data appears, and verifying no 404 / network errors in browser dev tools.

**Acceptance Scenarios**:

1. **Given** the backend is running and has data, **When** an admin navigates to any list page (users, orders, prescriptions, etc.), **Then** the page displays real records within 3 seconds without console errors.
2. **Given** the backend returns `{ data: [...], total, page, limit }`, **When** the list page renders, **Then** pagination reflects `total` and the records shown match `data`.
3. **Given** the backend returns a single-record response as `{ data: { ... } }`, **When** a detail page renders, **Then** all fields display correctly without undefined/blank values on required fields.
4. **Given** an API call fails with a non-200 status, **When** the page receives the error, **Then** an error state is shown — not a permanent loading spinner.

---

### User Story 2 — Live Dashboard Metrics (Priority: P1)

An admin lands on the dashboard after login and sees real-time business metrics: total users, pending orders, healthcare request counts, and revenue summary — pulled live from the backend.

**Why this priority**: The dashboard is the first page admins see after login. Placeholder text on the dashboard immediately signals that the platform is not production-ready and erodes operator trust.

**Independent Test**: Navigate to `/dashboard` after login. All metric cards show non-zero values consistent with what exists in the backend database. No "—" or "0" placeholders on a populated database.

**Acceptance Scenarios**:

1. **Given** the backend has user records, **When** an admin views the dashboard, **Then** the total user count reflects the backend count.
2. **Given** there are pending orders, **When** an admin views the dashboard, **Then** the pending order count and today's order count are correct.
3. **Given** there are open healthcare requests, **When** an admin views the dashboard, **Then** compounding, ask-pharmacist, and appointment counts are shown accurately.
4. **Given** the dashboard data loads, **When** a metric card is clicked, **Then** the admin is navigated to the corresponding list page filtered to the relevant state.

---

### User Story 3 — Permission Guards on Sensitive Actions (Priority: P2)

An admin with limited permissions cannot see or trigger destructive or sensitive operations they are not authorized for. Permission checks are applied at the UI level before actions are rendered or submitted.

**Why this priority**: The CLAUDE.md confirms that MediSyn uses a permissions-based access model — no hardcoded role checks, no open admin actions. Without UI-level permission guards, any authenticated admin could perform any action regardless of their assigned role.

**Independent Test**: Log in as an admin without `orders.cancel` permission. Navigate to an order detail page. Confirm the Cancel Order button is hidden or disabled. Repeat for other destructive actions.

**Acceptance Scenarios**:

1. **Given** an admin lacks the relevant permission, **When** they view a detail page with a destructive action (void invoice, cancel order, reject prescription), **Then** the action button is not rendered.
2. **Given** an admin has the relevant permission, **When** they view the same detail page, **Then** the action button is rendered and functional.
3. **Given** an admin without the `roles.write` permission, **When** they navigate to the roles management page, **Then** create/edit/delete controls are hidden or disabled.
4. **Given** an admin without `users.write`, **When** they view a user detail page, **Then** edit/deactivate controls are not available.

---

### User Story 4 — Roles and Permissions Management (Priority: P2)

A platform super-admin can view all roles, create new roles, assign permissions to roles, edit existing roles, and delete unused roles — all through the admin panel UI without requiring backend configuration changes.

**Why this priority**: RBAC management is a core admin panel feature confirmed in CLAUDE.md. If roles and permissions cannot be managed through the UI, every permission change requires manual backend work.

**Independent Test**: Create a new role "Pharmacist Reviewer", assign `prescriptions.read` and `prescriptions.write` permissions, save it, verify it appears in the roles list, then edit it to add `compounding.read`, save again, and confirm the change persists.

**Acceptance Scenarios**:

1. **Given** a super-admin is on the roles list page, **When** they create a new role with a name and selected permissions, **Then** the role appears in the list and the assigned permissions are saved.
2. **Given** a role exists, **When** a super-admin edits it and changes the permission set, **Then** the updated permissions are reflected immediately after save.
3. **Given** a role with no assigned users, **When** a super-admin deletes it, **Then** it is removed from the list.
4. **Given** the permissions page, **When** an admin views it, **Then** all system permissions are listed grouped by domain (users, orders, healthcare, etc.).

---

### User Story 5 — No Stub or Permanently-Loading Pages (Priority: P3)

Every page in the admin panel displays real content or a meaningful empty state. No page shows permanent loading spinners, placeholder text ("Dashboard" heading with no data), or silent API failures.

**Why this priority**: Stub pages that silently fail or show placeholder content create confusion during QA and demos. This is the final polish step to confirm minimum viability across all routes.

**Independent Test**: Navigate to every route in the admin panel sidebar. Each page either: (a) shows real data from backend, (b) shows a proper empty state if no data exists, or (c) shows a clear error state if the backend is unreachable. No page hangs indefinitely.

**Acceptance Scenarios**:

1. **Given** no data exists for a domain, **When** an admin navigates to its list page, **Then** an empty state with explanatory text is shown — not a blank page or permanent spinner.
2. **Given** the backend is unreachable for a specific module, **When** the page loads, **Then** an error state with retry option is shown within 10 seconds.
3. **Given** all pages in the admin panel, **When** a smoke-test navigates through each route, **Then** zero pages remain in a loading state after data resolves.

---

### Edge Cases

- What happens when a list page API returns `total: 0` but the response shape uses a different key (e.g., `count`)?
- How does a detail page handle a 404 from the backend (record deleted between list view and detail click)?
- What happens when `hasPermission()` is called before the auth store has rehydrated — does it return false (safe default) or throw?
- What if a backend endpoint path changed and now returns 404 — does the page show an error state or an empty results list?
- What if an admin has no roles assigned — do permission-gated pages show nothing or show an appropriate "access restricted" message?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every API module function MUST call a URL path that matches a registered route in the Express backend — no 404 responses on valid data-present requests.
- **FR-002**: Every API module function that receives a paginated list MUST extract records from the correct envelope key (`data.data` or `data`) and pagination from `total`, `page`, `limit`.
- **FR-003**: Every API module function that receives a single record MUST extract it from `response.data.data` (not `response.data` directly, unless the backend route returns the record at the top level).
- **FR-004**: The dashboard page MUST call the backend metrics endpoint and render live user, order, healthcare, and revenue figures — no hardcoded zeros or placeholder dashes.
- **FR-005**: Every action button that modifies data (cancel, void, approve, reject, delete) MUST call `hasPermission(requiredPermission)` before rendering — hidden when false.
- **FR-006**: The roles list page MUST fetch all roles from the backend, display name and permission count, and provide create/edit/delete controls.
- **FR-007**: The role detail/edit page MUST load the role, display its current permissions as a checked list grouped by domain, and save changes back to the backend.
- **FR-008**: The permissions page MUST list all available system permissions grouped by domain.
- **FR-009**: Every list page MUST render an empty state component when the backend returns zero records.
- **FR-010**: Every list page MUST render an error state with retry when the API call fails.
- **FR-011**: Every detail page MUST handle a 404 response by showing a "Record not found" message and a back navigation link.

### Key Entities

- **AdminRole**: Named grouping of permissions; has `name`, `slug`, `description`, `permissions[]`, `isSystem` flag.
- **Permission**: Atomic capability string (e.g., `orders.cancel`); grouped by domain prefix.
- **DashboardMetrics**: Aggregated counts and totals for users, orders, healthcare requests, and revenue — fetched fresh on each dashboard load.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every admin page loads real data within 3 seconds on a local development setup — no page shows placeholder content after data resolves.
- **SC-002**: All API modules are verified against the backend router — zero 404 errors on any valid data request across all admin modules.
- **SC-003**: The dashboard displays accurate live metrics — values match backend state within the same request cycle.
- **SC-004**: 100% of destructive/sensitive action buttons respect the permission model — actions are hidden for admins who lack the required permission.
- **SC-005**: Roles and permissions management UI completes a full CRUD cycle (create role → assign permissions → edit → delete) without backend-side manual intervention.
- **SC-006**: All 50+ pre-built admin pages pass a smoke test — each navigates without console errors and reaches a stable rendered state (data, empty, or error).

---

## Assumptions

- Backend is running on port 3001 at `http://localhost:3001/api/v1` — this is the source-of-truth URL already configured in `admin/.env.local`.
- Backend endpoint paths are defined in `backend/src/` router files — these are the authoritative source for correct URL path verification.
- `hasPermission(slug)` function is already implemented in `adminAuthStore` and returns `boolean` — no new auth infrastructure is needed.
- The audit scope is runtime correctness (endpoint paths, response shape parsing, permission guards) — not visual design, UX polish, or new feature addition.
- TypeScript is already clean (0 errors) — fixes will maintain this baseline; no new TypeScript errors will be introduced.
- Pages identified as stubs will be brought to "minimum viable state" — meaning: fetches and displays real data with empty/error states — not to full feature design parity.
- The `useAuthStore` (or `adminAuthStore`) permission check should return `false` (not throw) when called before rehydration — safe default prevents flicker-in of unauthorized UI.

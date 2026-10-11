# Feature Specification: Admin Panel Scaffold

**Feature Branch**: `011-admin-panel-scaffold`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "Phase 11 — Admin Panel scaffold for MediSyn. Standalone Next.js app at admin/ folder. Scope: app scaffolding (folder structure, design tokens, API client pointing to backend), admin login/logout flow, protected route guard (redirect to login if not authenticated), and a minimal dashboard shell page. All data via REST API calls to the Express backend — no direct DB access. Must follow confirmed standards: TanStack Query for all API calls, Zustand for auth session, CSS design tokens in tokens.css, component layers (ui/ + common/ + features/)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Login (Priority: P1)

An admin user opens the admin panel URL (e.g. `admin.medisyn.ca`). They see a login page. They enter their email and password, submit the form, and — if credentials are valid — are redirected to the dashboard shell. If credentials are invalid, they see an error message and remain on the login page.

**Why this priority**: Login is the entry point to the entire admin panel. No other feature is accessible without it. The entire protected-route system depends on this working first.

**Independent Test**: Navigate to `/login`, enter valid admin credentials, confirm redirect to `/dashboard`. Enter invalid credentials, confirm error is shown and user stays on `/login`.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on `/login`, **When** they submit valid email and password, **Then** the system stores the session token, redirects to `/dashboard`, and the user sees the dashboard shell.
2. **Given** an unauthenticated user on `/login`, **When** they submit incorrect credentials, **Then** the system shows a clear error message, no token is stored, and the user remains on `/login`.
3. **Given** an already-authenticated user who navigates to `/login`, **When** the page loads, **Then** they are redirected to `/dashboard` (no re-login needed).

---

### User Story 2 - Protected Route Guard (Priority: P1)

Any admin page (e.g. `/dashboard`, `/users`, `/orders`) must be inaccessible to unauthenticated visitors. When an unauthenticated user attempts to navigate to a protected route, they are immediately redirected to `/login`. When an authenticated user navigates to any protected route, they are allowed through.

**Why this priority**: The route guard is the security foundation of the entire admin panel. Every feature added later depends on this working correctly.

**Independent Test**: Without logging in, navigate directly to `/dashboard`. Confirm redirect to `/login`. Log in, then navigate to `/dashboard`. Confirm access is granted.

**Acceptance Scenarios**:

1. **Given** a user with no active session, **When** they navigate to any protected route, **Then** they are redirected to `/login` without seeing the protected page content.
2. **Given** an authenticated user with a valid session, **When** they navigate to any protected route, **Then** they see the page content without being redirected.
3. **Given** an authenticated user whose session token has expired, **When** they navigate to a protected route, **Then** they are redirected to `/login` and their expired token is cleared.

---

### User Story 3 - Admin Logout (Priority: P2)

An authenticated admin can click a logout button (in the dashboard shell header or sidebar). On clicking, their session token is cleared, and they are redirected to the login page. Navigating back to a protected route after logout redirects them to `/login` again.

**Why this priority**: Logout is a mandatory security feature. It is lower priority than login/guards only because it cannot be tested until login works.

**Independent Test**: Log in, confirm dashboard is accessible. Click logout, confirm redirect to `/login`. Navigate back to `/dashboard`, confirm redirect to `/login`.

**Acceptance Scenarios**:

1. **Given** an authenticated admin on the dashboard, **When** they click the logout button, **Then** their session token is cleared from client state and they are redirected to `/login`.
2. **Given** an admin who has just logged out, **When** they navigate back to a protected route, **Then** they are redirected to `/login` (session is fully cleared).

---

### User Story 4 - Dashboard Shell Page (Priority: P2)

After a successful login, the authenticated admin sees a minimal but structurally complete dashboard shell: a sidebar with navigation links, a top header with the admin's name/email and a logout button, and a main content area. The shell is the persistent layout that will host all future admin features.

**Why this priority**: The shell is the visual container for all future admin work. It must be in place before any feature pages are built. It is P2 because it requires login (P1) to be complete first.

**Independent Test**: Log in as a valid admin. Confirm the `/dashboard` page renders a sidebar, a header showing the logged-in user's name/email, and a main content area. Confirm the layout is responsive and does not break at mobile widths.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they land on `/dashboard`, **Then** they see a layout with a sidebar, a top header, and a main content area with a welcome/placeholder message.
2. **Given** the dashboard shell is rendered, **When** viewed at various screen widths, **Then** the layout responds appropriately (sidebar collapses or hides on small screens).
3. **Given** the dashboard shell header, **When** the admin's name and email are displayed, **Then** they reflect the authenticated user's actual profile data from the session.

---

### User Story 5 - Session Persistence on Page Refresh (Priority: P3)

An authenticated admin who refreshes the page or closes and reopens the tab should remain logged in without being redirected to `/login`. Their session token is persisted across page reloads.

**Why this priority**: P3 because it is a usability enhancement. The app is functionally complete without it, but admins would be forced to re-login on every page refresh, which is unacceptable in practice.

**Independent Test**: Log in, refresh the page. Confirm the dashboard reloads without redirecting to `/login` and the user's name/email still appears in the header.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they refresh the page, **Then** the session is restored from persisted storage and they remain on the protected page without redirection.
2. **Given** a persisted session token that has expired, **When** the admin refreshes the page, **Then** the expired token is detected, cleared, and the admin is redirected to `/login`.

---

### Edge Cases

- What happens when the backend is unreachable during login? User sees a connection error message; no partial state is written.
- What happens if a token is present in storage but the backend rejects it as invalid (e.g. revoked)? The guard treats the response as unauthenticated, clears the token, and redirects to `/login`.
- What happens if the admin panel is opened in two browser tabs simultaneously and the user logs out in one tab? The other tab reflects the logged-out state on the next navigation or route check.
- What happens if design tokens are missing from `tokens.css`? Components that reference undefined tokens fall back to browser defaults — no runtime crash.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST have a standalone Next.js project at `admin/` with its own `package.json`, independent of `frontend/` and `backend/`.
- **FR-002**: The folder structure MUST include: `src/app/`, `src/components/ui/`, `src/components/common/`, `src/components/features/`, `src/api/`, `src/hooks/`, `src/stores/`, `src/styles/`, `src/types/`, `src/lib/`.
- **FR-003**: All design token values (colors, spacing, typography, shadows, radii, transitions, z-index) MUST be defined as CSS custom properties in `src/styles/tokens.css` and MUST NOT be hardcoded in component files.
- **FR-004**: A centralized `apiClient` (Axios instance) MUST be configured in `src/lib/apiClient.ts` with the backend base URL and an interceptor that injects the admin's JWT access token into every outgoing request.
- **FR-005**: TanStack Query (`QueryClientProvider`) MUST wrap the app's root layout and be the exclusive mechanism for all server-state fetching and mutations — no raw `fetch()` or Axios calls inside components.
- **FR-006**: Zustand MUST be the store for the admin's auth session state (access token, admin user profile). A dedicated auth store MUST live in `src/stores/authStore.ts`.
- **FR-007**: The system MUST provide a `/login` page with an email + password form that submits credentials to the Express backend's auth endpoint (`POST /api/v1/auth/login`).
- **FR-008**: On successful login, the system MUST store the returned access token (and refresh token) in the Zustand auth store (with localStorage persistence) and redirect the admin to `/dashboard`.
- **FR-009**: The system MUST implement a route guard that redirects unauthenticated users from any protected route to `/login`.
- **FR-010**: The system MUST provide a logout mechanism that clears all session state from Zustand and localStorage and redirects to `/login`.
- **FR-011**: The system MUST provide a `/dashboard` page protected by the route guard, rendering a shell layout with a sidebar, a header showing the logged-in user's name/email and a logout button, and a placeholder main content area.
- **FR-012**: The dashboard shell sidebar MUST include navigation placeholder links for the admin sections defined in the backend (e.g. Users, Orders, Prescriptions, Compounding, Appointments, Reports).
- **FR-013**: The app MUST configure Tailwind CSS v4 to reference design token CSS custom properties rather than hardcoded values.

### Key Entities *(include if feature involves data)*

- **Admin Session**: The authenticated state held in Zustand — includes access token (JWT string), optional refresh token, and admin user profile (id, email, name, roles/permissions array). Persisted to localStorage so it survives page refresh.
- **Admin User Profile**: Subset of the backend user record returned on login — id, email, first/last name, role(s), permissions list. Read-only in this phase; used to personalize the shell header.
- **API Client**: A configured Axios instance used by all TanStack Query hooks. Carries the base URL pointing to the Express backend and an auth interceptor. Returned errors are normalized to a consistent shape before reaching query hooks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin with valid credentials can go from the login page to the dashboard shell in under 3 seconds on a standard broadband connection.
- **SC-002**: Navigating to any protected route without a valid session results in a redirect to `/login` within 200ms (no flash of protected content).
- **SC-003**: After logout, no trace of the access token or user profile remains in localStorage or Zustand state.
- **SC-004**: A page refresh on any protected route restores the session and keeps the admin on the same page (no redirect to login for a valid, non-expired token).
- **SC-005**: All 13 folder-structure directories are present and correctly placed under `admin/src/` before any feature pages are built.
- **SC-006**: Every visible color, spacing value, and typographic style in the login page and dashboard shell is traceable to a CSS custom property in `tokens.css` — zero hardcoded hex/px values in component files.

## Assumptions

- The Express backend is running and reachable at the URL configured in the admin app's `.env.local` (`NEXT_PUBLIC_API_URL`). The admin app does not start or manage the backend process.
- Admin accounts are pre-created in the backend database. There is no self-registration flow for admins — user management is a later phase.
- JWT access tokens returned by the backend carry a standard expiry claim (`exp`). The admin panel reads this claim to detect expiry on page load; automatic silent token refresh is out of scope for this phase.
- Tokens are persisted in `localStorage` for this phase. Hardening to `httpOnly` cookies is deferred to the security hardening phase (Phase 10, already scoped).
- The dashboard shell sidebar navigation links are static placeholders pointing to route paths that do not yet have pages; they may show a 404 or "coming soon" state.
- Tailwind CSS v4 is used for utility classes in addition to the token system — components may use Tailwind utilities that themselves reference the CSS custom properties.
- No admin-specific onboarding or first-run setup flow is required in this phase.
- The design token values listed in `CLAUDE.md` (colors, spacing, typography, etc.) are the authoritative source for `tokens.css` in this phase; visual refinement is a later concern.

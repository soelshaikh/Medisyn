# Research: Admin Panel Scaffold

**Feature**: Admin Panel Scaffold (`specs/011-admin-panel-scaffold`)
**Date**: 2026-10-11

---

## Decision 1: Login Endpoint Selection

**Decision**: Use `POST /api/v1/auth/super-admin/login` for the admin panel — no `facilitySlug` required.

**Rationale**: The admin panel (`admin.medisyn.ca`) is a platform-level tool. The backend exposes a dedicated `super-admin/login` endpoint that verifies `isPlatformSuperAdmin` server-side. Regular facility-scoped staff (pharmacist, content_manager, etc.) are tied to a specific facility and use the `POST /api/v1/auth/login` endpoint with a `facilitySlug`. Supporting facility-scoped staff login in the admin panel scaffold is deferred — it would require a `facilitySlug` input field and different permission checks. The super-admin flow covers the primary use case for platform-level administration.

**Alternatives considered**:
- `POST /api/v1/auth/login` with `facilitySlug` field — rejected for scaffold phase; appropriate for facility staff portals, not a platform admin panel
- A combined login form that auto-detects admin type — over-engineered for a scaffold; deferred

**Status**: CONFIRMED

---

## Decision 2: Route Guard Mechanism

**Decision**: Client-side layout guard in `(protected)/layout.tsx` — a Client Component that reads the Zustand auth store on mount and calls `router.replace('/login')` if no valid token is present.

**Rationale**: Next.js middleware (Edge Runtime) cannot read localStorage, which is where the access token is persisted. Using middleware would require storing the access token in a non-httpOnly cookie, which has its own trade-offs. For this scaffold phase, a client-side layout guard is simpler, well-understood, and consistent with how most admin dashboards work. The brief render-then-redirect flash is handled by showing a full-screen loading spinner until the auth state is resolved.

**Alternatives considered**:
- Next.js `middleware.ts` (Edge) — rejected because it cannot read localStorage; would need a cookie-based token flag, adding complexity
- Non-httpOnly `admin_authed` cookie as a presence flag + middleware — valid approach but over-engineered for the scaffold; can be added in Phase 10 hardening

**Status**: CONFIRMED

---

## Decision 3: Access Token Storage

**Decision**: Zustand store with `persist` middleware writing to `localStorage` under key `admin-auth`.

**Rationale**: The access token must survive a page refresh (SC-004 in the spec). Zustand's built-in `persist` middleware handles rehydration from localStorage on app load, covering this requirement with minimal code. The stored payload is: `{ accessToken, user }`. Expiry is checked by decoding the JWT `exp` claim on each rehydration.

**Refresh token**: httpOnly cookie — set/cleared by the backend. The frontend never reads or stores it. When access token expiry is detected, the app can call `POST /api/v1/auth/refresh` (passing the expired access token in `Authorization: Bearer` header — the cookie is sent automatically by the browser). **Automatic silent refresh is out of scope for this phase** — on expiry the user is redirected to `/login`.

**Alternatives considered**:
- `sessionStorage` — rejected because it doesn't survive page close, violating SC-004
- In-memory only (no persist) — rejected because page refresh would log the user out every time
- httpOnly cookie for access token — rejected for scaffold phase; recommended for Phase 10 hardening

**Status**: CONFIRMED

---

## Decision 4: JWT Expiry Detection

**Decision**: Decode the JWT `exp` claim using `atob()` + `JSON.parse()` (no external library). On Zustand store rehydration and on each route guard check, extract `exp` and compare to `Date.now() / 1000`. If expired, clear the store and redirect.

**Rationale**: The JWT is a standard HS256 token (`header.payload.signature`). Decoding the payload for the `exp` claim requires only base64 decoding — no signature verification needed (verification happens on the backend for every API call). Using `atob()` keeps the bundle lean; no `jsonwebtoken` or `jose` dependency needed just to read a timestamp.

**Alternatives considered**:
- `jose` library — rejected as overkill for reading a single claim
- `jsonwebtoken` in the browser — rejected (designed for Node.js; adds significant bundle weight)
- Trusting API 401 responses to detect expiry — valid fallback but introduces one failed round-trip before redirect; decoding locally avoids it

**Status**: CONFIRMED

---

## Decision 5: TanStack Query Configuration

**Decision**: Use `@tanstack/react-query` v5 with a single `QueryClient` created per app instance (not per request, since this is a pure client-side SPA). `QueryClientProvider` wraps `<body>` in the root `app/layout.tsx`.

**Rationale**: Next.js App Router + TanStack Query v5 recommends creating the `QueryClient` in a client component provider so it persists across navigations. The admin panel is a protected SPA after login — no server-side data prefetching needed at this phase. Default stale times (0) and cache times (5 min) are adequate for the scaffold.

**Alternatives considered**:
- `getQueryClient()` singleton pattern (RSC + prefetch) — unnecessary for a purely client-rendered admin panel; adds complexity
- SWR — rejected per CLAUDE.md (TanStack Query is confirmed)

**Status**: CONFIRMED

---

## Decision 6: Axios Interceptor Pattern

**Decision**: A single Axios instance (`apiClient`) created in `src/lib/apiClient.ts`. A request interceptor reads the current `accessToken` from the Zustand auth store (using `useAuthStore.getState().accessToken`) and adds `Authorization: Bearer <token>`. A response interceptor handles 401 responses by clearing the auth store (triggering the route guard redirect).

**Rationale**: Reading Zustand state via `getState()` (not `useStore`) is safe outside of React components — it gives the interceptor access to the latest token without hooks. The 401 response interceptor provides a backstop: if the backend rejects a token, the frontend clears state and lets the route guard redirect.

**Alternatives considered**:
- Passing the token manually in every API call — rejected (repetition, error-prone)
- Storing token in a module-level variable — rejected (doesn't stay in sync with Zustand store)

**Status**: CONFIRMED

---

## Decision 7: Port Assignment

**Decision**: Admin panel dev server runs on port `3002`. Backend runs on `3001`.

**Rationale**: Backend `.env.example` shows `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002`. Port 3000 is reserved for the patient-facing frontend. Port 3002 is already whitelisted in CORS for the admin panel.

**Status**: CONFIRMED (inferred from backend `.env.example`)

---

## Decision 8: Admin-Only Role Enforcement

**Decision**: The route guard checks `user.isSuperAdmin` (from the decoded JWT or the Zustand user object) in addition to token presence. If an authenticated user is NOT a super admin, they are redirected to `/login` with an error message.

**Rationale**: The super-admin login endpoint already verifies `isPlatformSuperAdmin` server-side. However, if a non-super-admin access token were somehow used (e.g., from a different app), the admin panel should still reject it client-side. The JWT payload includes `isSuperAdmin: boolean` — the guard reads this.

**Status**: CONFIRMED

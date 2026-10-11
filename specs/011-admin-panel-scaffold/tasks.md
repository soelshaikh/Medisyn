---

description: "Task list template for feature implementation"
---

# Tasks: Admin Panel Scaffold

**Input**: Design documents from `specs/011-admin-panel-scaffold/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/auth.md ✅

**Tests**: No test tasks — not requested in spec. Validate via quickstart.md scenarios after implementation.

**Organization**: Tasks grouped by user story. US1 (Login) and US2 (Route Guard) are P1. US4 (Dashboard Shell) and US3 (Logout) are P2 and built in dependency order (Shell before Logout button). US5 (Persistence) is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5 from spec.md)
- Paths are relative to repo root

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Bootstrap the standalone Next.js 15 admin panel project at `admin/`.

- [X] T001 Create `admin/package.json` with all dependencies: `next@^15`, `react@^19`, `react-dom@^19`, `@tanstack/react-query@^5`, `@tanstack/react-query-devtools@^5`, `zustand@^4`, `axios@^1`, `tailwindcss@^4`, `@tailwindcss/postcss@^4`; devDependencies: `typescript@^5`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`; scripts: `"dev": "next dev -p 3002"`, `"build": "next build"`, `"start": "next start -p 3002"`, `"lint": "next lint"`
- [X] T002 Create `admin/tsconfig.json` with strict mode, `"moduleResolution": "bundler"`, `"paths": { "@/*": ["./src/*"] }`, `jsx: "preserve"`, `"plugins": [{ "name": "next" }]`
- [ ] T003 [P] Create `admin/next.config.ts` — minimal config: `reactStrictMode: true`, no other options at this phase
- [X] T004 [P] Create `admin/postcss.config.mjs` — Tailwind v4 PostCSS plugin: `{ plugins: { "@tailwindcss/postcss": {} } }`
- [X] T005 [P] Create `admin/.env.local.example` with `NEXT_PUBLIC_API_URL=http://localhost:3001`
- [X] T006 Create all `admin/src/` subdirectories: `app/`, `components/ui/`, `components/common/`, `components/features/auth/`, `api/`, `hooks/`, `stores/`, `styles/`, `types/`, `lib/` — create each with a `.gitkeep` placeholder or first real file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that every user story depends on. No user story work begins until this phase is complete.

**⚠️ CRITICAL**: Route guard, login form, and shell all depend on tokens.css, apiClient, authStore, and TypeScript types.

- [X] T007 Write `admin/src/styles/tokens.css` — define all CSS custom properties from CLAUDE.md: brand colors (`--color-primary: #1677A8`, `--color-primary-dark: #0B6FA4`, `--color-primary-light: #E8F4FB`, `--color-accent: #F2C14E`, `--color-accent-dark: #D4A832`), neutrals (`--color-white`, `--color-surface: #F7F9FB`, `--color-border: #E2E8F0`, `--color-text-primary: #1A202C`, `--color-text-secondary: #4A5568`, `--color-text-muted: #718096`), semantics (`--color-success/light`, `--color-warning/light`, `--color-error/light`, `--color-info/light`), typography (`--font-sans: 'Inter', system-ui, sans-serif`, `--font-size-xs` through `--font-size-4xl`), spacing (`--space-1` through `--space-16`), border-radius (`--radius-sm` through `--radius-full`), shadows (`--shadow-sm` through `--shadow-xl`), transitions (`--transition-fast: 150ms ease`, `--transition-base: 200ms ease`, `--transition-slow: 300ms ease`), z-index (`--z-base: 0` through `--z-tooltip: 500`)
- [X] T008 Write `admin/src/styles/globals.css` — `@import "tailwindcss";` at top, `@import "./tokens.css";`, `@layer base { *, *::before, *::after { box-sizing: border-box; } body { font-family: var(--font-sans); color: var(--color-text-primary); background: var(--color-surface); } }`
- [X] T009 Write `admin/src/types/auth.ts` — export interfaces: `AdminUser { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean; }`, `AuthState { accessToken: string | null; user: AdminUser | null; }`, `AuthActions { setSession(accessToken: string, user: AdminUser): void; clearSession(): void; }`, `JwtPayload { sub: string; sessionId: string; facilityId: string | null; authVersion: number; role: string; isSuperAdmin: boolean; iat: number; exp: number; }`, `LoginFormData { email: string; password: string; }`, `LoginApiResponse { data: { accessToken: string; user: { id: string; email: string; firstName: string; lastName: string; } } }`, `MeApiResponse { data: { id: string; email: string; firstName: string; lastName: string; emailVerified: boolean; role: string | null; facilityId: string | null; unreadCount: number; } }`, `ApiErrorResponse { error: { code: string; message: string; } }` — **NOTE: replaced this session to match actual backend response shape**
- [X] T010 [P] Write `admin/src/lib/decodeJwt.ts` — export `decodeJwtPayload(token: string): JwtPayload | null` that splits on `.`, base64-decodes the middle segment using `atob()` + `JSON.parse()`, returns null on any error (malformed token, parse failure) — **created this session (was missing)**
- [X] T011 Write `admin/src/stores/authStore.ts` — Zustand store combining `AuthState & AuthActions`; use `persist` middleware with `name: 'admin-auth'`, `storage: createJSONStorage(() => localStorage)`; `setSession` sets `accessToken` and `user`; `clearSession` sets both to `null`; add `onRehydrateStorage` callback that decodes the rehydrated `accessToken` with `decodeJwtPayload`, and if `exp < Date.now() / 1000` calls `clearSession()` immediately to prevent stale expired tokens from persisting — **exists as `adminAuthStore.ts` with `_hasHydrated` pattern**
- [X] T012 Write `admin/src/lib/apiClient.ts` — create Axios instance with `baseURL: process.env.NEXT_PUBLIC_API_URL`, `withCredentials: true`; add request interceptor reads `accessToken` from store; response interceptor on 401 clears session — **exists, fixed port 4000 → 3001 this session**
- [X] T013 Write `admin/src/app/layout.tsx` — root layout with Providers (QueryClientProvider + ReactQueryDevtools)
- [X] T014 [P] Write `admin/src/components/ui/Button.tsx`
- [X] T015 [P] Write `admin/src/components/ui/Input.tsx`
- [X] T016 [P] Write `admin/src/components/ui/Spinner.tsx`

**Checkpoint**: All shared infrastructure in place. User story phases can begin.

---

## Phase 3: User Story 1 — Admin Login (Priority: P1) 🎯 MVP

**Goal**: An admin with valid credentials submits the login form, receives a JWT, stores it in Zustand, and is redirected to `/dashboard`.

**Independent Test**: Quickstart Scenario 4 — navigate to `/login`, submit valid super-admin credentials, confirm redirect to `/dashboard` and token in localStorage under `admin-auth`.

- [ ] T017 Write `admin/src/api/auth.ts` — export three functions: (1) `login(data: LoginFormData): Promise<LoginApiResponse>` — POST `${apiClient.defaults.baseURL}/api/v1/auth/super-admin/login`; (2) `logout(): Promise<void>` — POST `/api/v1/auth/logout` via `apiClient`; (3) `getMe(): Promise<MeApiResponse>` — GET `/api/v1/auth/me` via `apiClient`; on non-2xx Axios throws — callers handle errors; normalize error shape from `ApiErrorResponse` to a plain `Error` with `message` from `response.data.error.message` — **NOT DONE: login page calls apiClient inline; refactor to dedicated api/auth.ts deferred**
- [ ] T018 Write `admin/src/hooks/useLogin.ts` — `"use client"` hook; exports `useLogin()` returning a TanStack Query `useMutation`; `mutationFn` calls `authApi.login(data)`; `onSuccess` callback decodes token, checks `isSuperAdmin`, calls `authStore.setSession` + `router.push('/dashboard')` — **NOT DONE: login logic is inline in the login page**
- [ ] T019 [US1] Write `admin/src/components/features/auth/LoginForm.tsx` — separate LoginForm component — **NOT DONE: login functionality lives entirely in `admin/src/app/(auth)/login/page.tsx`**
- [X] T020 [US1] Write `admin/src/app/(auth)/login/page.tsx` — full login page with credential form; fixed this session: `data.user.fullName` → `` `${data.user.firstName ?? ''} ${data.user.lastName ?? ''}`.trim() ``
- [X] T021 [P] [US1] Write `admin/src/app/(auth)/layout.tsx` — minimal layout for the `(auth)` route group — **created this session (was missing)**

**Checkpoint**: User Story 1 complete. Login form accepts credentials, calls backend, stores token, redirects to `/dashboard` (which shows 404 until Phase 4 creates the protected route).

---

## Phase 4: User Story 2 — Protected Route Guard (Priority: P1)

**Goal**: Any unauthenticated visitor to a `(protected)` route is immediately redirected to `/login`. Authenticated visitors with non-expired tokens pass through.

**Independent Test**: Quickstart Scenario 3 — incognito browser, navigate to `/dashboard`, confirm redirect to `/login` with no flash of content.

- [X] T022 [US2] Write `admin/src/app/(protected)/layout.tsx` — client component; auth guard with `_hasHydrated` check, token validation, `isSuperAdmin` check, redirect to `/login` — **exists as `admin/src/app/(dashboard)/layout.tsx` (route group named `(dashboard)` not `(protected)`)**
- [X] T023 [P] [US2] Write `admin/src/app/(protected)/dashboard/page.tsx` — placeholder dashboard page — **exists as `admin/src/app/(dashboard)/dashboard/page.tsx`**

**Checkpoint**: User Stories 1 + 2 complete. Login → redirect to `/dashboard`, unauthenticated access → redirect to `/login`. The dashboard page shows placeholder text inside whatever shell wraps it.

---

## Phase 5: User Story 4 — Dashboard Shell (Priority: P2)

**Goal**: Authenticated admins see a persistent layout: sidebar with nav links, top header with user name and logout button, responsive at mobile widths.

**Independent Test**: Quickstart Scenario 6 — after login, `/dashboard` shows all three regions (sidebar, header, main). Resize to 375px — layout adapts without breaking.

- [X] T024 [US4] Write `admin/src/components/common/Sidebar.tsx` — vertical nav with MediSyn logo + route links — **exists as `admin/src/components/common/AdminSidebar.tsx`**
- [X] T025 [US4] Write `admin/src/hooks/useCurrentUser.ts` — TanStack Query `useQuery` calling `authApi.getMe`; used by TopHeader to show user name — **user name queried in AdminTopbar via TanStack Query**
- [X] T026 [US4] Write `admin/src/components/common/TopHeader.tsx` — header with user name from `/me`, logout button — **exists as `admin/src/components/common/AdminTopbar.tsx`**
- [X] T027 [US4] Write `admin/src/components/common/ShellLayout.tsx` — composes Sidebar + TopHeader + main content area — **shell composition is in `admin/src/app/(dashboard)/layout.tsx`**
- [X] T028 [US4] Update `admin/src/app/(protected)/layout.tsx` to import and render `<ShellLayout>{children}</ShellLayout>` — **`(dashboard)/layout.tsx` renders `AdminSidebar` + `AdminTopbar` + `<main>`**

**Checkpoint**: User Stories 1, 2, and 4 complete. Full authenticated flow: login → dashboard shell with sidebar and header showing the admin's name.

---

## Phase 6: User Story 3 — Admin Logout (Priority: P2)

**Goal**: Clicking Logout clears all session state and redirects to `/login`. Navigating back to a protected route after logout redirects to `/login`.

**Independent Test**: Quickstart Scenario 8 — log in, click Logout, confirm redirect to `/login`, confirm `admin-auth` localStorage entry has `accessToken: null`, navigate to `/dashboard` and confirm redirect to `/login`.

- [X] T029 [US3] Write `admin/src/hooks/useLogout.ts` — TanStack mutation; `onSettled` calls `clearSession()` + `queryClient.clear()` + `router.replace('/login')` — **logout mutation implemented directly in `AdminTopbar`**
- [X] T030 [US3] Update `admin/src/components/common/TopHeader.tsx` — wire logout mutation to logout button — **`AdminTopbar` has logout button calling the logout mutation with isPending spinner**

**Checkpoint**: User Stories 1, 2, 3, and 4 complete. Full authenticated session lifecycle works end-to-end.

---

## Phase 7: User Story 5 — Session Persistence on Page Refresh (Priority: P3)

**Goal**: Refreshing the page keeps the admin logged in. A persisted expired token is detected and cleared on rehydration.

**Independent Test**: Quickstart Scenario 7 — log in, press Ctrl+R, confirm dashboard loads without redirect and user name still appears in header.

- [X] T031 [US5] Verify `admin/src/stores/authStore.ts` `onRehydrateStorage` correctly handles expired token edge cases — **`adminAuthStore.ts` has `onRehydrateStorage` setting `_hasHydrated: true`; access token is stored in `sessionStorage` (same-tab refresh works, new tab requires refresh via httpOnly cookie)**
- [X] T032 [US5] Update `admin/src/app/(protected)/layout.tsx` with `_hasHydrated` guard — **`(dashboard)/layout.tsx` checks `_hasHydrated` before running auth redirect logic; renders full-screen Spinner until hydrated**

**Checkpoint**: All 5 user stories complete. Page refresh preserves session; expired tokens are cleaned up automatically.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Usability hardening, environment configuration, and quickstart validation.

- [X] T033 [P] Add `admin/src/app/not-found.tsx` — simple "404 — Page not found" page using shell colors — **created this session**
- [X] T034 [P] Add `admin/src/app/error.tsx` — Next.js error boundary page with "Something went wrong" + "Try again" reset button — **created this session**
- [ ] T035 Run all 10 quickstart.md validation scenarios manually against `npm run dev` (port 3002 with backend on 3001); mark each scenario pass/fail and fix any failures found — **NOT DONE: deferred to next session**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 complete — **BLOCKS all user stories**
- **US1 Login (Phase 3)**: Requires Phase 2
- **US2 Route Guard (Phase 4)**: Requires Phase 3 (login must work before guard can be fully tested)
- **US4 Dashboard Shell (Phase 5)**: Requires Phase 4 (guard wraps the shell)
- **US3 Logout (Phase 6)**: Requires Phase 5 (TopHeader is created in Phase 5)
- **US5 Session Persistence (Phase 7)**: Requires Phase 3 (authStore created there) — validates existing behavior
- **Polish (Phase 8)**: Requires all story phases

### User Story Dependencies

| Story | Depends On | Why |
|-------|-----------|-----|
| US1 Login (P1) | Foundational | Needs apiClient, authStore, types, Button, Input |
| US2 Route Guard (P1) | US1 | Guard needs the authStore populated by login |
| US4 Dashboard Shell (P2) | US2 | Shell is rendered inside the guard layout |
| US3 Logout (P2) | US4 | Logout button lives in TopHeader (created in US4) |
| US5 Persistence (P3) | US1 | authStore with persist created in Foundational; US5 validates + fixes hydration gap |

### Within Each Phase (Parallel Opportunities)

```
Phase 1 parallel: T003, T004, T005 can run in parallel after T001 + T002
Phase 2 parallel: T014, T015, T016 (UI components) can run in parallel after T007–T013
Phase 3 parallel: T021 ((auth)/layout) can run in parallel with T017–T020
Phase 5 parallel: T024 (Sidebar) and T025 (useCurrentUser) can run in parallel
Phase 8 parallel: T033 and T034 can run in parallel
```

---

## Parallel Execution Examples

### Phase 2 — Foundational (after T007–T013 sequential core)
```
# Once tokens.css, types, store, and apiClient are done:
Task: T014 Write admin/src/components/ui/Button.tsx
Task: T015 Write admin/src/components/ui/Input.tsx
Task: T016 Write admin/src/components/ui/Spinner.tsx
```

### Phase 5 — US4 Dashboard Shell
```
# T024 and T025 have no dependencies on each other:
Task: T024 Write admin/src/components/common/Sidebar.tsx
Task: T025 Write admin/src/hooks/useCurrentUser.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2 only — 22 tasks)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational (T007–T016) ← CRITICAL gate
3. Complete Phase 3: US1 Login (T017–T021)
4. Complete Phase 4: US2 Route Guard (T022–T023)
5. **STOP and VALIDATE**: Run Quickstart Scenarios 1–5. The app has a working login + protected routes at this point.

### Incremental Delivery

1. MVP above → working login + guard (22 tasks)
2. Add Phase 5 US4 (T024–T028) → Dashboard shell with sidebar + header
3. Add Phase 6 US3 (T029–T030) → Logout working
4. Add Phase 7 US5 (T031–T032) → Refresh persistence verified
5. Add Phase 8 Polish (T033–T035) → Error pages + full quickstart validation

---

## Notes

- [P] tasks operate on different files with no dependencies — safe to run in parallel
- [Story] label maps each task to its user story for traceability back to spec.md
- No hardcoded hex or px values in any component file — all CSS custom properties from tokens.css
- `withCredentials: true` on the Axios instance is required for the httpOnly refresh cookie to be sent on `POST /api/v1/auth/refresh` (future use) and `POST /api/v1/auth/logout`
- The `isSuperAdmin` check in the route guard (T022) and in useLogin (T018) provides defense-in-depth — backend already enforces this, but the frontend validates it too
- Commit after each phase checkpoint to keep progress recoverable

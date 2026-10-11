# Implementation Plan: Admin Panel Scaffold

**Branch**: `011-admin-panel-scaffold` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-admin-panel-scaffold/spec.md`

## Summary

Bootstrap a standalone Next.js 15 admin panel at `admin/` that authenticates platform super-admins via the Express backend (`POST /api/v1/auth/super-admin/login`), enforces a client-side route guard, and renders a minimal dashboard shell. All state managed via Zustand (auth session) + TanStack Query (server data). Design values live exclusively in `src/styles/tokens.css` as CSS custom properties. No direct database access — all data via REST API calls to the backend at `NEXT_PUBLIC_API_URL`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) + Next.js 15 (App Router)

**Primary Dependencies**:
- `@tanstack/react-query` v5 — server state / API data fetching
- `zustand` v4 — auth session client state (with `persist` middleware → localStorage)
- `axios` v1 — HTTP client (centralized Axios instance with auth interceptor)
- `tailwindcss` v4 — utility classes referencing CSS custom properties
- `jose` or native `atob` — JWT `exp` claim decoding (no heavy jwt library needed)

**Storage**: localStorage (access token + user profile via Zustand `persist`). Refresh token is an httpOnly cookie — managed entirely by the backend, never accessed by the frontend.

**Testing**: Not in scope for this phase (scaffold only)

**Target Platform**: Web browser — admin.medisyn.ca (Node.js dev server on port 3002)

**Project Type**: Standalone Next.js web application (no SSR for protected routes — client-side auth guard)

**Performance Goals**:
- Redirect unauthenticated users to `/login` within 200ms (client-side layout guard)
- Login → dashboard transition under 3 seconds on standard broadband

**Constraints**:
- No direct DB access — all REST calls to Express backend
- Access token storage: localStorage only (httpOnly cookies deferred to hardening phase)
- Refresh token: httpOnly cookie — never readable by JS, handled by backend automatically
- Token auto-refresh on expiry: out of scope for this phase (user redirected to login on expiry)
- Tailwind v4 configured to reference CSS custom properties — no hardcoded hex/px values in components

**Scale/Scope**: Single admin panel, small number of admin users; scaffold phase — minimal pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| No direct DB access | ✅ PASS | All data via REST API. No ORM, no DB driver imported anywhere in `admin/`. |
| Architecture-first | ✅ PASS | spec → plan → tasks → implement workflow followed |
| No microservices | ✅ PASS | Standalone Next.js app; no new services introduced |
| Decision labelling | ✅ PASS | All decisions below labelled CONFIRMED / PROPOSED / ASSUMPTION |
| Worklog rule | ✅ PASS | Will be written at end of session |
| PHI handling | ✅ PASS | Admin panel scaffold has no PHI — user profile only (email, name) |
| Audit logging | N/A | Backend handles audit log; frontend login/logout calls backend which writes audit entries |
| spec-kit workflow | ✅ PASS | Full specify → plan chain executed |

**No gate violations.** Proceed to Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/011-admin-panel-scaffold/
├── plan.md              ← This file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← TypeScript types + Zustand store shape
├── quickstart.md        ← End-to-end validation guide
├── contracts/
│   └── auth.md          ← Backend API endpoints consumed
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    ← Root layout: QueryClientProvider, Zustand hydration
│   │   ├── globals.css                   ← @import tokens.css + base resets
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx              ← Public login page
│   │   └── (protected)/
│   │       ├── layout.tsx                ← Route guard + shell layout (Sidebar + Header)
│   │       └── dashboard/
│   │           └── page.tsx              ← Placeholder dashboard content
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Spinner.tsx
│   │   ├── common/
│   │   │   ├── Sidebar.tsx               ← Nav links + logo
│   │   │   └── TopHeader.tsx             ← User name, logout button
│   │   └── features/
│   │       └── auth/
│   │           └── LoginForm.tsx         ← Email + password form
│   ├── api/
│   │   └── auth.ts                       ← login(), logout(), getMe() API functions
│   ├── hooks/
│   │   └── useCurrentUser.ts             ← TanStack Query hook for /me
│   ├── stores/
│   │   └── authStore.ts                  ← Zustand auth store (persist → localStorage)
│   ├── styles/
│   │   ├── tokens.css                    ← ALL CSS custom properties
│   │   └── globals.css                   ← @import + Tailwind directives
│   ├── types/
│   │   └── auth.ts                       ← AdminUser, AuthState, LoginResponse types
│   └── lib/
│       └── apiClient.ts                  ← Axios instance + auth interceptor
├── .env.local.example
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

**Structure Decision**: CONFIRMED — standalone Next.js app at `admin/` (independent `package.json`, separate install). Route groups `(auth)` and `(protected)` cleanly separate public and protected pages. Route guard lives in `(protected)/layout.tsx` as a client component.

## Complexity Tracking

No constitution violations. No complexity justification required.

# Quickstart Validation Guide: Admin Panel Scaffold

**Feature**: Admin Panel Scaffold (`specs/011-admin-panel-scaffold`)
**Date**: 2026-10-11

Use this guide to validate the scaffold end-to-end after implementation. All scenarios map to acceptance criteria in [spec.md](./spec.md).

---

## Prerequisites

1. **Backend running**: `cd backend && npm run dev` (port 3001)
2. **Platform super-admin exists in the database**: Run the seeder or create one manually:
   - User with `isPlatformSuperAdmin = true` and `emailVerified = true`
   - Note the email and password
3. **Admin panel installed**: `cd admin && npm install`
4. **Admin `.env.local` configured**:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
5. **Admin panel running**: `cd admin && npm run dev` (port 3002)

---

## Scenario 1: Folder Structure Presence (SC-005)

**Validates**: FR-001, FR-002

Open the `admin/` directory and confirm all of the following paths exist:

```
admin/src/app/
admin/src/app/(auth)/login/
admin/src/app/(protected)/
admin/src/app/(protected)/dashboard/
admin/src/components/ui/
admin/src/components/common/
admin/src/components/features/
admin/src/api/
admin/src/hooks/
admin/src/stores/
admin/src/styles/tokens.css
admin/src/types/
admin/src/lib/apiClient.ts
admin/package.json      ← independent from frontend/ and backend/
```

**Pass**: All paths exist.
**Fail**: Any path is missing.

---

## Scenario 2: Design Tokens Completeness (SC-006)

**Validates**: FR-003, FR-013

Open `admin/src/styles/tokens.css` and confirm:
- All color variables (`--color-primary`, `--color-surface`, etc.) are defined
- All spacing variables (`--space-1` through `--space-16`) are defined
- All typography variables (`--font-sans`, `--font-size-*`) are defined

Open any component file (e.g. `LoginForm.tsx`, `Button.tsx`) and confirm:
- No hex colour values (`#xxxxxx`) appear in the file
- No hardcoded pixel sizes for colours, spacing, or font sizes

**Pass**: All token properties present; no hardcoded values in component files.
**Fail**: Missing token or hardcoded value found.

---

## Scenario 3: Unauthenticated Redirect (SC-002 / US-2)

**Validates**: FR-009

1. Open a private/incognito browser window (no localStorage)
2. Navigate to `http://localhost:3002/dashboard`
3. **Expected**: Redirect to `http://localhost:3002/login` within ~200ms. No dashboard content is visible before redirect.
4. Also test: navigate to `http://localhost:3002/` — confirm redirect to `/login`

**Pass**: Redirect happens; no protected content flashes.
**Fail**: Dashboard content visible, or no redirect.

---

## Scenario 4: Admin Login (SC-001 / US-1)

**Validates**: FR-007, FR-008

1. Navigate to `http://localhost:3002/login`
2. Enter the super-admin email and password
3. Click "Login"
4. **Expected**:
   - Loading indicator appears during the API call
   - Redirect to `/dashboard` on success
   - Dashboard shell renders: sidebar, top header, main content area
   - Top header shows the admin's first and last name

5. Open browser DevTools → Application → Local Storage → `http://localhost:3002`
6. Confirm `admin-auth` key exists with a non-null `accessToken` and `user` object

**Pass**: Dashboard renders with correct user name; token present in localStorage.
**Fail**: Error shown, no redirect, or user name missing.

---

## Scenario 5: Login with Wrong Credentials (US-1 acceptance scenario 2)

**Validates**: FR-007 error path

1. Navigate to `http://localhost:3002/login`
2. Enter a valid email but wrong password
3. Click "Login"
4. **Expected**:
   - No redirect
   - Error message visible on the form (e.g. "Invalid email or password")
   - No token written to localStorage

**Pass**: Error shown; user stays on `/login`; localStorage unchanged.
**Fail**: Redirect happens, or no error shown.

---

## Scenario 6: Dashboard Shell Layout (US-4)

**Validates**: FR-011, FR-012

After logging in, on the `/dashboard` page:

1. Confirm a **sidebar** is visible with navigation links (Users, Orders, Prescriptions, Compounding, Appointments, Reports — or similar placeholders)
2. Confirm a **top header** shows the logged-in admin's name and a logout button
3. Confirm a **main content area** with a welcome message or placeholder
4. Resize the browser window to 375px width (mobile) — confirm the layout does not break (sidebar collapses or hides)

**Pass**: All three regions visible; responsive behaviour correct.
**Fail**: Missing region, layout overlap/break.

---

## Scenario 7: Session Persistence on Refresh (SC-004 / US-5)

**Validates**: FR-008 (localStorage persistence), route guard on reload

1. Log in (see Scenario 4)
2. While on `/dashboard`, press **Ctrl+R** (or Cmd+R) to hard-refresh
3. **Expected**: Page reloads and the dashboard renders without redirecting to `/login`
4. Confirm the user name still appears in the top header

**Pass**: Session survives refresh; user stays on dashboard.
**Fail**: Redirect to `/login` after refresh.

---

## Scenario 8: Logout (US-3)

**Validates**: FR-010, SC-003

1. While logged in on `/dashboard`, click the **Logout** button
2. **Expected**:
   - Redirect to `/login`
   - `admin-auth` in localStorage is cleared (or `accessToken`/`user` are null)
3. Navigate back to `http://localhost:3002/dashboard`
4. **Expected**: Redirect to `/login` (session is gone)

**Pass**: Token cleared; subsequent protected route navigation redirects to `/login`.
**Fail**: Token persists, or dashboard still accessible after logout.

---

## Scenario 9: API Client Auth Injection

**Validates**: FR-004, FR-005

1. Log in
2. Open DevTools → Network tab
3. Trigger any API call (e.g. page load hits `GET /api/v1/auth/me` if wired up)
4. Confirm the request includes `Authorization: Bearer <token>` header

**Pass**: Bearer token present on all API requests.
**Fail**: No Authorization header, or wrong format.

---

## Scenario 10: Already-Authenticated Login Redirect (US-1 acceptance scenario 3)

**Validates**: FR-007 redirect-if-authed

1. Log in — confirm you are on `/dashboard`
2. Navigate to `http://localhost:3002/login` directly
3. **Expected**: Redirect to `/dashboard` (already authenticated, no re-login)

**Pass**: Redirect to `/dashboard`.
**Fail**: Login page renders again for an authenticated user.

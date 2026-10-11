# MediSyn — Project Worklog (Overall History)

This file is the cumulative project history. Each session is also recorded in `worklog/YYYY-MM-DD.md`.

---

## Session: 2026-10-11n — Admin Facilities: Prefix + identityDb Staff Creation

**What was done:**
- `backend/src/core/super-admin/admin-facilities.service.ts` — `adminCreateFacilityStaff` rewritten to create identity user in identityDb + HP+role in vtech-core; `adminListFacilityStaff` rewritten as two-phase cross-DB query; `adminListSuperAdmins`/`adminCreateSuperAdmin` moved to identityDb; `SEAT_ROLE_MAP` updated to enterprise role enum values; `FacilityStaffMember` updated (`healthProfessionalId`, `roles: string[]`); seat config query updated to use `health_professionals` + `user_roles`
- `backend/src/core/super-admin/admin-facilities.router.ts` — `CreateFacilitySchema` now includes `prefix` field (2–8 lowercase letters)
- `admin/src/api/platform.api.ts` — `PlatformFacilityDetail` + `FacilityStaffMember` types updated; `createFacility` body includes `prefix`
- `admin/src/app/(platform)/platform/facilities/[id]/page.tsx` — staff table uses `healthProfessionalId` key; roles rendered as multi-badge list; prefix shown alongside slug
- `admin/src/app/(platform)/platform/facilities/new/page.tsx` — prefix field added; auto-generated from slug; 2-column grid with slug

**TypeScript: 0 errors in both `backend/` and `admin/`**

**Still pending:**
- `revokeAllFacilitySessions` still points to vtech-core.sessions — needs identityDb update
- Drop legacy tables (facility_users, facility_roles, facility_role_permissions) after verification

---

## Session: 2026-10-11m — Auth Service Rewrite (Two-Database Architecture)

**What was done:**
- `backend/src/core/auth/identity-queries.service.ts` — NEW: all identityDb CRUD (users, sessions, username resolution, auth-version helpers, session revocation state)
- `backend/src/core/super-admin/auth-queries.service.ts` — added HP/roles/permissions resolver (`resolveHealthProfessionalAuth`), patient helpers (`getPatientFacility`, `createPatientRecord`), `getFacilityByPrefix`
- `backend/src/core/auth/auth.service.ts` — FULL REWRITE: login/register/refresh/logout/getMe now use identityDb for users+sessions, vtech-core for HP+roles+perms; new JwtPayload with `accountType`, `healthProfessionalId`, `facilityPrefix`, `roles[]`, `permissions[]`
- `backend/src/core/auth/auth.router.ts` — updated `getMe` call to pass `auth.accountType`
- `backend/src/core/auth/middleware/check-session.ts` — updated to query identityDb sessions
- `backend/src/core/auth/middleware/verify-auth-version.ts` — updated to query identityDb auth_version

**TypeScript: 0 errors in `backend/`**

**Still pending:**
- Task #6: `adminCreateFacilityStaff` needs to create users in identityDb (not vtech-core.users)
- `revokeAllFacilitySessions` still points to vtech-core.sessions
- Drop legacy tables after migration

---

## Session: 2026-10-11l — Facility User Management (Staff + Seat Limits)

**What was done:**
- `backend/src/db/seeds/plans.ts` — added `planEntitlements` seed: 3 seat resources (admin_seats:1, staff_seats:5, pharmacist_seats:5) per plan; idempotent via `onConflictDoUpdate`
- `backend/src/core/super-admin/admin-facilities.service.ts` — added 4 new functions: `adminGetFacilitySeatConfig`, `adminSetFacilitySeatOverride`, `adminListFacilityStaff`, `adminCreateFacilityStaff`; added `FacilitySeatResource`, `FacilityStaffMember` types
- `backend/src/core/super-admin/admin-facilities.router.ts` — added 4 new routes: `GET /admin/facilities/:id/seat-config`, `PATCH /admin/facilities/:id/seat-config`, `GET /admin/facilities/:id/staff`, `POST /admin/facilities/:id/staff`
- `admin/src/api/platform.api.ts` — added `FacilitySeatResource`, `FacilityStaffMember` types; added 4 new API functions: `getFacilitySeatConfig`, `setFacilitySeatOverride`, `listFacilityStaff`, `createFacilityStaff`
- `admin/src/app/(platform)/platform/facilities/[id]/page.tsx` — full rewrite: added "Seat limits" section (per-role usage bar + plan default display + per-resource override inputs) and "Staff members" section (table of admin/staff/pharmacist users + "Add Staff Member" modal with name/email/password/role form)

**TypeScript: 0 errors in both `admin/` and `backend/`**

**Architecture:**
- Super admin configures everything from `/platform/facilities/[id]`
- Seat defaults come from `plan_entitlements` (plan-level), overrides stored in `facility_entitlement_overrides` (per-facility)
- Staff accounts created directly by super admin: creates `users` row + `facility_users` link with chosen role
- All 3 staff roles (admin/staff/pharmacist) are system roles already seeded at facility creation time

**Still pending:**
- Facility creation e2e test against live backend
- Facility staff can log in using `/auth/login` but the admin panel login page currently routes to `/auth/super-admin/login` — deferred

---

## Session: 2026-10-11k — Subscription Plans Seed, API and Admin UI

**What was done:**
- `backend/src/db/seeds/plans.ts` — CREATED: standalone plans seed; inserts 7 platform modules + 3 plans (Starter, Growth, Enterprise) with descriptions and module links; idempotent
- `backend/package.json` — added `"db:seed:plans": "tsx src/db/seeds/plans.ts"` script
- `backend/src/core/super-admin/admin-facilities.service.ts` — added 5 new functions: `adminGetPlanById`, `adminCreatePlan`, `adminUpdatePlan`, `adminListPlatformModules`, `adminSetPlanModules`; added `AdminPlanDetail`, `AdminPlanModule`, `AdminModule` types
- `backend/src/core/super-admin/admin-facilities.router.ts` — added 5 new routes: `GET /admin/platform/modules`, `POST /admin/platform/plans`, `GET /admin/platform/plans/:id`, `PATCH /admin/platform/plans/:id`, `PUT /admin/platform/plans/:id/modules`; fixed `req.params.id!` → `(req.params['id'] as string)` cast across all routes (TS2345 with @types/express@5)
- `admin/src/api/platform.api.ts` — added `PlatformModule`, `PlatformPlanDetail` types; added 5 new API functions: `listModules`, `getPlan`, `createPlan`, `updatePlan`, `setPlanModules`
- `admin/src/components/common/PlatformSidebar.tsx` — added "Plans" nav item with `LayoutGrid` icon
- `admin/src/app/(platform)/platform/plans/page.tsx` — CREATED: lists all plans as cards; shows key, name, description, active badge; empty state with seed hint
- `admin/src/app/(platform)/platform/plans/new/page.tsx` — CREATED: create plan form (name, auto-key, description, module checkboxes)
- `admin/src/app/(platform)/platform/plans/[id]/page.tsx` — CREATED: edit name/description; module assignment checkboxes; activate/deactivate; facility count display

**TypeScript: 0 errors in both `admin/` and `backend/`**

**To seed the database:**
```
cd backend
npm run db:seed:plans
```

**Still pending:**
- Entitlements (staff_seats, api_requests_per_day, etc.) — schema exists, no UI yet
- Facility creation e2e test against live backend

---

## Session: 2026-10-11j — Platform Super Admin Interface + TypeScript Zero-Error Pass

**What was done:**
- `admin/src/components/ui/Button.tsx` — added `asChild?: boolean` prop; when true, clones single child element and merges button classes into it (no Radix dependency); used by platform pages that wrap `<Link>` in a styled Button
- `admin/src/app/(platform)/platform/super-admins/page.tsx` — fixed TS2741: added `open={showModal}` to `<Modal>` (Modal requires `open: boolean`)
- `admin/` TypeScript: **0 errors** confirmed (`npx tsc --noEmit` exits clean)

**Platform super admin interface (built this session):**
- `backend/src/core/super-admin/admin-facilities.service.ts` — CREATED: `adminListFacilities`, `adminGetFacilityById`, `adminCreateFacility` (tx: facility + 4 system roles), `adminUpdateFacility`, `adminListPlans`, `adminGetPlatformStats`, `adminListSuperAdmins`, `adminCreateSuperAdmin`
- `backend/src/core/super-admin/admin-facilities.router.ts` — CREATED: `requireSuperAdmin` middleware; 8 routes under `/api/v1/admin/platform/*` and `/api/v1/admin/facilities/*`
- `backend/src/app.ts` — mounted `adminFacilitiesRouter`
- `admin/src/api/platform.api.ts` — CREATED: all platform API functions
- `admin/src/app/(platform)/layout.tsx` — CREATED: guards non-super-admins; renders `PlatformSidebar` + `AdminTopbar`
- `admin/src/components/common/PlatformSidebar.tsx` — CREATED: nav to Platform Dashboard, Facilities, Super Admins; collapsed state persisted
- `admin/src/app/(platform)/platform/dashboard/page.tsx` — CREATED: 5 stat cards, platform-wide stats, quick action links
- `admin/src/app/(platform)/platform/facilities/page.tsx` — CREATED: paginated facilities table with search + status badges
- `admin/src/app/(platform)/platform/facilities/new/page.tsx` — CREATED: create facility form (name auto-generates slug, plan dropdown)
- `admin/src/app/(platform)/platform/facilities/[id]/page.tsx` — CREATED: edit name/plan, status management (activate/suspend/deactivate), "Open" link to enter facility panel
- `admin/src/app/(platform)/platform/super-admins/page.tsx` — CREATED: super admins list + create modal

**Login flow changes:**
- `admin/src/app/(auth)/login/page.tsx` — super admin without facility slug → redirect to `/platform/dashboard`; with facility slug → redirect to `/dashboard`
- `admin/src/stores/adminAuthStore.ts` — `hasPermission()` returns `true` for `isSuperAdmin` or `permissions.includes('*')`
- `backend/src/core/auth/auth.service.ts` — super admin login now returns `isSuperAdmin: true, roles: ['super_admin'], permissions: ['*']`
- `backend/src/lib/tenant-context.ts` — missing facilityId throws 403 FORBIDDEN (not 500) with helpful message

**Still pending:**
- Seed subscription plans table (currently empty — facility creation will fail without plans)
- Architecture decision: facility staff should use `/auth/login` not `/auth/super-admin/login` — deferred
- Permission guards on admin action buttons

---

## Session: 2026-10-11i — Fix Sidebar Hidden + API 403 for Super Admin Without Facility

**What was done:**
- `backend/src/core/auth/auth.service.ts` — added `isSuperAdmin: true`, `roles: ['super_admin']`, `permissions: ['*']` to super admin login response; updated return type to include these fields
- `admin/src/stores/adminAuthStore.ts` — added `isSuperAdmin?: boolean` to `AdminUser` interface; updated `hasPermission()` to return `true` when `isSuperAdmin` or `permissions` includes `'*'` wildcard
- `admin/src/app/(auth)/login/page.tsx` — passes `isSuperAdmin: data.user.isSuperAdmin ?? false` to `setAuth()`
- `admin/src/app/(dashboard)/layout.tsx` — added `NoFacilityBanner` component that shows when super admin has no facilityId in JWT; reads facilityId by decoding JWT from sessionStorage
- `backend/src/lib/tenant-context.ts` — changed missing-facilityId error from 500 INTERNAL_ERROR → 403 FORBIDDEN with helpful message about facility slug

**Root causes:**
1. Sidebar hidden: `superAdminLogin` response never included `permissions`/`isSuperAdmin`; frontend set `permissions: []`; `hasPermission()` returned false for all items except Dashboard (permission: null)
2. API 500 errors: super admin logged in without facilitySlug → `facilityId: null` in JWT → `withTenantContext(null, ...)` threw 500

**Still pending:**
- Architecture decision: admin panel should use `/auth/login` for facility staff — deferred by user
- Permission guards on action buttons (requirePermission is still pass-through stub)

---

## Session: 2026-10-11h — Dashboard Crash Fix + getDashboard Rewrite

**What was done:**
- `admin/src/app/(dashboard)/dashboard/page.tsx:140` — FIXED: expanded `isError || !m` guard to also check `!m.orders || !m.products || !m.revenue || !m.users || !m.approvals || !m.charts`; prevents crash when API returns data in a mismatched shape (shows graceful error UI instead)
- `admin/src/app/(dashboard)/dashboard/page.tsx:156-157` — FIXED: added `?.` optional chaining on `m.orders?.byStatus` and `m.charts?.dailyOrders`
- `backend/src/modules/reports/reports.types.ts` — REWROTE `DashboardResult`: replaced the 7-field flat shape (`asOf`, `todayRevenue`, etc.) with the full nested shape matching `DashboardMetrics` (`users`, `approvals`, `orders`, `products`, `revenue`, `charts`, `healthcare`)
- `backend/src/modules/reports/reports.service.ts` — REWROTE `getDashboard`: 12 parallel SQL queries return all dashboard fields; added `buildDashboardResult` helper (pure data transform, no DB access); both super-admin (BYPASSRLS) and facility-scoped (RLS tenant context) paths use the same `runQueries` function

**Decisions:**
- CONFIRMED: `approvals.pendingClinics` and `approvals.pendingPartners` return `0` — no pending-approval concept in current `facilities` schema
- CONFIRMED: `healthcare.pendingAppointments` counts `status = 'scheduled'` (not 'pending'/'confirmed' — appointments use 'scheduled' as the default)
- CONFIRMED: `revenue.totalCents` = `Math.round(totalCAD * 100)` (integer, derived from numeric DB column)
- CONFIRMED: 7-day daily orders chart fills missing days with `count: 0, revenue: 0` (no gaps in chart)

**TypeScript status:** 0 errors in both `backend/` and `admin/` after all changes.

**Root cause of crash:** Backend `DashboardResult` type returned `{ asOf, todayRevenue, newPatientsToday, ... }` (flat) while frontend `DashboardMetrics` expected `{ users: {...}, orders: {...}, ... }` (nested). API call returned 200 with mismatched data → `m` was truthy but `m.orders` was undefined → JS crash at `m.orders.byStatus`.

**Still pending:**
- T019–T025: permission guards on admin action buttons (all currently pass-through stubs)
- T040–T048: stub remaining placeholder pages (clinics, partners, FAQs, settings/email-triggers)
- End-to-end runtime validation against live backend
- Architecture discussion: admin panel should use `/auth/login` for facility staff, not super admin login — deferred by user

---

## Session: 2026-10-11g — Phase 12 Backend Route Modules: Users, Roles, Permissions, Audit

**What was done:**
- `backend/src/core/super-admin/admin-users.service.ts` — CREATED: `adminListUsers`, `adminSearchUsers`, `adminGetUserById`, `adminSetUserStatus`, `adminSetUserRoles` (all using `superAdminDb`; user status derived from `isActive`/`emailVerified`; phone from `patientProfiles`)
- `backend/src/core/super-admin/admin-roles.service.ts` — CREATED: `adminListRoles`, `adminGetRoleById`, `adminCreateRole`, `adminUpdateRole`, `adminDeleteRole`, `adminSetRolePermissions`, `adminListPermissions` (permission keys resolved via `inArray`; slug computed from name)
- `backend/src/core/super-admin/admin-users.router.ts` — CREATED: `GET /users/search`, `GET /users`, `GET /users/:id`, `PATCH /users/:id/status`, `PATCH /users/:id/roles`
- `backend/src/core/super-admin/admin-roles.router.ts` — CREATED: `GET /admin/roles`, `POST /admin/roles`, `GET /admin/roles/:id`, `PATCH /admin/roles/:id`, `DELETE /admin/roles/:id`, `PUT /admin/roles/:id/permissions`
- `backend/src/core/super-admin/admin-permissions.router.ts` — CREATED: `GET /admin/permissions`
- `backend/src/core/super-admin/admin-audit.router.ts` — CREATED: `GET /admin/audit` (bigserial id → string, joins users for actorEmail)
- `backend/src/app.ts` — MODIFIED: imported and mounted all 4 new routers at `/api/v1`
- `admin/src/api/audit.api.ts` — FIXED: was doubly-nested `{ data: ListResponse<AuditLog> }` → standard `{ data: AuditLog[], pagination: {...} }` extraction
- `admin/src/api/users.api.ts` — FIXED: was using `meta` key → changed to `pagination` to match backend standard

**Decisions:**
- CONFIRMED: `facilityRoles` has no `slug`/`description` — slug computed with `toSlug()`, description defaults to `''`
- CONFIRMED: User status is derived: `!isActive` → `suspended`, `!emailVerified` → `pending_verification`, otherwise → `active`
- CONFIRMED: `hasRoles=false` filters by `facilityRoles.name = 'patient'`; `hasRoles=true` filters name != 'patient'
- CONFIRMED: `AdminRole.permissions` = array of permission key strings (not IDs)
- CONFIRMED: `superAdminDb` used for all reads in these services (ESLint-restricted to `src/core/super-admin/`)
- CONFIRMED: Audit router lives in `src/core/super-admin/` (imports `superAdminDb` directly for paginated reads)

**TypeScript status:** 0 errors in both `backend/` and `admin/` after all changes.

**Still pending:**
- T019–T025: permission guards on admin action buttons (all currently pass-through stubs)
- T040–T048: stub remaining placeholder pages (clinics, partners, FAQs, settings/email-triggers)
- End-to-end runtime validation against live backend
- `facilityRolePermissions` — `setRolePermissions` replaces all; no partial update endpoint

---

## Session: 2026-10-11f — Phase 11 Admin Panel Scaffold Audit + TypeScript Fixes

**What was done:**
- `specs/011-admin-panel-scaffold/spec.md` — CREATED: 5 user stories (Login P1, Route Guard P1, Logout P2, Dashboard Shell P2, Persistence P3), 13 FRs, 6 SCs
- `specs/011-admin-panel-scaffold/plan.md` — CREATED: technical context, constitution check, full admin/ src structure
- `specs/011-admin-panel-scaffold/research.md` — CREATED: 8 CONFIRMED decisions (super-admin login endpoint, client-side guard, localStorage persist, atob decode, etc.)
- `specs/011-admin-panel-scaffold/data-model.md` — CREATED: AdminUser, AuthState, JwtPayload, LoginFormData, LoginApiResponse, MeApiResponse interfaces
- `specs/011-admin-panel-scaffold/contracts/auth.md` — CREATED: backend auth endpoint contracts
- `specs/011-admin-panel-scaffold/quickstart.md` — CREATED: 10 validation scenarios
- `specs/011-admin-panel-scaffold/tasks.md` — CREATED: 35 tasks; T001–T016, T020–T034 [X]; T003, T017–T019, T035 deferred
- `specs/011-admin-panel-scaffold/checklists/requirements.md` — CREATED: all 16 items pass
- `admin/.env.local` — FIXED: NEXT_PUBLIC_API_URL port 4000 → 3001
- `admin/.env.example` — CREATED: NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
- `admin/src/app/(auth)/layout.tsx` — CREATED: minimal auth layout (was missing)
- `admin/src/app/not-found.tsx` — CREATED: 404 page with link to /dashboard
- `admin/src/app/error.tsx` — CREATED: Next.js error boundary with reset button
- `admin/src/lib/decodeJwt.ts` — CREATED: atob-based JWT payload decoder + isTokenExpired helper
- `admin/src/types/auth.ts` — REPLACED: corrected to match actual backend response shape (firstName/lastName not fullName)
- `admin/src/lib/apiClient.ts` — FIXED: fallback URL localhost:4000 → localhost:3001
- `admin/src/app/(auth)/login/page.tsx` — FIXED: `data.user.fullName` → `` `${data.user.firstName ?? ''} ${data.user.lastName ?? ''}`.trim() ``
- `admin/src/types/admin.ts` — FIXED: added "issued" | "void" to InvoiceStatus; added voidReason?, voidedAt?, customerPhone? to AdminInvoice
- `admin/src/api/invoices.api.ts` — FIXED: added void() method (PATCH /invoices/admin/${id}/void); added customerPhone? to AdhocInvoicePayload
- `admin/src/app/(dashboard)/invoices/page.tsx` — FIXED: onChange={setPage} → onPage={setPage} on Pagination
- `admin/src/app/(dashboard)/inventory/movements/page.tsx` — FIXED: onChange={setPage} → onPage={setPage} on Pagination
- `admin/src/app/(dashboard)/invoices/[id]/page.tsx` — FIXED: fmtDate(inv.issuedAt) → inv.issuedAt ? fmtDate(inv.issuedAt) : '—' (2 occurrences)
- TypeScript: `npx tsc --noEmit` → 0 errors (clean)

**Key discovery**: admin/ was already substantially built (~80 pages, 20+ API files, full UI component library). Session became an audit-and-fix operation rather than a greenfield scaffold.

**Still pending:**
- T003: admin/next.config.ts (not critical — Next.js works without it)
- T017: admin/src/api/auth.ts (login calls apiClient inline; refactor to separate auth api module deferred)
- T018: admin/src/hooks/useLogin.ts (login logic inline in page; hook extraction deferred)
- T019: admin/src/components/features/auth/LoginForm.tsx (login form inline in page; extraction deferred)
- T035: quickstart.md manual validation (all 10 scenarios — requires running backend + admin dev servers)

---

## Session: 2026-10-11e — Phase 10 API Hardening Full Implementation

**What was done:**
- `specs/010-api-hardening/spec.md` — CREATED: 4 user stories, 15 FRs, 8 success criteria
- `specs/010-api-hardening/plan.md`, `research.md`, `contracts/hardening.md`, `quickstart.md` — CREATED
- `specs/010-api-hardening/tasks.md` — CREATED: 29 tasks; T001–T027 [X]; T028/T029 deferred
- `backend/src/middleware/rate-limit.ts` — CREATED: globalLimiter (200/min), authStrictLimiter (5/min), healthcareLimiter (10/min)
- `backend/src/lib/swagger/swagger.config.ts` — CREATED: swagger-jsdoc OpenAPI 3.0.0 config
- `backend/src/lib/swagger/swagger.router.ts` — CREATED: Swagger UI + swagger.json endpoint
- `backend/src/app.ts` — REWRITTEN: ALLOWED_ORIGINS CORS, explicit Helmet CSP/HSTS/frameguard, rate limiters applied, 413 handler, swagger mounted before global Helmet
- `backend/.env.example` — UPDATED: ALLOWED_ORIGINS replaces FRONTEND_URL/ADMIN_URL
- `backend/package.json` — UPDATED: swagger-jsdoc + swagger-ui-express + @types added
- `backend/src/core/auth/auth.router.ts` — UPDATED: @openapi JSDoc on 5 routes
- `backend/src/modules/healthcare/prescriptions/prescription.router.ts` — UPDATED: @openapi JSDoc
- `backend/src/modules/appointments/appointments/appointment.router.ts` — UPDATED: @openapi JSDoc
- `backend/src/modules/checkout/checkout.router.ts` — UPDATED: @openapi JSDoc
- `backend/tests/healthcare/prescriptions.test.ts` — CREATED: 6 test cases
- `backend/tests/appointments/appointments.test.ts` — CREATED: 5 test cases
- `backend/tests/commerce/checkout.test.ts` — CREATED: 5 test cases
- `backend/tests/security/headers.test.ts` — CREATED: 8 test cases
- typecheck ✓ (0 errors) | lint ✓ (0 errors)

**Still pending:**
- T017: @openapi JSDoc for compounding.router.ts
- T018: @openapi JSDoc for product.router.ts
- T028: Quickstart Scenarios S1–S8 manual validation (requires dev server)
- T029: `npm test` full run (requires TEST_DATABASE_URL)
- Phase 7/8/9 migration/seed/quickstart items (require running environment)

---

## Session: 2026-10-11d — Phase 9 File Storage Plan + Implementation (T001–T019)

**What was done:**
- `specs/009-file-storage/plan.md` — FILLED: technical context, constitution check, source code layout
- `specs/009-file-storage/research.md` — CREATED: 11 technical decisions
- `specs/009-file-storage/data-model.md` — CREATED: schema changes, FileStorageService interface, env vars
- `specs/009-file-storage/contracts/files.md` — CREATED: upload + signed URL routes for prescriptions + compounding
- `specs/009-file-storage/quickstart.md` — CREATED: 9 validation scenarios
- `specs/009-file-storage/tasks.md` — CREATED: 20 tasks; T001–T019 completed [X]
- `backend/src/lib/file-storage/file-storage.types.ts` — CREATED: types, allowlists, MIME→ext map
- `backend/src/lib/file-storage/file-storage.service.ts` — CREATED: FileStorageService singleton (S3/R2, upload, signedURL, delete)
- `backend/src/db/migrations/0007_file_keys.sql` — CREATED: adds file_keys text[] to prescription_requests + compounding_requests
- `backend/src/db/seeds/file-storage-permissions.ts` — CREATED: seeds files.upload + files.download
- `backend/src/scripts/migrate-base64-files.ts` — CREATED: one-shot base64→S3 migration
- `backend/src/db/schema/healthcare.ts` — UPDATED: fileKeys column on both healthcare tables
- `backend/src/lib/errors.ts` — UPDATED: 6 new file-related ErrorCode values
- `backend/src/modules/healthcare/prescriptions/prescription.queries.ts` — UPDATED: appendPrescriptionFileKey
- `backend/src/modules/healthcare/prescriptions/prescription.service.ts` — UPDATED: uploadPrescriptionFile + getPrescriptionFileUrl
- `backend/src/modules/healthcare/prescriptions/prescription.router.ts` — UPDATED: 2 new file routes + multer middleware
- `backend/src/modules/healthcare/compounding/compounding.queries.ts` — UPDATED: appendCompoundingFileKey
- `backend/src/modules/healthcare/compounding/compounding.service.ts` — UPDATED: uploadCompoundingFile + getCompoundingFileUrl
- `backend/src/modules/healthcare/compounding/compounding.router.ts` — UPDATED: 2 new file routes + multer middleware
- `backend/package.json` — UPDATED: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, multer, @types/multer installed
- typecheck ✓ (0 errors) | lint ✓ (0 errors)

**Still pending:**
- T007: `npm run db:migrate` to apply 0007_file_keys.sql (requires running PostgreSQL)
- T008: Run file-storage-permissions seed (requires running PostgreSQL)
- T020: Quickstart Scenarios 1–9 manual validation (requires running backend + S3/R2)

---

## Session: 2026-10-11c — Phase 8 Implementation Complete (T001–T015)

**What was done:**
- `backend/src/modules/reports/reports.types.ts` — CREATED: result interfaces (SalesReportResult, OrderReportResult, PatientReportResult, DashboardResult, TrendBucket, TopProduct, TopPatient)
- `backend/src/modules/reports/reports.validator.ts` — CREATED: ReportQuerySchema with date range validation
- `backend/src/db/seeds/reports-permissions.ts` — CREATED: seeds reports.read permission
- `backend/src/modules/reports/reports.service.ts` — CREATED: getSalesReport, getDashboard, getOrderReport, getPatientReport
- `backend/src/modules/reports/reports.router.ts` — CREATED: GET /sales, /orders, /patients, /dashboard — all require reports.read
- `backend/src/app.ts` — UPDATED: registered reportsRouter at /api/v1/admin/reports
- `backend/src/email/email.queue.ts` — FIXED: removed unused redis import (pre-existing lint error)
- typecheck ✓ (0 errors) | lint ✓ (0 errors)

**Still pending:**
- T004: Run permission seed (requires running PostgreSQL)
- T016: Quickstart Scenarios 1–8 manual validation (requires running backend)

---

## Session: 2026-10-11b — Phase 8 + Phase 9 Specs Written

**What was done:**
- `specs/008-admin-reports-dashboard/spec.md` — CREATED: 4 user stories, 12 FRs, 6 SCs (sales reports, order reports, patient reports, dashboard summary)
- `specs/008-admin-reports-dashboard/checklists/requirements.md` — CREATED: all 16 quality items pass
- `specs/009-file-storage/spec.md` — CREATED: 4 user stories, 12 FRs, 6 SCs (upload, signed URLs, compounding attachments, base64 migration)
- `specs/009-file-storage/checklists/requirements.md` — CREATED: all 16 quality items pass
- `.specify/feature.json` — UPDATED: now points to `specs/008-admin-reports-dashboard`

**Still pending:**
- `/speckit-plan` for Phase 8 and Phase 9
- T045 (Phase 7 quickstart validation) — deferred
- `npm run db:migrate` migration 0006 — deferred

---

## Session: 2026-10-11 — Phase 7 Implementation Complete (T018–T044)

**What was done:**
- `backend/src/app.ts` — UPDATED: registered `emailLogRouter` at `/api/v1/admin/email-log` and `notificationsRouter` at `/api/v1`
- `backend/src/db/seeds/async-infra-permissions.ts` — CREATED: seeds `email_log.read`, `email_log.retry`, `notifications.broadcast`
- `backend/src/email/template-loader.ts` — IMPLEMENTED: Handlebars template renderer with partition caching, strict mode, partials registration
- `backend/src/email/templates/partials/header.hbs` — CREATED: branded HTML email header (MediSyn blue #1677A8)
- `backend/src/email/templates/partials/footer.hbs` — CREATED: legal footer with copyright
- `backend/src/email/templates/welcome/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/verify-email/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/forgot-password/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/order-confirmation/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/prescription-status-changed/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/appointment-confirmed/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/appointment-reminder/` — CREATED: subject.txt + body.hbs
- `backend/src/email/templates/ask-pharmacist-replied/` — CREATED: subject.txt + body.hbs
- `backend/src/email/email.worker.ts` — UPDATED: stub `renderEmail()` replaced with `renderTemplate()` from template-loader
- `backend/src/notifications/notifications.service.ts` — IMPLEMENTED: createNotification, broadcastNotifications, getUnreadCount (Redis+DB fallback), listNotifications, markNotificationRead, markAllNotificationsRead, softDeleteNotification, pruneOldNotifications
- `backend/src/notifications/notifications.validator.ts` — IMPLEMENTED: ListNotificationsQuerySchema, NotificationParamsSchema, BroadcastNotificationBodySchema
- `backend/src/notifications/notifications.router.ts` — IMPLEMENTED: GET /notifications, PATCH /notifications/:id/read, POST /notifications/read-all, DELETE /notifications/:id, POST /admin/notifications/broadcast
- `backend/src/core/auth/auth.router.ts` — UPDATED: added GET /api/v1/auth/me with unread_count
- `backend/src/core/auth/auth.service.ts` — UPDATED: added getMe(), imported getUserById
- `backend/src/modules/appointments/appointments/appointment.service.ts` — UPDATED: createNotification on appointment booking
- `backend/src/modules/healthcare/prescriptions/prescription.service.ts` — UPDATED: createNotification on status change
- `backend/src/modules/orders/order.service.ts` — UPDATED: createNotification on order status change
- `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.service.ts` — UPDATED: createNotification on staff reply
- `backend/src/workers/index.ts` — IMPLEMENTED: appointment-reminder hourly cron (Queue+Worker), notification-prune daily cron (03:00 UTC)
- `specs/007-async-email-notifications/tasks.md` — UPDATED: T018–T044 marked [X]
- typecheck ✓ (0 errors) | lint ✓ (0 errors)

**Decisions made:**
- CONFIRMED: template files use `.txt` extension for subject lines, `.hbs` for bodies (different from spec which said `.hbs` for both — pragmatic change)
- CONFIRMED: `workerDb` (BYPASSRLS) used in notifications.service.ts for all reads/writes (avoids RLS filter issues in broadcast/prune contexts)
- CONFIRMED: GET /auth/me added directly in auth.router.ts (no existing /me endpoint existed)
- CONFIRMED: appointment-reminder scan queries raw appointments table via `workerDb` (BYPASSRLS) using raw SQL join across availability_slots + vaccine_services + users

**Still pending:**
- T045: quickstart.md Scenarios 1–8 integration validation (manual — requires running server)
- `npm run db:migrate` (manual — requires running PostgreSQL) for migration 0006

---

## Session: 2026-10-10f — Phase 7 Spec + Plan (async email, notifications)

**What was done:**
- `specs/007-async-email-notifications/spec.md` — CREATED: Phase 7 spec (3 user stories, 19 FRs, 7 SCs)
- `specs/007-async-email-notifications/checklists/requirements.md` — CREATED: all 16 items pass
- `specs/007-async-email-notifications/plan.md` — CREATED: full implementation plan
- `specs/007-async-email-notifications/research.md` — CREATED: 8 technical decisions (BullMQ, Handlebars, cron, Redis cache, email_log scoping, notification insert strategy, Redis fallback, worker architecture)
- `specs/007-async-email-notifications/data-model.md` — CREATED: `email_log` + `notifications` table schemas with RLS, indexes, grants, state machines, Redis key schema
- `specs/007-async-email-notifications/contracts/email-log.md` — CREATED: admin email log list + retry endpoints
- `specs/007-async-email-notifications/contracts/notifications.md` — CREATED: patient notification feed, read, broadcast, unread_count in /me
- `specs/007-async-email-notifications/quickstart.md` — CREATED: 8 validation scenarios
- `.specify/feature.json` — UPDATED: points to `specs/007-async-email-notifications`
- `backend/.env` — NOT modified (user restored real MongoDB credentials; left as-is)

**Decisions made:**
- CONFIRMED: BullMQ v5 on existing ioredis (constitution locked stack)
- CONFIRMED: Handlebars templates on disk, cached in memory, hot-reloadable
- CONFIRMED: BullMQ repeatable job for appointment reminder scan (hourly, [24h–25h] window)
- CONFIRMED: Redis INCR/DECR for unread_count cache, 10-min TTL, DB fallback
- CONFIRMED: email_log.facility_id nullable (system emails have no facility)
- CONFIRMED: Notification inserts are synchronous within domain service tx (fast DB write)
- CONFIRMED: Redis unavailability falls back to synchronous nodemailer send (not silent drop)
- CONFIRMED: Worker co-process with Express app in dev; can split to separate process in prod

**Still pending:**
- Run `/speckit-tasks` to generate tasks.md for Phase 7
- Phase 7 implementation (T001+)

---

## Session: 2026-10-10e — Phase 6 Appointment Booking Implementation (T001–T031)

**What was done:**
- `backend/src/db/schema/appointments.ts` — CREATED: 4 tables (vaccineServices, availabilitySlots, appointments, appointmentStatusHistory)
- `backend/src/db/index.ts` + `backend/tests/setup/db.ts` — UPDATED: appointmentsSchema spread
- `backend/src/db/migrations/0005_appointment_booking.sql` — CREATED: full migration with RLS, partial unique index, REVOKE/GRANT
- `backend/src/db/migrations/meta/_journal.json` — UPDATED: idx=5 entry
- `backend/src/db/seeds/appointments-permissions.ts` — CREATED: appointments.read + appointments.manage
- `backend/tests/setup/appointment-fixtures.ts` — CREATED: test fixtures for all 3 entities
- US1 vaccine-services module: types + validator + queries + service + router
- US2 availability-slots module: types + validator + queries + service + router
- US3+US4 appointments module: types + validator + queries + service + router (patient + admin)
- `backend/src/modules/appointments/appointments.router.ts` — CREATED: aggregator
- `backend/src/app.ts` — UPDATED: appointmentsRouter registered at `/api/v1`
- typecheck ✓ | lint ✓ (3 unused import fixes) | tests pass (no new failures)

**Still pending:**
- T007: `npm run db:migrate` (manual — requires running PostgreSQL)
- T032: quickstart.md Scenarios 1–7 integration validation (manual)

---

## Session: 2026-10-10d — Phase 5 Healthcare Workflows Full Implementation (T001–T034)

**What was done:**
- `backend/src/lib/errors.ts` — UPDATED: 8 healthcare error codes added
- `backend/src/db/schema/healthcare.ts` — CREATED: 9 tables (prescriptions, compounding, minor ailments, conversations)
- `backend/src/db/migrations/0004_healthcare_workflows.sql` — CREATED: full RLS + REVOKE + indexes migration
- `backend/src/db/seeds/healthcare-permissions.ts` — CREATED: 8 permissions + 19 Ontario ailments
- `backend/tests/setup/healthcare-fixtures.ts` — CREATED: fixtures for all 4 modules
- 4 full modules created (types + validator + queries + service + router): prescriptions, compounding, minor-ailments, ask-pharmacist
- `backend/src/modules/healthcare/healthcare.router.ts` — CREATED: aggregator
- `backend/src/app.ts` — UPDATED: healthcareRouter registered at `/api/v1`
- typecheck ✓ | lint ✓ | tests pass (no test files yet)

**Still pending:**
- T007: `npm run db:migrate` (manual — requires running Docker PostgreSQL)
- T035: quickstart.md Scenarios 1–7 integration validation (manual)

---

## Session: 2026-10-10c — Phase 5 Healthcare tasks.md Generated

**What was done:**
- `specs/005-healthcare-workflows/tasks.md` — CREATED: 35 tasks across 6 phases for Phase 5 (Prescriptions, Compounding, Minor Ailments, Ask-a-Pharmacist)

**Still pending:**
- `/speckit-implement` for Phase 5
- Phase 4 manual steps: `npm run db:migrate`, seed `orders-permissions.ts`, quickstart validation

---

## Session: 2026-10-10b — Phase 4 Full Implementation Complete (T001–T039)

**What was done:**
- `backend/src/lib/errors.ts` — UPDATED: added 13 commerce error codes + `EMAIL_NOT_VERIFIED` (pre-existing gap)
- `backend/src/middleware/optional-auth.ts` — CREATED: guest pass-through middleware
- `backend/src/db/schema/commerce.ts` — CREATED: 7 table definitions (facilitySequences, shippingMethods, carts, cartItems, orders, orderItems, orderStatusHistory)
- `backend/src/lib/tax-rates.ts` — CREATED: Canadian province tax logic with QST additive method
- `backend/src/db/migrations/0003_cart_checkout_orders.sql` — CREATED: migration with RLS, REVOKE, UNIQUE NULLS NOT DISTINCT
- `backend/src/db/migrations/meta/_journal.json` — UPDATED: entry for migration 0003
- `backend/src/db/seeds/orders-permissions.ts` — CREATED: 3 ecommerce permissions
- `backend/tests/setup/commerce-fixtures.ts` — CREATED: test helpers for cart/order/shipping
- `backend/src/modules/cart/cart.types.ts` — CREATED
- `backend/src/modules/cart/cart.validator.ts` — CREATED
- `backend/src/modules/cart/cart.queries.ts` — CREATED: raw SQL JOIN for live cart items
- `backend/src/modules/cart/cart.service.ts` — CREATED: guest/auth cart, merge, upsert
- `backend/src/modules/cart/cart.router.ts` — CREATED: `medisyn_cart` HttpOnly cookie management
- `backend/src/modules/shipping-methods/shipping-method.types.ts` — CREATED
- `backend/src/modules/shipping-methods/shipping-method.validator.ts` — CREATED
- `backend/src/modules/shipping-methods/shipping-method.queries.ts` — CREATED
- `backend/src/modules/shipping-methods/shipping-method.service.ts` — CREATED
- `backend/src/modules/shipping-methods/shipping-method.router.ts` — CREATED
- `backend/src/modules/checkout/checkout.types.ts` — CREATED
- `backend/src/modules/checkout/checkout.validator.ts` — CREATED
- `backend/src/modules/checkout/checkout.service.ts` — CREATED: preview token JWT sign (15 min), no DB writes
- `backend/src/modules/checkout/checkout.router.ts` — CREATED + UPDATED: POST /preview + POST /place
- `backend/src/modules/orders/order.types.ts` — CREATED: VALID_TRANSITIONS state machine
- `backend/src/modules/orders/order.queries.ts` — CREATED: SELECT FOR UPDATE sequence + all CRUD
- `backend/src/modules/orders/order.service.ts` — CREATED: placeOrder (transactional, SELECT FOR UPDATE stock), patient + admin ops
- `backend/src/modules/orders/order.validator.ts` — CREATED
- `backend/src/modules/orders/order.router.ts` — CREATED: patient + admin order routes
- `backend/src/modules/commerce.router.ts` — CREATED: aggregates all 4 routers
- `backend/src/app.ts` — UPDATED: `app.use('/api/v1', commerceRouter)`
- `specs/004-cart-checkout-orders/tasks.md` — UPDATED: all 39 tasks marked [X]

**Still pending:**
- T007: Apply migration `npm run db:migrate` (manual — requires running Docker PostgreSQL)
- T008 seed apply: `npx tsx src/db/seeds/orders-permissions.ts` (manual)
- T039: Manual quickstart.md scenario validation against live server

---

## Session: 2026-10-10a — Phase 4 tasks.md Generated

**What was done:**
- `specs/004-cart-checkout-orders/tasks.md` — CREATED: 39 tasks across 8 phases for Phase 4 Cart/Checkout/Orders

**Still pending:**
- `/speckit-implement` for Phase 4

---

## Session: 2026-10-09d — Phase 4 Plan + Super Admin Login

**What was done:**
- `specs/004-cart-checkout-orders/data-model.md` — CREATED: 7 new tables, status machine, tax rates
- `specs/004-cart-checkout-orders/plan.md` — UPDATED: full technical context, project structure, key patterns
- `specs/004-cart-checkout-orders/contracts/cart.md` — CREATED
- `specs/004-cart-checkout-orders/contracts/checkout.md` — CREATED
- `specs/004-cart-checkout-orders/contracts/orders.md` — CREATED
- `specs/004-cart-checkout-orders/contracts/shipping-methods.md` — CREATED
- `specs/004-cart-checkout-orders/quickstart.md` — CREATED: 8 validation scenarios
- `admin/.env.local` — CREATED: NEXT_PUBLIC_API_URL pointing to port 3001
- `backend/src/core/auth/auth.validator.ts` — UPDATED: added SuperAdminLoginBodySchema
- `backend/src/core/auth/auth.service.ts` — UPDATED: added superAdminLogin() (no facilitySlug, checks isPlatformSuperAdmin)
- `backend/src/core/auth/auth.router.ts` — UPDATED: added POST /super-admin/login route
- `admin/src/app/(auth)/login/page.tsx` — UPDATED: login calls /auth/super-admin/login
- DB: `admin@medisyn.ca` registered, email verified, is_platform_super_admin = true

**Still pending:**
- `/speckit-tasks` for Phase 4 (Cart/Checkout/Orders)
- `/speckit-implement` for Phase 4

---

## Session: 2026-10-09c — Phase 3 Catalogue Implementation: All 5 User Stories

**What was done:**
- `specs/003-ecommerce-catalogue/tasks.md` — CREATED (T001–T064)
- `backend/src/db/schema/catalogue.ts` — CREATED: 6 tables (categories, products, product_variants, inventory_records, inventory_transactions, coupons) with RLS
- `backend/drizzle/` — migration generated and applied; 5 permissions seeded (products.manage, categories.manage, inventory.read, inventory.adjust, coupons.manage)
- `backend/src/lib/slugify.ts` — CREATED: slugify + uniqueSlug
- `backend/src/middleware/resolve-facility.ts` — CREATED: X-Facility-ID header validation
- `backend/src/modules/catalogue/catalogue.types.ts` — CREATED: InventoryReason, CouponType, CouponValidationRejectionReason, StockStatus
- `backend/tests/setup/catalogue-fixtures.ts` — CREATED: createTestCategory, createTestProduct, createTestVariant, setInventoryQuantity
- **Products (US2)**: product.types.ts, product.validator.ts, product.queries.ts, product.service.ts, product.router.ts, tests/catalogue/products.test.ts
- **Categories (US3)**: category.types.ts, category.validator.ts, category.queries.ts, category.service.ts, category.router.ts, tests/catalogue/categories.test.ts
- **Browsing (US1)**: tests/catalogue/browsing.test.ts (public GET endpoints + list/filter/sort)
- **Inventory (US4)**: inventory.types.ts, inventory.validator.ts, inventory.queries.ts (SELECT FOR UPDATE), inventory.service.ts, inventory.router.ts, tests/catalogue/inventory.test.ts
- **Coupons (US5)**: coupon.types.ts, coupon.validator.ts, coupon.queries.ts, coupon.service.ts, coupon.router.ts, tests/catalogue/coupons.test.ts
- `backend/src/lib/errors.ts` — UPDATED: added COUPON_CODE_EXISTS, COUPON_ALREADY_INACTIVE to ErrorCode
- `backend/eslint.config.js` — UPDATED: added resolve-facility.ts to superAdminDb exemption
- `npm run typecheck` — PASS; `npm run lint` — PASS
- T027–T056, T058–T059 marked complete in tasks.md

**Still pending:**
- T057 — `npm run test -- tests/catalogue/` (requires live Docker/PostgreSQL)
- T060 — quickstart.md validation (requires live environment)
- T061 — RLS + append-only DB verification (requires live environment)
- Phase 4 (Cart/Checkout) — begin via `/speckit-specify Phase 4`

---

## Session: 2026-10-09b — Phase 3 Spec + Plan Complete

**What was done:**
- `specs/003-ecommerce-catalogue/spec.md` — CREATED: full feature specification (5 user stories, 34 FRs, 8 SCs, 13 assumptions)
- `specs/003-ecommerce-catalogue/checklists/requirements.md` — CREATED: all quality checks pass
- `.specify/feature.json` — UPDATED: points to `specs/003-ecommerce-catalogue`
- `specs/003-ecommerce-catalogue/plan.md` — CREATED: tech context, constitution check, source layout
- `specs/003-ecommerce-catalogue/research.md` — CREATED: 10 design decisions resolved (facility identification, search, hierarchy, concurrency, money, images, slugs, coupon codes, variants, inventory scoping)
- `specs/003-ecommerce-catalogue/data-model.md` — CREATED: Drizzle schema for 6 tables + full migration SQL (RLS, constraints, indexes, permissions)
- `specs/003-ecommerce-catalogue/contracts/products.md` — CREATED: 7 endpoints
- `specs/003-ecommerce-catalogue/contracts/categories.md` — CREATED: 5 endpoints
- `specs/003-ecommerce-catalogue/contracts/inventory.md` — CREATED: 4 endpoints
- `specs/003-ecommerce-catalogue/contracts/coupons.md` — CREATED: 6 endpoints
- `specs/003-ecommerce-catalogue/quickstart.md` — CREATED: 15-step validation guide, SC coverage table

**Still pending:**
- `/speckit-tasks` — generate task checklist from the plan
- T038 — nodemailer dev email delivery (needs Brevo SMTP credentials, Phase 2 open item)

---

## Session: 2026-10-09 — Phase 2 CLOSED: 44/44 Auth Tests Green ✅

**What was done:**
- `backend/src/core/auth/auth.middleware.ts` — CREATED: broke circular dependency (`auth.router → app → auth.router`) by extracting `authMiddleware` into its own module
- `backend/src/core/auth/auth.router.ts` — FIXED: import `authMiddleware` from `./auth.middleware` not `@/app`
- `backend/src/app.ts` — FIXED: re-exports from `auth.middleware.ts` instead of defining inline
- `backend/src/db/index.ts` — FIXED: added `dotenv.config()` so postgres pool has env vars when tests import the module directly
- `backend/vitest.config.ts` — FIXED: added `setupFiles` to load dotenv before test modules evaluate
- `backend/tests/setup/vitest-setup.ts` — CREATED: dotenv loader for vitest
- `backend/scripts/create-roles.sql` — FIXED: `app_super_admin_login` needs `BYPASSRLS` directly (not via membership — PostgreSQL doesn't inherit role attributes)
- `backend/tests/isolation/cross-tenant.test.ts` — FIXED: removed unused imports (`vi`, `postgres`, `getTestDb`, `redis`) + `_tx` params (lint)
- Live DB: ran `ALTER ROLE app_super_admin_login BYPASSRLS;`
- **Result: 44/44 auth integration tests pass. 0 TS errors. 0 lint errors.**

**Still pending:**
- T038 — nodemailer dev email delivery (needs Brevo SMTP credentials)
- Phase 3 — Ecommerce Catalogue (ready to start with /speckit-specify)

---

## Session: 2026-10-06g — Phase 2 Auth: All Test Files Written

**What was done:**
- `backend/tests/auth/register.test.ts` — CREATED: 8 integration tests (REG-001–008) for `POST /api/v1/auth/register`
- `backend/tests/auth/login.test.ts` — CREATED: 9 integration tests (LOG-001–009) for `POST /api/v1/auth/login`
- `backend/tests/auth/refresh.test.ts` — CREATED: 8 integration tests (REF-001–008) for `POST /api/v1/auth/refresh` including theft detection (REF-006)
- `backend/tests/auth/logout.test.ts` — CREATED: 6 integration tests (OUT-001–006) for logout + logout-all
- `backend/tests/auth/password-reset-verify.test.ts` — CREATED: 13 integration tests (PW-001–007, EV-001–006)
- `backend/src/core/auth/auth.service.ts` — FIXED: removed unused `getUserById` import
- `specs/002-auth-endpoints/tasks.md` — updated: T001–T016, T018–T020, T022–T033, T035–T036 marked [X] complete
- TypeScript: zero errors. ESLint (Phase 2 files): zero errors.

**Still pending (blocked — Docker not installed):**
- T017, T021, T025, T034 — run integration tests (requires PostgreSQL + Redis via Docker)
- T037 — quickstart smoke tests
- T038 — nodemailer dev delivery verification

---

## Session: 2026-10-06f — spec-kit /speckit-tasks: Phase 2 Auth Task List

**What was done:**
- `specs/002-auth-endpoints/tasks.md` — CREATED: 38 tasks across 9 phases (Setup → Foundational → US1-Register → US2-Login → US3-Refresh → US4-Logout → US5-PasswordReset → US6-EmailVerify → Polish)
- 44 named test cases defined across 6 user stories (REG-001–008, LOG-001–009, REF-001–008, OUT-001–006, PW-001–007, EV-001–006)
- Refresh token rotation design finalized: creates new session row on each refresh (not update-in-place) to enable clean theft detection (`revokedReason='rotated'`)

**Still pending (blocked — Docker not installed):**
- T026, T039, T042, T043 (Phase 1 tests + validation) — user will install Docker Desktop

---

## Session: 2026-10-06e — /speckit-implement: Phase 1 Source Code Complete

**What was done:**
- `backend/.env` — updated from MongoDB → PostgreSQL env vars
- `specs/001-multitenant-pg-foundation/tasks.md` — marked T001–T038, T040–T041 as [x] complete
- All 43 backend source files written (prev session — recap): schema, RLS, seeds, errors, Redis, tenant-context, audit, super-admin, full 7-step auth middleware chain, test fixtures + 20 gate tests
- TypeScript: zero errors. ESLint: zero errors.

**Still pending (blocked — Docker not installed):**
- T026, T039 — `npm run test` (requires PostgreSQL + Redis via Docker)
- T042 — quickstart manual validation
- T043 — seed idempotency check

---

## Session: 2026-10-06d — spec-kit /speckit-tasks: Phase 1 Implementation Task List

**What was done:**
- `specs/001-multitenant-pg-foundation/tasks.md` — CREATED: 43 tasks across 7 phases

**Task breakdown**: T001–T006 setup, T007–T021 foundation, T022–T026 US1 (tenant isolation + ISO tests), T027–T033 US2 (super admin + AUX tests + middleware skeleton), T034–T035 US3 (module gating), T036–T038 US4 (session revocation + REV tests), T039–T043 polish/gate.

**Still pending:**
- `/speckit-implement` — implementation is the next step (T001 is the first task: MongoDB clean break)

---

## Session: 2026-10-06c — spec-kit /speckit-plan: Phase 1 Design Artifacts

**What was done:**
- `specs/001-multitenant-pg-foundation/plan.md` — filled: Technical Context, Constitution Check (pre+post), Project Structure, Phase 0/1 summaries
- `specs/001-multitenant-pg-foundation/research.md` — CREATED: 8 confirmed arch decisions with rationale + alternatives
- `specs/001-multitenant-pg-foundation/data-model.md` — CREATED: all 16 tables, fields, RLS coverage list, relationships, state transitions
- `specs/001-multitenant-pg-foundation/contracts/middleware-chain.md` — CREATED: 7-step chain, per-step failure modes + error codes
- `specs/001-multitenant-pg-foundation/contracts/tenant-context.md` — CREATED: withTenantContext() full behaviour contract
- `specs/001-multitenant-pg-foundation/contracts/db-roles.md` — CREATED: two roles, two pools, ESLint rule DDL, PgBouncer notes
- `specs/001-multitenant-pg-foundation/quickstart.md` — CREATED: 9-step validation guide, 20 named Phase 1 gate tests, gate checklist

**Still pending:**
- `/speckit-tasks` — run next to generate tasks.md before implementation begins
- MongoDB clean break — existing backend/ Mongoose code not yet removed
- Phase 1 source code not yet written

---

## Session: 2026-10-06b — Architecture V2.1: Session Revocation + 5 Clarifications

**What was done:**
- `docs/MediSyn_SaaS_Platform_Architecture_V2.md` — updated in-place with all V2.1 changes
- Section 8 fully replaced: sessions table, 3-key Redis revocation state, fail-closed Redis fallback for both session and auth_version checks, revocation functions, refresh token revocation, BullMQ job cancellation
- Section 10 (patient model): patients confirmed as authenticated platform users, same JWT system as staff
- Section 11 (audit log): RLS added — app_user reads own facility only, app_super_admin bypasses
- Section 13 (middleware): canonical two-stage pattern — auth middleware outside transaction, withTenantContext() wraps handler, services receive tx as parameter
- Section 18: 14 new acceptance criteria (session revocation + canonical transaction pattern)
- Section 20: R3 updated, R8 (Redis P0) and R9 (Argon2 cost) added
- Section 21: 12 new confirmed decisions

**Still pending:** Phase 1 implementation not started; 8 open questions from 2026-10-06 session

---

## Session: 2026-10-06 — Vtech-Med SaaS Platform Architecture V2

**What was done:**
- Platform renamed: **Vtech-Med** is the SaaS platform; **MediSyn** is one facility/tenant on it
- `docs/MediSyn_SaaS_Platform_Architecture_V2.md` — CREATED: full approved architecture document
- `docs/MediSyn_SaaS_Platform_Architecture.md` — MARKED superseded
- Architecture V2 covers: RLS (fail-closed, two DB roles, PgBouncer safety), JWT auth_version staleness, API key full lifecycle, patient domain model (facility-scoped), audit_log (append-only), plan entitlements (quantitative limits), Phase 1 acceptance criteria, 7 risks to accept
- `uv` and `specify-cli` (spec-kit) installed globally — blocked by Windows App Control

**Still pending:**
- spec-kit CLI unblocked (Windows App Control)
- 10 open questions in worklog/2026-10-06.md need user confirmation before phases begin
- Phase 1 implementation not started

---

## Session: 2026-10-04 — PHIPA/PIPEDA/CASL Compliance Implementation

**What was done:**
- `backend/src/modules/users/users.schema.ts` — added consent fields (termsAcceptedAt, privacyPolicyAcceptedAt, privacyPolicyVersion, marketingConsent, marketingConsentAt) + lockout fields (failedLoginAttempts, lockedUntil)
- `backend/src/modules/auth/auth.dto.ts` — RegisterDto now requires termsAccepted + privacyAccepted (both z.literal(true)), optional marketingConsent
- `backend/src/modules/auth/auth.service.ts` — register() saves consent + logs audit; login() enforces per-user lockout (5 failures → 15 min lock); added unsubscribeMarketing()
- `backend/src/modules/auth/auth.controller.ts` + `auth.routes.ts` — passes req.ip to service; added POST /unsubscribe (CASL)
- `backend/src/config/index.ts` — added PRIVACY_OFFICER_EMAIL, PRIVACY_POLICY_VERSION, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES
- `backend/src/modules/prescriptions/prescriptions.routes.ts` — PHI read audit on GET /admin/:id
- `backend/src/modules/compounding/compounding.routes.ts` — PHI read audit on GET /admin/:id
- `backend/src/modules/ask-pharmacist/ask-pharmacist.routes.ts` — PHI read audit on GET /admin/:id
- `backend/src/modules/minor-ailments/ailment-request.routes.ts` — PHI read audit on GET /admin/:id
- `frontend/src/types/auth.ts` — added consent fields to RegisterRequest
- `frontend/src/components/auth/RegisterPatientForm.tsx` — split into required terms+privacy checkbox + optional marketing opt-in
- `frontend/src/app/privacy-policy/page.tsx` — CREATED: full PHIPA/PIPEDA/CASL-compliant privacy policy (15 sections)
- `frontend/src/app/terms/page.tsx` — CREATED: Terms of Service page

**Still pending:** MFA/2FA, patient data export, data retention job, email unsubscribe links, footer links to legal pages

---

## Session: 2026-10-02 (E) — Admin Detail Pages Two-Column Redesign + Prescription Service Types

**What was done:**
- `admin/src/app/(dashboard)/prescriptions/[id]/page.tsx` — two-column layout; replaced 2 DetailCards with compact icon+value side-by-side cards (Hash/FileText/Activity/RefreshCw/Calendar/Clock + User/Shield/Phone); AdminThreadPanel sticky right column
- `admin/src/app/(dashboard)/compounding/[id]/page.tsx` — same pattern; compact cards (FileText/Tag/Zap/Hash/Calendar + User/Shield); AdminThreadPanel sticky right
- `admin/src/app/(dashboard)/ask-pharmacist/[id]/page.tsx` — two-column layout (no DetailCard was present); question + response + history on left; AdminThreadPanel sticky right
- `admin/src/app/(dashboard)/appointments/bookings/[id]/page.tsx` — two-column layout; replaced 2 DetailCards with compact side-by-side cards (User/Mail/Phone + Stethoscope/Clock/Calendar/Layers/Users); AdminThreadPanel sticky right; removed ArrowLeft import dependency (use router.back with ← text)
- `frontend/src/components/patient/PrescriptionForm.tsx` — full rewrite with 4 service type selector cards at top (New Prescription, New + Delivery, Refill, Transfer); fields change conditionally per type; Transfer shows previous pharmacy fields + transferAll toggle + rxNumbers tag input; Delivery shows delivery address; Refill hides prescriber; form is now controlled state (not FormData)

**Still pending:** None from this session

---

## Session: 2026-10-02 (D) — Order Detail Redesign + PatientThreadPanel Reusable Component

**What was done:**
- `admin/src/app/(dashboard)/orders/[id]/page.tsx` — full layout redesign: two-column flex (left: order info, right: sticky thread panel); Customer + Shipping replaced with compact icon+value cards side-by-side (User/Mail/Phone/CreditCard/MapPin/Building2/Hash icons); items table padding tightened; removed `max-w-4xl`; `AdminThreadPanel` now always visible on the right column with `defaultOpen` prop
- `frontend/src/components/patient/PatientThreadPanel.tsx` *(new)* — reusable patient messaging component; accepts `entityType`, `entityId`, `title`, `className`; encapsulates query (30s poll), send mutation, auto-scroll, chat bubble UI
- `frontend/src/app/patient/orders/[id]/page.tsx` — replaced inline "Messages from Pharmacy" block with `<PatientThreadPanel entityType="order" entityId={id} />`; removed now-unused imports (useRef, useEffect, MessageCircle, Send, patientThreadsApi)
- `frontend/src/app/patient/prescriptions/page.tsx` — added per-prescription "Messages" toggle button; clicking expands `<PatientThreadPanel entityType="prescription" entityId={rx._id} />` inline below that prescription row; only one open at a time (single state)
- `frontend/src/app/patient/ask-a-pharmacist/page.tsx` — same expandable Messages toggle per request card; `<PatientThreadPanel entityType="ask_pharmacist" entityId={ask._id} title="Chat with Pharmacist" />`
- `frontend/src/app/patient/minor-ailments/page.tsx` — same pattern; `<PatientThreadPanel entityType="minor_ailment" entityId={item._id} title="Messages about this request" />`
- `frontend/src/app/patient/appointments/page.tsx` — same pattern; `<PatientThreadPanel entityType="appointment" entityId={appt._id} title="Messages about this appointment" />`

**PatientThreadPanel coverage (all entity types with patient-facing lists):**
| Page | Entity type | Done |
|---|---|---|
| `/patient/orders/[id]` | `order` | ✅ |
| `/patient/prescriptions` | `prescription` | ✅ |
| `/patient/ask-a-pharmacist` | `ask_pharmacist` | ✅ |
| `/patient/minor-ailments` | `minor_ailment` | ✅ |
| `/patient/appointments` | `appointment` | ✅ |

**Still pending:**
- Patient mark-read for entity thread messages (deferred)
- Thread real-time (WebSocket/SSE) — deferred to async infrastructure phase

---

## Session: 2026-10-02 (C) — Admin UX: System Role Edit + Login Remember Me + Users Split

**What was done:**
- `admin/src/app/(dashboard)/roles/[id]/page.tsx` — removed system-role read-only guards; all roles now fully editable (Save button, checkboxes, group toggles all enabled regardless of `isSystem` flag)
- `admin/src/app/(auth)/login/page.tsx` — full rewrite: eye/EyeOff password toggle; Remember Me checkbox; saved accounts stored in `localStorage["admin_saved_accounts"]` (max 5); suggestions dropdown on email focus filtered by typed input; ArrowDown/ArrowUp/Enter/Escape keyboard nav with `highlightIdx`; mouse hover syncs highlight; ✕ per account to remove; auto-fills credentials on mount if remembered
- `admin/src/components/common/AdminSidebar.tsx` — split "Users" into "Patients" (`/users/patients`) + "Staff Members" (`/users/staff`) under Access Control group
- `admin/src/app/(dashboard)/users/page.tsx` — redirect to `/users/patients`
- `admin/src/app/(dashboard)/users/patients/page.tsx` *(new)* — patients list (hasRoles=false): Name/Email, UHID, Status, Joined
- `admin/src/app/(dashboard)/users/staff/page.tsx` *(new)* — staff list (hasRoles=true): Name/Email, Role badges (colour-cycling), Status, Joined
- `backend/src/modules/users/users.routes.ts` — added `hasRoles` query filter; list response includes populated `roles[]` array

**Still pending:**
- Unread message count badge on AdminThreadPanel tab not persisting across navigation (local state only — no server read tracking for admin)

---

## Session: 2026-10-02 (B) — Users Split: Patients + Staff Members Pages

**What was done:**
- `backend/src/modules/users/users.routes.ts` — added `hasRoles` filter: `hasRoles=true` → users with RBAC roles, `hasRoles=false` → users without
- `admin/src/components/common/AdminSidebar.tsx` — replaced "Users" nav item with "Patients" (`/users/patients`) + "Staff Members" (`/users/staff`) under Access Control
- `admin/src/app/(dashboard)/users/page.tsx` — now redirects to `/users/patients`
- `admin/src/app/(dashboard)/users/patients/page.tsx` *(new)* — patient-focused list: Name/Email, UHID, Status, Joined; filtered `hasRoles=false`
- `admin/src/app/(dashboard)/users/staff/page.tsx` *(new)* — staff-focused list: Name/Email, Roles (coloured badges), Status, Joined; filtered `hasRoles=true`

**Still pending:** None

---

## Session: 2026-10-02 — Order List Customer Fix + Patient Order Messaging

**What was done:**
- `backend/src/modules/orders/orders.service.ts` — `listAdminOrders` now populates `userId` (email, fullName, phone); fixes CUSTOMER column showing "—" for registered users
- `admin/src/app/(dashboard)/orders/page.tsx` — Customer column resolves name/email from `guestInfo` OR populated `userId`; ORDER sub-label (email) same fix
- `backend/src/modules/threads/thread.routes.ts` — Added `POST /threads/:entityType/:entityId/patient/messages` so patients can reply to entity threads
- `frontend/src/api/threads.api.ts` — Added `getEntityMessages` + `postEntityMessage` to `patientThreadsApi`
- `frontend/src/app/patient/orders/[id]/page.tsx` — Added "Messages from Pharmacy" section: chat bubble UI, 30s auto-poll, Ctrl+Enter send, empty state

**Still pending:**
- Patient mark-read for entity thread messages (deferred — not critical)
- Thread real-time (WebSocket/SSE) — deferred to async infrastructure phase

---

## Session: 2026-09-29 (C) — UI Polish + UHID System + Invoice Template Fix + DB Wipe

**What was done:**
- `type="number"` → `type="text"` with `blockNonNumeric` keyboard guard across invoice form + orders page
- Invoice new-form layout: two-column (sticky left: customer+billing / right: items+tax+totals), input padding tightened, whitespace eliminated
- UHID system: `backend/src/lib/counter.ts` (`nextUHID()` → `MED-000001`), `uhid` sparse-unique field on User schema, UHID assigned on every new registration in `auth.service.ts`
- `GET /users/search?q=...` endpoint — searches fullName, email, phone, uhid; returns top 10; requires `users.read`
- Admin `users.api.ts` — `search()` method + `UserSearchResult` type
- Invoice form customer section: separate search box removed; each field (Name, Email, Phone) is now its own autocomplete (`AcField`) with 280ms debounce + shared dropdown + UHID badge on selection
- `/invoices/reports` rewritten as card-grid hub (4 report cards); existing content moved to `/invoices/reports/summary`
- `invoice.template.ts` — fixed all 8 TypeScript compile errors: `inv.items` → `inv.lineItems`, `"void"` → `"cancelled"/"system_cancelled"`, `inv.voidReason` → `inv.cancelReason`, `fmtDate` now accepts `undefined`, `inv.customerPhone` → `addr.phone`; introduced `RenderableInvoice` type
- `invoices.routes.ts` — replaced all `as never` casts with `as RenderableInvoice`
- `backend/src/scripts/wipe-dev-db.ts` *(new)* — full DB wipe with dev-only guard + `--confirm` flag + collection count preview
- Ran wipe (381 docs / 40 collections) + seed — clean database confirmed

**Still pending:**
- `/invoices/reports/revenue`, `/tax`, `/adhoc` sub-pages not built
- UHID not yet displayed on admin user detail or patient post-signup
- Orders detail `ORDER_STATUSES` permission-filter (carried from session B)

**See:** `worklog/2026-09-29c.md` for full detail

---

## Session: 2026-09-29 (B) — Transition Permission & Email Trigger Bug Fixes

**What was done:**
- Fixed P0 Bug: `cancelMyOrder` in `orders.service.ts` captured `prevStatus` before mutation — side effects were incorrectly passing `"cancelled"` as both `fromStatus` and `toStatus`
- Fixed P1 Bug: `checkout` now fires `EmailTriggerService.fire("orders", null, "pending", ...)` instead of `"confirmed"` — seed updated to match (`null → "pending"` row)
- Fixed P1 Bug: Rewrote `EmailTriggerService.resolve()` — replaced non-deterministic `$or [fromStatus, null, "*"]` with exact-then-wildcard two-query approach
- Fixed P1 Bug: `ask-pharmacist.service.ts` — replaced hardcoded `EmailService.sendAskPharmacistRespondedEmail` with `EmailTriggerService.fire`
- Fixed P1 Bug: `appointments.service.ts` — replaced hardcoded `EmailService.sendAppointmentStatusChangedEmail` with `EmailTriggerService.fire`; added `oldStatus` param to `_appointmentStatusSideEffects`
- Fixed P1 UI: `admin/src/app/(dashboard)/prescriptions/[id]/page.tsx` — replaced broken `["active", "expired", "cancelled"]` with `RX_TRANSITIONS` map; modal now shows only valid next states filtered by actor's permissions via `useAdminAuthStore`
- Fixed P3 UI: `admin/src/app/(dashboard)/compounding/[id]/page.tsx` — same pattern; `COMPOUNDING_TRANSITIONS` map with permission filtering
- Created `backend/src/database/migrate-prescription-status.ts` — one-time migration script: `active → received`, `expired → cancelled`

**Still pending:**
- Migration script must be run before any production deployment (not yet executed)
- P2 Bug 5 double-lock: route guard vs. transition permission mismatch (mitigated by seed, proper fix deferred)
- P2 Bug 7: `actorPermissions` optional in service signatures — system callers bypass guard (deferred)
- Available-transitions API endpoint (deferred)
- Orders detail UI: `ORDER_STATUSES` still not permission-filtered (same pattern as prescriptions/compounding fix)

---

## Session: 2026-09-29 — Invoice Refund Lifecycle + Data Reset Script + Billing Report

**What was done:**
- Full refund lifecycle implemented in `payment.service.ts`: pending → completed/failed/cancelled, with `processRefund()` applying financial changes (allocation reversal, invoice.amountPaid decrement, paymentStatus recalculation)
- `financiallySettled` flag prevents double-accounting on auto-refunds created during invoice cancellation
- `statusHistory[]` on every `PaymentTransaction` — full audit trail of who changed what and when
- Routes added: `GET /admin/payments/pending-refunds`, `PATCH .../process-refund`, `.../fail-refund`, `.../cancel-refund`
- `invoiceSummary()` now returns embedded `refunds: RefundReport` — no separate endpoint needed
- `InvoiceSummary` type updated in admin types; `InvoiceSummary.refunds` added
- Missing `paymentsApi` methods added to `admin/src/api/invoices.api.ts`: `listPendingRefunds`, `processRefund`, `failRefund`, `cancelRefund`
- Billing summary page (`/invoices/reports/summary`) expanded into 4 sections: Billing Summary, Payment Status, Refund Report, Refunds by Method — color-coded KPI cards
- Reports index card renamed to "Billing & Refund Report"
- Data reset script created: `backend/src/scripts/reset-dev-data.ts` — deletes invoice/order/user data with `--confirm` guard and production refusal

**Still pending:**
- PDF template reads `invoice.items` (not `lineItems`)
- Admin invoice detail page uses old model
- Invoice number at finalization (not draft creation)
- `systemCancelInvoice` missing auto-refund call
- `invoices.void` → `invoices.cancel` permission rename

---

## Session: 2026-09-19 — Frontend UI Polish + Broken Content Fixes

**What was done:**
- Implemented Aceternity UI components on the public-facing frontend: Spotlight, FlipWords, CardHoverEffect, TracingBeam, BentoGrid
- Implemented VengenceUI-style components: LogoSlider (Canadian insurance logos), ShimmerButton, GlassDock (mobile dock), SpotlightNav (Header)
- Complete audit of all frontend pages and components for broken content
- Fixed all broken files identified in audit

**Broken content fixed:**
- `app/login/page.tsx` — removed `getCurrentUser()` + Drizzle session import; now a simple sync server component
- `app/verify-email/page.tsx` — converted from Server Action to client component using `authApi.verifyEmail()`
- `app/layout.tsx` — added `<Providers>` wrapper (QueryClientProvider was missing — TanStack Query hooks would fail without it)
- `api/auth.api.ts` — fixed wrong endpoint paths: `registerClinic` and `registerPartner` were calling non-existent `/auth/register/clinic` and `/auth/register/pharmacy-partner` — corrected to `/auth/register`
- `components/home/WhyChooseUs.tsx` — removed broken `<Image src="/images/lab-compounding.jpg">`, replaced with brand-gradient placeholder with FlaskConical icon
- `app/about/page.tsx` — removed broken `<Image src="/images/about-team.jpg">`, replaced with brand-gradient placeholder with Users icon
- `components/ContactForm.tsx` — removed broken `/api/contact` fetch call; form now composes a `mailto:` link with pre-filled subject + body, opening user's email client
- `components/NewsletterForm.tsx` — replaced broken `/api/newsletter` fetch with a stub success state (backend newsletter endpoint TBD)
- `components/Footer.tsx` — changed `href="https://facebook.com"` and `href="https://instagram.com"` to `href="#"` (placeholder until real social accounts exist)

**New files created:**
- `app/get-started/page.tsx` — new landing page with 3 paths: New Prescription (→/register), Refill (→/login), Transfer (→/register)
- `app/verify-email/VerifyEmailContent.tsx` — standalone client component for email verification (unused, verify-email/page.tsx handles it inline)

**Pre-existing errors (NOT introduced this session):**
- `src/app/admin/*`, `src/app/clinic/*`, `src/app/patient/*` — old portal pages importing drizzle-orm/@/db/@/actions (to be deleted/migrated in a future cleanup pass)
- `src/app/api/contact/route.ts`, `api/newsletter/route.ts`, `api/health/route.ts` — old Next.js API routes importing @/db (to be cleaned up)
- `src/components/forms/ActionMessage.tsx` — old Server Action helper

**TypeScript:** 0 errors in all new/modified files. Only pre-existing errors in legacy admin/patient/clinic portal pages that predate this session.

---

## Session: 2026-09-17 — Project Kickoff, Stack Decision & Scope Confirmation

**What was done:**
- Reviewed both docs files:
  - `docs/MediSyn_Backend_Master_Prompt_Claude.md` (backend scope, architecture, RBAC, all modules)
  - `docs/MediSyn_Claude_Design_Requirements_Handoff.md` (UX/design requirements, visual direction)
- Audited the complete existing codebase (stack, schema, pages, actions, components)
- Identified all gaps between current implementation and documented requirements
- Produced a comprehensive 8-phase implementation plan
- Created CLAUDE.md, worklog.md, and worklog/2026-09-17.md for persistent project memory

**Key findings:**
- Codebase uses Next.js + PostgreSQL, NOT the Node.js + MongoDB the user wants
- Current auth is flat role strings — full RBAC system needs to be built
- Admin panel exists but has no roles/permissions management
- Compounding, ecommerce, slot-based appointments, file storage, email queue, reports are all missing
- Files stored as base64 in DB (critical issue to fix)

**Decisions confirmed this session:**
- CONFIRMED: Node.js + MongoDB Atlas backend (NestJS explicitly rejected)
- CONFIRMED: Frontend stays Next.js, consumes REST API
- CONFIRMED: Ecommerce is MVP1
- CONFIRMED: Admin access is purely permissions-based (role bundles TBD later)

**Open questions going into next session:**
- Which Node.js framework? (Express.js recommended)
- Monorepo vs separate repo for backend

**Completed:**
- Full Phase 1 built — see worklog/2026-09-17.md for detail
- Pushed to https://github.com/soelshaikh/Medisyn.git

**Next:** Phase 7 — Redis + BullMQ async infrastructure, email queue, notifications

---

## Session: 2026-09-18 — Phase 2 (Admin Panel) + Phase 6 (Appointments) Complete

**What was done:**
- Completed all Phase 2 admin panel pages: dashboard, roles, orders, products, clinics, partners, prescriptions, compounding, ask-pharmacist, audit log, settings (FAQs)
- Built reusable `DetailCard`, `StatusHistory`, `Pagination` components
- Fixed `apiClient` export issue (named → default export)
- Built Phase 6 backend: `VaccineService`, `AppointmentSlot`, `AppointmentBooking` schemas + services + routes
- Concurrency-safe STRICT slot booking via MongoDB atomic `findOneAndUpdate` with `$expr: { $lt: ["$bookedCount", "$capacity"] }`
- Seeded 6 real vaccine services
- Built all Phase 6 admin UI pages: bookings list, booking detail, slots list, slot detail, vaccine services catalog

**Decisions confirmed:**
- STRICT capacity: hard cap, blocks patient booking at API level (409), shown as red in patient UI
- OPEN capacity: soft cap, always allows patient requests
- Cancel and rebook (no reschedule complexity at this stage)
- Admin-created slots only
- No waitlist

**Admin pages completed (Phase 6):**
- `/appointments/bookings` — list with pending count badge, search, status filter
- `/appointments/bookings/[id]` — approve/reject quick actions, slot capacity, eligibility, cancellation info, status history
- `/appointments/slots` — list with capacity bar, STRICT/OPEN badge, create slot modal
- `/appointments/slots/[id]` — slot detail with capacity progress bar, bookings list, edit + cancel actions
- `/appointments/services` — vaccine catalog with create/edit/toggle active modals

**TypeScript:** 0 errors across backend and admin.

---

## Session: 2026-09-18 — Phase 2: Admin Panel Full Management UI

**What was done:**
- Completed all missing admin panel pages to finish Phase 2
- Zero TypeScript errors across the entire admin panel

**Files created:**
- `admin/src/api/prescriptions.api.ts`, `compounding.api.ts`, `ask-pharmacist.api.ts`
- `admin/src/components/ui/Pagination.tsx` — shared pagination component
- `admin/src/components/common/DetailCard.tsx` — shared label/value grid card
- `admin/src/components/common/StatusHistory.tsx` — shared status timeline
- Dashboard page with live KPIs, bar charts, pending approval alerts
- Roles page + permissions editor (group-level and per-permission toggles)
- Orders list + detail (line items, totals, status, notes)
- Products list + detail (edit, inventory adjustment)
- Clinics + Partners list and detail pages with approval workflow
- Prescriptions + Compounding + Ask Pharmacist list and detail pages
- Audit log (auto-refreshes every 30s)
- Settings page with full FAQs management (create/edit/delete/publish)

**Bugs fixed:**
- Added `export default apiClient` to fix TS2613 across all API files
- `AdminOrder.statusHistory` now uses shared `StatusEntry` type

**Next:** Phase 6 — Appointments (vaccine catalog, slots, STRICT/OPEN booking)

---

## Session: 2026-09-18 — Phase 7 (Async Infrastructure) Complete

**What was done:**
- Built complete Phase 7 without Redis — fire-and-forget pattern throughout
- No queue infrastructure needed: `void asyncFn()` makes all side effects non-blocking

**Backend — notifications module:**
- `backend/src/modules/notifications/notifications.schema.ts` — MongoDB schema with compound index `{ userId, read, createdAt }`
- `backend/src/modules/notifications/notifications.service.ts` — `createNotification`, `notifyAdmins` (fan-out to all admin users), `listNotifications`, `getUnreadCount`, `markOneRead`, `markAllRead`
- `backend/src/modules/notifications/notifications.routes.ts` — `GET /`, `GET /unread-count`, `PATCH /:id/read`, `POST /read-all`
- Registered at `/api/v1/notifications` in `app.ts`

**Backend — email templates + side effects:**
- Added 4 new email templates: `orderStatusChanged`, `compoundingStatusChanged`, `appointmentStatusChanged`, `askPharmacistResponded` — all use updated sky-600 primary (#0284C7)
- Added corresponding `EmailService.send*` methods
- `orders.service.ts` — `_orderStatusSideEffects`: fire-and-forget email + patient notification on status change
- `compounding.service.ts` — `_compoundingStatusSideEffects` + `notifyAdmins` on create
- `appointments.service.ts` — `_appointmentStatusSideEffects` + `notifyAdmins` on create
- `ask-pharmacist.service.ts` — `_askPharmacistRespondedSideEffects` + `notifyAdmins` on create

**Admin UI:**
- `admin/src/api/notifications.api.ts` — `notificationsApi` with `list`, `unreadCount`, `markRead`, `markAllRead`
- `admin/src/components/common/AdminTopbar.tsx` — notification bell: Radix Popover, unread badge, polls every 30s, lazy-loads list only when open, mark-one-read on click, mark-all button

**UI improvements (accumulated):**
- Design token primary lightened to sky-600 palette (`#0284C7`)
- `EmptyState.tsx` rewritten with floating SVG illustration + `animate-float` animation
- `ConfirmDialog.tsx` added — Radix AlertDialog with destructive variant
- Sonner `<Toaster>` in providers — toast.success/error on all mutations
- `/appointments/services` rewritten: dnd-kit drag-to-reorder grid, confirm dialogs for toggle, toasts, empty state
- DatePicker fully fixed for react-day-picker v9 API

**TypeScript:** 0 errors in both backend and admin after all Phase 7 changes.

**Next:** Phase 8 — Reports & Analytics dashboard

---

## Session: 2026-09-18 — Phase 8 (Reports & Analytics) Complete

**What was done:**

**Backend — Reports module:**
- `backend/src/modules/reports/reports.routes.ts` — 5 aggregation endpoints:
  - `GET /api/v1/admin/reports/sales` — revenue, order count, AOV, discounts, daily chart
  - `GET /api/v1/admin/reports/orders` — orders by status, daily chart, guest vs registered split
  - `GET /api/v1/admin/reports/products` — top 10 by units sold + top 10 by revenue
  - `GET /api/v1/admin/reports/customers` — new patients by day, all-time total, active buyers count
  - `GET /api/v1/admin/reports/coupons` — orders with/without coupon, top coupons, all-time usage table
- All endpoints accept `preset` (today/yesterday/7d/30d/month) or custom `from`+`to`
- All require `authenticate` + `requirePermission("reports.read")`
- Registered at `/api/v1/admin/reports` in `app.ts`

**Backend — Dashboard enhanced:**
- `dashboard.routes.ts` now includes `healthcare` block:
  - `pendingCompounding` — submitted + reviewing
  - `openAskPharmacist` — open status
  - `pendingAppointments` — pending + confirmed
  - `activePrescriptions` — active status

**Admin UI:**
- `admin/src/types/admin.ts` — `DashboardMetrics.healthcare` field added
- `admin/src/api/reports.api.ts` — full typed API for all 5 report endpoints
- `admin/src/app/(dashboard)/reports/page.tsx` — full reports page:
  - Preset date range selector (Today/Yesterday/7d/30d/Month)
  - 5 tabs: Sales, Orders, Products, Customers, Coupons
  - CSS bar charts (no new library — consistent with dashboard)
  - KPI cards, horizontal bar charts, data tables
- `dashboard/page.tsx` — new healthcare KPI row (4 cards linking to relevant admin pages)

**TypeScript:** 0 errors in both backend and admin.

**Next:** Phase 9 — File Storage (S3/R2 abstraction, migrate file uploads, signed URLs)

---

## Session: 2026-09-18 — Phase 9 (File Storage) Complete

**What was done:**

**Backend — FileStorageService abstraction:**
- Installed `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- `backend/src/modules/files/file-storage.service.ts` — `IFileStorageService` interface + `LocalFileStorage` (dev) + `S3FileStorage` (prod)
  - Factory exports `storageService` singleton based on `FILE_STORAGE_PROVIDER` env var
  - S3 implementation supports AWS S3, Cloudflare R2, MinIO, Backblaze B2 (any S3-compatible)
  - Private paths (`private/...`) → presigned GET URLs (1-hour default)
  - Public paths (`products/...`) → direct CDN/public URL

**Backend — files.routes.ts:**
- `POST /api/v1/files/upload?type=product-image|document` — multer memoryStorage → storageService.upload → returns `{ key, url }`
- `GET /api/v1/files/signed-url?key=...` — returns 1-hour presigned URL for private documents; passes through if key is already an http URL
- Both require `authenticate`

**Backend — product image migration:**
- `products.routes.ts` — switched from `diskStorage` to `memoryStorage`
- `products.controller.ts` — `addImage` now calls `storageService.upload()` instead of relying on multer saving to disk
- `products.service.ts` — `removeProductImage` now calls `storageService.delete()` instead of `fs.unlinkSync`

**Backend — config:**
- `config/index.ts` — added `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` (all optional)
- `.env.example` — full S3 configuration section with Cloudflare R2 and AWS S3 examples

**Admin UI:**
- `admin/src/api/files.api.ts` — `filesApi.getSignedUrl(key)` + `isStorageKey()` helper
- `admin/src/components/common/SecureDocumentLink.tsx` — smart document link: direct href for http URLs, calls signed-url endpoint for storage keys, shows loading spinner
- `ask-pharmacist/[id]/page.tsx` — uses `SecureDocumentLink` instead of raw `<a href>`
- `compounding/[id]/page.tsx` — added "Attached Document" section using `SecureDocumentLink`

**To switch to S3 in production:** set `FILE_STORAGE_PROVIDER=s3` and fill in S3 credentials in `.env`.

**TypeScript:** 0 errors in both backend and admin.

**Next:** Phase 10 — Hardening (rate limiting, security, OpenAPI cleanup, performance)

---

## Session: 2026-09-18 — Phase 10 (Hardening) Complete

**What was done:**

**Security:**
- `express-mongo-sanitize` applied globally — strips `$` and `.` from body/query/params (NoSQL injection prevention)
- Global API rate limiter: 200 req / 15 min per IP on all `/api/v1/*` routes
- Healthcare submission limiter: 20 submissions / hour (compounding, ask-pharmacist)
- Ecommerce mutation limiter: 30 req / min on `/orders/checkout`
- File upload limiter: 10 uploads / hour
- JSON body limit tightened: `10mb` → `1mb` (file uploads go through multer, not JSON body)
- `compression()` middleware for gzip response compression
- Request logging masks Authorization header and Cookie content

**Graceful shutdown (`index.ts`):**
- SIGTERM/SIGINT handlers — closes HTTP server, then closes MongoDB connection
- 15-second force-exit timeout if graceful shutdown hangs
- `unhandledRejection` + `uncaughtException` handlers with proper logging

**OpenAPI/Swagger docs:**
- `swagger-ui-express` serving spec at `GET /api/docs`
- `backend/src/docs/openapi.ts` — OpenAPI 3.0 spec covering all route groups: Auth, Users, Products, Cart, Orders, Compounding, Ask Pharmacist, Appointments, Files, Notifications, Reports, Dashboard, FAQs, Audit
- Bearer auth (JWT) configured in Swagger UI
- All key routes documented with request parameters and response descriptions

**TypeScript:** 0 errors.

**All 10 backend phases complete. Frontend migration is the only remaining work.**

---

## Session: 2026-09-27 — Invoice Module + Commerce Platform Plan + UI Component System

**What was done:**
- Built complete invoice module: backend (schema, counter, numbering, service, HTML template, Playwright PDF, routes) + admin UI (list, detail, new adhoc, reports) + patient frontend (list, detail, order link)
- Invoice format: `MP-{E|A}-{YY}-{YY}-{00001}` (Canadian FY April–March, atomic counter)
- All amounts snapshotted at issuance; `createFromOrder` idempotent; guest token for unauthenticated PDF access
- Created `docs/MediSyn_Commerce_Platform_Plan.md` — multi-tenant subscription API product design
- Built three new reusable UI components: `DateRangePicker`, `FilterPanel` + `FilterField`, `DataGrid`
- Rewrote inventory movements page as first example of new component pattern

**See:** `worklog/2026-09-27.md` for full detail

---

## Session: 2026-09-28 (2) — Permissions Cleanup + Enterprise Thread System

**What was done:**
- Fixed admin invoice list (`ListResponse` bug — `data?.data` was always `[]` at runtime)
- Renamed admin sidebar "Invoices" group → "Billing"
- Added 6 new granular permissions: `inventory.batches.recall`, `inventory.movements.read`, `invoices.reports`, `threads.read`, `threads.reply_patient`, `threads.add_note`
- Updated inventory + invoice routes to enforce new permissions
- Built full enterprise thread system: `Thread` + `ThreadMessage` MongoDB collections (separate, not embedded), cursor pagination, quoted replies (parentMessageId), soft deletes, read tracking, 15-min edit window
- Built `AdminThreadPanel` component: collapsible, two tabs, date dividers, timestamps, hover reply/edit/delete, inline edit form, Ctrl+Enter, load earlier
- Added `AdminThreadPanel` to 7 admin detail pages (orders, prescriptions, ask-pharmacist, compounding, minor-ailments, appointments, patient users)
- Built patient `/messages` page: chat UI with aligned bubbles, date dividers, reply-to, 60s polling
- Added "Messages" to patient portal nav

**Remaining for next session:**
1. Fix `ListResponse` bug across all other admin list pages (orders, prescriptions, etc.)
2. Vaccine detail calendar view (confirmed, never implemented)
3. Thread permission guard in AdminThreadPanel
4. Patient entity thread read view (from patient portal)
5. Admin Messages inbox view
6. Re-run `npm run seed` to register new permissions in DB

**See:** `worklog/2026-09-28.md` (Session 2) for full detail

---

## Session: 2026-09-28 — UI Component Rollout + Invoice PDF Fixes

**What was done:**
- Rewrote near-expiry, invoices list, and invoices reports pages using new FilterPanel + DateRangePicker + DataGrid pattern — removed all native `<select>`, pill buttons, and raw `<input type="date">` elements
- Fixed invoice PDF 401: replaced `pdfUrl()` (bare URL, no auth header) with `downloadPdf()` (axios blob with Bearer token) across 4 files
- Fixed invoice PDF 500: `playwright-core` has no bundled browser — switched to full `playwright` package; requires `npx playwright install chromium` one-time setup
- Diagnosed invoice sidebar not showing: `invoices.read` permission not yet in DB — fixed by re-running `npm run seed`

**See:** `worklog/2026-09-28.md` for full detail

---

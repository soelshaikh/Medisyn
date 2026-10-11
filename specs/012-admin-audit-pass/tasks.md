---

description: "Task list for Admin Panel Audit Pass — fix API integration, add backend routes, stub missing pages"
---

# Tasks: Admin Panel Audit Pass

**Input**: Design documents from `specs/012-admin-audit-pass/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Not requested — manual validation via quickstart.md scenarios.

**Organization**: Tasks grouped by user story to enable independent testing of each phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the reusable component and backend directory structure needed by later phases.

- [ ] T001 Create `FeatureNotAvailable` client component in `admin/src/components/common/FeatureNotAvailable.tsx` — accepts optional `title?: string` and `description?: string` props; renders a centered card with a "wrench" icon, the title (default: "Feature Coming Soon"), description (default: "This section is not yet available"), and a Back button using `useRouter().back()`. Must be `"use client"`.
- [ ] T002 Create backend super-admin module directory structure: create empty placeholder files at `backend/src/core/super-admin/users/users.router.ts`, `backend/src/core/super-admin/users/users.queries.ts`, `backend/src/core/super-admin/roles/roles.router.ts`, `backend/src/core/super-admin/roles/roles.queries.ts`, `backend/src/core/super-admin/permissions/permissions.router.ts`, `backend/src/core/super-admin/audit/audit.router.ts`, `backend/src/core/super-admin/audit/audit.queries.ts`, `backend/src/core/super-admin/super-admin.router.ts` — just export empty Express routers for now so the index can compile.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `_id` → `id` rename in `admin/src/types/admin.ts` is the single highest-impact change — it affects every page in the admin panel. Must be complete before any user story implementation begins. Backend super-admin route scaffold must be complete for US4.

**CRITICAL**: No user story work can begin until T003–T004 are complete.

- [ ] T003 Rename `_id: string` → `id: string` on every interface in `admin/src/types/admin.ts` — affected interfaces: `AdminUser`, `AdminRole`, `AuditLog`, `AdminOrder`, `OrderItem`, `AdminBrand`, `AdminProduct`, `AdminCoupon`, `AdminPrescription`, `AdminCompoundingRequest`, `AdminAskPharmacist`, `VaccineService`, `AppointmentSlot`, `AppointmentBooking`, `AdminAilmentRequest`, `AdminInvoice`, `InvoiceLineItem`, `InvoiceLineItemHistory`, `PaymentTransaction`, `PaymentAllocation`, `FAQ`. Use replace_all: true for `_id: string` → `id: string` within this file only.
- [ ] T004 After T003 completes, run `cd admin && npx tsc --noEmit` to surface all pages/components that still reference `._id`. For each error: change `entity._id` → `entity.id`, `row._id` → `row.id`, `keyFn={(r) => r._id}` → `keyFn={(r) => r.id}`, route template literals like `` `/orders/${order._id}` `` → `` `/orders/${order.id}` ``. Fix errors in files under `admin/src/app/(dashboard)/`, `admin/src/api/`, and `admin/src/components/` until `tsc --noEmit` exits with 0 errors.

**Checkpoint**: `cd admin && npx tsc --noEmit` exits 0 — foundational type fix complete.

---

## Phase 3: User Story 1 — API Integration Verified (Priority: P1) — MVP

**Goal**: Every admin API module calls the correct backend URL path and correctly extracts the response envelope. Zero 404s on valid data requests.

**Independent Test**: Navigate to `/orders`, `/products`, and `/reports/sales` with DevTools open — each page loads data and the network requests hit `/api/v1/admin/orders`, `/api/v1/catalogue/products/...`, and `/api/v1/admin/reports/sales` respectively (no 404s).

- [ ] T005 [P] [US1] Fix `admin/src/api/orders.api.ts`: change `BASE = "/orders"` (remove base), update `list()` to `GET /admin/orders` extracting `r.data.data` for rows and `r.data.pagination.total` for total; `getById()` to `GET /admin/orders/:id` extracting `r.data.data`; `updateStatus()` to `PATCH /admin/orders/:id/status` with body `{ newStatus }` (not `{ status }`); `addNote()` to `PATCH /admin/orders/:id/notes` (was POST). See `data-model.md` § Orders for exact shape.
- [ ] T006 [P] [US1] Fix `admin/src/api/notifications.api.ts`: in `list()` extract rows from `r.data.data.items` and total from `r.data.data.pagination.total` (was `r.data.data.data` / `r.data.data.total`); add `unreadCount` return field from `r.data.data.unreadCount`; delete the `unreadCount()` method that calls non-existent `GET /notifications/unread-count`. Update the return type to include `unreadCount: number` alongside `data` and `total`.
- [ ] T007 [P] [US1] Fix `admin/src/api/reports.api.ts`: rename `customers()` method to `patients()` and change path from `/admin/reports/customers` → `/admin/reports/patients`. In any pages that import `reportsApi.customers()`, update the call to `reportsApi.patients()`. Do NOT add product or coupon endpoints (those pages will be stubbed in US5).
- [ ] T008 [P] [US1] Fix `admin/src/api/products.api.ts`: change `BASE = "/products"` → `BASE = "/catalogue/products"`. Verify all method paths remain the same relative to the new base. Check against `backend/src/modules/catalogue/products/product.router.ts` for exact admin product sub-paths and fix any mismatches.
- [ ] T009 [P] [US1] Verify `admin/src/api/prescriptions.api.ts` against `backend/src/modules/healthcare/prescriptions/prescription.router.ts`: read both files, compare each path, fix any mismatches. Document what was changed (or "no changes needed") in a comment at the top of the file.
- [ ] T010 [P] [US1] Verify `admin/src/api/compounding.api.ts` against `backend/src/modules/healthcare/compounding/compounding.router.ts`: read both files, compare each path, fix any mismatches.
- [ ] T011 [P] [US1] Verify `admin/src/api/ask-pharmacist.api.ts` against `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.router.ts` (or equivalent): read both files, compare each path, fix any mismatches.
- [ ] T012 [P] [US1] Verify `admin/src/api/appointments.api.ts` against `backend/src/modules/appointments/appointments/appointment.router.ts`: read both files, compare each path, fix any mismatches.
- [ ] T013 [P] [US1] Verify `admin/src/api/categories.api.ts` and `admin/src/api/coupons.api.ts` against their respective backend routers under `backend/src/modules/catalogue/`: read both pairs, compare paths, fix any mismatches.
- [ ] T014 [P] [US1] Verify `admin/src/api/invoices.api.ts` against the backend commerce router (look in `backend/src/modules/checkout/` or equivalent): read both files, compare paths, fix mismatches.
- [ ] T015 [US1] After T005–T014 complete, run `cd admin && npx tsc --noEmit` — fix any new TypeScript errors introduced by the API signature changes (e.g., updated return type of `notificationsApi.list()`). Ensure 0 errors.
- [ ] T016 [US1] For each list page that uses a fixed API module (orders, products, prescriptions, notifications), verify the TanStack Query `select` or destructuring correctly handles the new response shape: e.g. `orders/page.tsx` destructures `{ data: rows, pagination }` not `{ data: { data: rows, total } }`. Fix any page-level extraction mismatches found.

**Checkpoint**: DevTools shows `/admin/orders`, `/catalogue/products/...`, `/admin/reports/sales` return 200. No list page makes a 404 call for its primary data fetch.

---

## Phase 4: User Story 2 — Live Dashboard (Priority: P1)

**Goal**: The dashboard page calls the correct backend reports endpoint and displays live metrics — no placeholder zeros or dashes.

**Independent Test**: Navigate to `/dashboard` after login → DevTools shows `GET /api/v1/admin/reports/dashboard` (not `/api/v1/admin/dashboard/metrics`) returns 200 → all metric cards display numeric values.

- [ ] T017 [US2] Fix `admin/src/api/dashboard.api.ts`: change `metrics()` method path from `/admin/dashboard/metrics` → `/admin/reports/dashboard`. Update response extraction to `r.data.data` (the dashboard object is at `data.data` per standard single-record envelope).
- [ ] T018 [US2] Open `admin/src/app/(dashboard)/dashboard/page.tsx` (or wherever the dashboard TanStack Query call is). Verify the `useQuery` calls `dashboardApi.metrics()` (updated path) and that the response destructuring matches the actual shape returned by `/admin/reports/dashboard`. Fix the shape extraction if the page is still referencing stale field names.

**Checkpoint**: Navigating to `/dashboard` → network tab shows 200 from `/admin/reports/dashboard` → metric cards render real values.

---

## Phase 5: User Story 3 — Permission Guards on Sensitive Actions (Priority: P2)

**Goal**: Every destructive or sensitive action button in the admin panel renders only when the logged-in admin has the required permission. Uses `hasPermission(key)` from `useAdminAuthStore`.

**Independent Test**: Import `useAdminAuthStore` on an order detail page. Temporarily remove all permissions from the test account. Navigate to `/orders/:id` — Cancel Order button does not appear. Re-add `orders.manage` permission — button appears.

- [ ] T019 [P] [US3] Add `hasPermission` guards to `admin/src/app/(dashboard)/orders/[id]/page.tsx`: import `useAdminAuthStore`, get `hasPermission`, wrap Cancel Order and Status Advance buttons: `{hasPermission('orders.manage') && <Button>...</Button>}`.
- [ ] T020 [P] [US3] Add `hasPermission` guards to `admin/src/app/(dashboard)/invoices/[id]/page.tsx`: wrap Void Invoice button with `{hasPermission('invoices.manage') && ...}`.
- [ ] T021 [P] [US3] Add `hasPermission` guards to `admin/src/app/(dashboard)/prescriptions/[id]/page.tsx`: wrap Approve and Reject buttons with `{hasPermission('prescriptions.write') && ...}`.
- [ ] T022 [P] [US3] Add `hasPermission` guards to `admin/src/app/(dashboard)/compounding/[id]/page.tsx`: wrap Quote, Approve, and Reject buttons with `{hasPermission('compounding.write') && ...}`.
- [ ] T023 [P] [US3] Add `hasPermission` guards to `admin/src/app/(dashboard)/users/[id]/page.tsx`: wrap Deactivate and Assign Role buttons with `{hasPermission('users.manage') && ...}`.
- [ ] T024 [P] [US3] Add `hasPermission` guards to `admin/src/app/(dashboard)/appointments/[id]/page.tsx`: wrap Cancel and Confirm buttons with `{hasPermission('appointments.manage') && ...}`.
- [ ] T025 [US3] Run `cd admin && npx tsc --noEmit` — fix any TypeScript errors from the guard additions. Ensure 0 errors.

**Checkpoint**: All 6 detail pages have permission guards. `tsc --noEmit` passes.

---

## Phase 6: User Story 4 — Roles and Permissions Management (Priority: P2)

**Goal**: The roles list, role detail/edit, and permissions pages are fully functional end-to-end, backed by real backend routes. A super-admin can create, edit, assign permissions to, and delete roles through the UI.

**Independent Test**: Navigate to `/roles` → roles load from `GET /admin/roles`. Create a new role → POST succeeds → role appears in list. Edit role → assign permissions → PUT succeeds → permissions persist. Delete role → DELETE succeeds → role removed.

### Backend — Create super-admin route modules

- [ ] T026 [US4] Implement `backend/src/core/super-admin/permissions/permissions.router.ts`: create Express router, add `GET /` handler that queries `superAdminDb` for all rows in the `permissions` table (columns: `key`, `name`, `description`), returns `{ data: rows }`. Import `superAdminDb` from `backend/src/db/index.ts`. No auth middleware needed here — the parent router will add it.
- [ ] T027 [US4] Implement `backend/src/core/super-admin/audit/audit.queries.ts`: write `listAuditEntries(params: { page, limit, facilityId?, action?, actorId?, dateFrom?, dateTo? })` Drizzle query against the `audit_log` table (from `backend/src/db/schema/audit.ts` — import `auditSchema`). Returns `{ rows: AuditEntry[], total: number }`. Use `superAdminDb`.
- [ ] T028 [US4] Implement `backend/src/core/super-admin/audit/audit.router.ts`: `GET /` handler — parse query params `page` (default 1), `limit` (default 20), `facilityId`, `action`, `actorId`, `dateFrom`, `dateTo` — calls `listAuditEntries()` — returns `{ data: rows, pagination: { page, limit, total, totalPages } }`.
- [ ] T029 [US4] Implement `backend/src/core/super-admin/users/users.queries.ts`: write `listFacilityUsers(params: { page, limit, search?, facilityId? })` — join `facility_users` + `users` + `facility_roles` tables using `superAdminDb`. Returns `{ rows: UserListItem[], total: number }`. Write `getFacilityUser(userId: string)` — returns full user detail with memberships array. Schema imports: `usersSchema` from `backend/src/db/schema/core.ts`, `rbacSchema` from `backend/src/db/schema/rbac.ts`.
- [ ] T030 [US4] Implement `backend/src/core/super-admin/users/users.router.ts`: `GET /` (list, calls `listFacilityUsers`), `GET /:id` (detail, calls `getFacilityUser`), `PATCH /:id/status` (body: `{ isActive: boolean }` — updates `facility_users.is_active`), `PATCH /:id/roles` (body: `{ roleId: string, facilityId: string }` — updates `facility_users.role_id`). All use `superAdminDb`. Return standard envelopes.
- [ ] T031 [US4] Implement `backend/src/core/super-admin/roles/roles.queries.ts`: write `listRoles(facilityId?)` — queries `facility_roles` with permission count (left join `facility_role_permissions`). Write `getRoleWithPermissions(roleId)` — returns role + array of permission keys. Write `createRole(data: { facilityId, name })` — validates name uniqueness. Write `updateRole(roleId, data: { name? })` — blocks if `is_system_role`. Write `deleteRole(roleId)` — blocks if `is_system_role` or role has users. Write `setRolePermissions(roleId, permissionKeys: string[])` — deletes all `facility_role_permissions` for role, then inserts new rows using permission IDs looked up by key. All use `superAdminDb`.
- [ ] T032 [US4] Implement `backend/src/core/super-admin/roles/roles.router.ts`: `GET /` (list roles), `POST /` (create role — body: `{ facilityId, name }`), `GET /:id` (role detail with permissions), `PATCH /:id` (update name), `DELETE /:id` (delete), `PUT /:id/permissions` (body: `{ permissions: string[] }`). All routes call queries from T031. Return appropriate status codes: 201 for create, 200 for others, 409 for duplicate name, 422 for system-role mutation attempt.
- [ ] T033 [US4] Implement `backend/src/core/super-admin/super-admin.router.ts`: create Express router, add `requireSuperAdmin` middleware (checks `req.auth?.isSuperAdmin === true`, throws `AppError('FORBIDDEN', ...)` if not), mount sub-routers: `router.use('/users', usersRouter)`, `router.use('/roles', rolesRouter)`, `router.use('/permissions', permissionsRouter)`, `router.use('/audit', auditRouter)`. Apply `requireSuperAdmin` to the parent router before all sub-routers.
- [ ] T034 [US4] Mount super-admin router in `backend/src/app.ts`: import `superAdminRouter` from `backend/src/core/super-admin/super-admin.router.ts`, add `app.use('/api/v1/admin', authMiddleware, superAdminRouter)` after existing admin route registrations. Ensure the mount doesn't conflict with existing `/api/v1/admin/orders` and `/api/v1/admin/reports` mounts — check existing registrations first.
- [ ] T035 [US4] Run `cd backend && npx tsc --noEmit` — fix all TypeScript errors in the new super-admin module. Ensure 0 errors.

### Admin — Wire UI to new backend routes

- [ ] T036 [P] [US4] Update `admin/src/api/roles.api.ts` to match the new backend routes from T032: `GET /admin/roles` (list), `POST /admin/roles` (create), `GET /admin/roles/:id` (detail), `PATCH /admin/roles/:id` (update), `DELETE /admin/roles/:id` (delete), `PUT /admin/roles/:id/permissions` (set permissions — body `{ permissions: string[] }`). Verify response extraction aligns with `{ data: [...] }` envelope.
- [ ] T037 [P] [US4] Update `admin/src/api/audit.api.ts` to match the new backend route from T028: `GET /admin/audit` with params `page`, `limit`, `facilityId?`, `action?`, `actorId?`, `dateFrom?`, `dateTo?`. Extract rows from `r.data.data`, pagination from `r.data.pagination`.
- [ ] T038 [P] [US4] Add `admin/src/api/users.api.ts` or update existing users API module: `GET /admin/users` (list with `page`, `limit`, `search?`, `facilityId?`), `GET /admin/users/:id` (detail), `PATCH /admin/users/:id/status` (body `{ isActive: boolean }`), `PATCH /admin/users/:id/roles` (body `{ roleId: string, facilityId: string }`). Extract from standard envelope.
- [ ] T039 [US4] Run `cd admin && npx tsc --noEmit` — fix TypeScript errors from T036–T038. Ensure 0 errors.

**Checkpoint**: Navigate to `/roles` → roles load. Create a role → list refreshes. Edit permissions → change persists. Navigate to `/audit` → entries render. Navigate to `/users` → user list renders.

---

## Phase 7: User Story 5 — No Stub or Permanently-Loading Pages (Priority: P3)

**Goal**: Every admin panel page either shows real data, a proper empty state, or a clear "feature coming soon" message. No page makes a network call to a non-existent backend route.

**Independent Test**: Open DevTools, navigate to each stubbed page URL — zero network requests, no 404s, `FeatureNotAvailable` component renders cleanly.

- [ ] T040 [P] [US5] Stub `admin/src/app/(dashboard)/clinics/page.tsx`: remove all `useQuery`/`useMutation` calls and `clinicsApi` imports, replace page body with `<FeatureNotAvailable title="Clinic Management" description="Clinic management is not yet available in this version." />`. Keep page-level metadata/layout wrapper if present.
- [ ] T041 [P] [US5] Stub `admin/src/app/(dashboard)/clinics/[id]/page.tsx` (if it exists): same approach — remove API calls, render `<FeatureNotAvailable />`.
- [ ] T042 [P] [US5] Stub `admin/src/app/(dashboard)/partners/page.tsx` and `admin/src/app/(dashboard)/partners/[id]/page.tsx`: remove API calls, render `<FeatureNotAvailable title="Partner Management" />`.
- [ ] T043 [P] [US5] Stub `admin/src/app/(dashboard)/settings/page.tsx`: remove API calls, render `<FeatureNotAvailable title="Settings" description="Platform settings configuration is not yet available." />`.
- [ ] T044 [P] [US5] Stub `admin/src/app/(dashboard)/settings/email-triggers/page.tsx` (or wherever email-triggers lives): remove API calls, render `<FeatureNotAvailable title="Email Triggers" />`.
- [ ] T045 [P] [US5] Stub `admin/src/app/(dashboard)/faqs/page.tsx` (and `faqs/[id]/page.tsx` if present): remove API calls, render `<FeatureNotAvailable title="FAQ Management" />`.
- [ ] T046 [P] [US5] Stub `admin/src/app/(dashboard)/reports/products/page.tsx`: remove API calls that call non-existent `/admin/reports/products`, render `<FeatureNotAvailable title="Product Reports" description="Product analytics are not yet available." />`.
- [ ] T047 [P] [US5] Stub `admin/src/app/(dashboard)/reports/coupons/page.tsx`: remove API calls that call non-existent `/admin/reports/coupons`, render `<FeatureNotAvailable title="Coupon Reports" />`.
- [ ] T048 [US5] Run `cd admin && npx tsc --noEmit` — fix any TypeScript errors from removed imports in T040–T047. Ensure 0 errors.

**Checkpoint**: Navigate to each of the 7+ stubbed URLs in DevTools — zero network requests, no console errors, `FeatureNotAvailable` renders.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final TypeScript verification, empty/error state audit, and quickstart validation.

- [ ] T049 Run full TypeScript check across both projects: `cd backend && npx tsc --noEmit` then `cd admin && npx tsc --noEmit`. Fix every remaining error — target is 0 errors in both.
- [ ] T050 Audit every list page in `admin/src/app/(dashboard)/` — verify each has an `EmptyState` component rendered when `data.length === 0` and an error boundary or `isError` branch that renders an error message with a retry button when the TanStack Query returns `isError: true`. Fix any list page that shows a blank screen or infinite spinner on error/empty.
- [ ] T051 Audit detail pages for 404 handling: for each `[id]` route page that fetches a single record, verify there is an `if (error?.response?.status === 404)` check that renders a "Record not found" message with a back navigation link. Add 404 handling to any detail page that currently lacks it.
- [ ] T052 Run quickstart.md validation: follow scenarios S1–S13 from `specs/012-admin-audit-pass/quickstart.md` and confirm each passes. Note any that fail and fix the root cause.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 and T002 can start immediately and run in parallel
- **Foundational (Phase 2)**: No dependencies except T002 must complete before T034. T003 blocks T004.
- **User Stories (Phase 3+)**: All depend on T003 + T004 (Foundational) being complete
- **US1 (Phase 3)**: Depends on Phase 2. Tasks T005–T014 are all parallel (different files). T015–T016 depend on T005–T014.
- **US2 (Phase 4)**: Depends on Phase 2 only. Independent of US1.
- **US3 (Phase 5)**: Depends on Phase 2 only. T019–T024 are all parallel. T025 depends on all.
- **US4 (Phase 6)**: Backend tasks T026–T035 are sequential within the backend sub-module. Admin tasks T036–T038 are parallel, depend on T034 (backend mounted). T039 depends on T036–T038.
- **US5 (Phase 7)**: Depends on T001 (FeatureNotAvailable component). T040–T047 are all parallel. T048 depends on all.
- **Polish (Phase 8)**: Depends on all previous phases complete.

### User Story Dependencies

- **US1 (P1)**: Can start after T003 + T004 — no dependency on other user stories
- **US2 (P1)**: Can start after T003 + T004 — independent of US1
- **US3 (P2)**: Can start after T003 + T004 — independent of US1 and US2
- **US4 (P2)**: Backend portion (T026–T035) can start after T002. Admin portion (T036–T039) depends on T034.
- **US5 (P3)**: Can start after T001 — independent of all other user stories

### Within Each Phase

- All [P]-marked tasks touch different files — run simultaneously
- TypeScript check tasks (T004, T015, T025, T035, T039, T048) must run after their respective group
- Stub tasks (T040–T047) can all run in parallel after T001

---

## Parallel Execution Examples

### Parallel: Phase 2 Foundational + US4 Backend Start
```
[Parallel group A — can start immediately]
T001: Create FeatureNotAvailable component
T002: Create backend super-admin directory structure

[After T001 and T002: start Phase 2]
T003: Rename _id → id in admin/src/types/admin.ts  [blocks everything]
T004: Fix all ._id usages (tsc-driven)             [blocks US1–US5]
```

### Parallel: US1 API Fix (after T003+T004)
```
[All run simultaneously — different files]
T005: Fix orders.api.ts
T006: Fix notifications.api.ts
T007: Fix reports.api.ts
T008: Fix products.api.ts
T009: Verify prescriptions.api.ts
T010: Verify compounding.api.ts
T011: Verify ask-pharmacist.api.ts
T012: Verify appointments.api.ts
T013: Verify categories.api.ts, coupons.api.ts
T014: Verify invoices.api.ts
[Then sequential]
T015: tsc --noEmit → fix errors
T016: Verify page-level extraction
```

### Parallel: US3 Permission Guards (after T003+T004)
```
[All run simultaneously — different page files]
T019: orders/[id]/page.tsx guards
T020: invoices/[id]/page.tsx guards
T021: prescriptions/[id]/page.tsx guards
T022: compounding/[id]/page.tsx guards
T023: users/[id]/page.tsx guards
T024: appointments/[id]/page.tsx guards
[Then]
T025: tsc --noEmit → fix errors
```

### Parallel: US5 Stub Pages (after T001)
```
[All run simultaneously — different page files]
T040: clinics/page.tsx stub
T041: clinics/[id]/page.tsx stub
T042: partners pages stubs
T043: settings/page.tsx stub
T044: settings/email-triggers/page.tsx stub
T045: faqs pages stubs
T046: reports/products/page.tsx stub
T047: reports/coupons/page.tsx stub
[Then]
T048: tsc --noEmit → fix errors
```

---

## Implementation Strategy

### MVP First: US1 + US2 (Core API Integration)

1. Complete Phase 1: T001, T002
2. Complete Phase 2: T003 → T004
3. Complete Phase 3 (US1): T005–T016 in parallel, then sequential TypeScript checks
4. Complete Phase 4 (US2): T017–T018
5. **STOP and VALIDATE**: Open DevTools — all list pages make correct API calls with 200 responses. Dashboard shows live data. No `undefined` IDs in navigation links.

### Incremental Delivery

1. Setup + Foundational → All `id` references correct, no runtime `undefined` IDs
2. US1 → Every API module hits a real backend route
3. US2 → Dashboard shows live metrics
4. US3 → Destructive actions respect permissions
5. US4 → Full RBAC management UI functional
6. US5 → No broken stub pages in sidebar
7. Polish → TypeScript clean, empty/error states complete, quickstart validated

---

## Notes

- [P] tasks touch different files — run in parallel to save time
- Run `tsc --noEmit` after each phase group before moving on — catches issues early
- T003 is the most impactful single task — take care, it affects 20+ interfaces
- T034 (mounting super-admin router) must not create conflicting route prefixes with existing admin routes in `app.ts` — read the existing registrations first
- Stub tasks (T040–T047) must import `FeatureNotAvailable` from `admin/src/components/common/FeatureNotAvailable.tsx` — T001 must be done first
- The `requireSuperAdmin` middleware in T033 checks `req.auth?.isSuperAdmin` — verify the auth JWT payload includes this field (check `backend/src/core/auth/auth.service.ts` for the super-admin login token generation)

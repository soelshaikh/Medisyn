# Research: Admin Panel Audit Pass

**Feature**: specs/012-admin-audit-pass/
**Date**: 2026-10-11

---

## CRITICAL DISCOVERY: Backend is PostgreSQL + Drizzle, NOT MongoDB

**Decision**: Backend uses **PostgreSQL + Drizzle ORM** (confirmed from `backend/src/db/index.ts`).

**Rationale**: The backend was implemented with Drizzle against PostgreSQL. CLAUDE.md originally stated MongoDB + Mongoose, but the actual codebase never switched. The admin panel was pre-built assuming MongoDB-style response shapes (using `_id` string fields). This is the root cause of the majority of integration failures.

**Implication**: Every admin type interface uses `_id: string` (MongoDB convention) but the backend returns `id: string` (PostgreSQL UUID). This affects every list page's row keys, every detail page navigation, and every API mutation that passes an entity ID.

**How to apply**: All admin `types/admin.ts` interfaces must rename `_id` to `id`. All template literals that interpolate `entity._id` must change to `entity.id`. All `keyFn={(row) => row._id}` calls must use `row.id`.

---

## Decision 1: `_id` → `id` Rename (CONFIRMED — mandatory)

**Decision**: Rename `_id` to `id` in all admin-facing TypeScript types and all pages/components that reference `_id`.

**Rationale**: Backend (Drizzle + PostgreSQL) returns `id: string` UUIDs. Admin types define `_id: string`. At runtime, every row.\_id resolves to `undefined` because the property doesn't exist. TypeScript passes because the admin types define `_id`, but the backend never sends it.

**Scope**: `admin/src/types/admin.ts` — rename `_id` to `id` on: AdminUser, AdminRole, AuditLog, AdminOrder, AdminBrand, AdminProduct, AdminCoupon, AdminPrescription, AdminCompoundingRequest, AdminAskPharmacist, VaccineService, AppointmentSlot, AppointmentBooking, AdminAilmentRequest, AdminInvoice, InvoiceLineItem, InvoiceLineItemHistory, PaymentTransaction, PaymentAllocation, FAQ.

**Alternatives considered**: Add a backend transform to return both `id` and `_id`. Rejected — transforming all service responses adds unnecessary complexity and diverges from Drizzle's natural output.

---

## Decision 2: Order API Path Fix (CONFIRMED)

**Decision**: Fix `orders.api.ts` to use `/admin/orders` not `/orders/admin`.

**Rationale**: Backend router registers `GET /admin/orders` (in `order.router.ts`, mounted under `/api/v1` in `app.ts`). The admin API module uses `BASE = "/orders"` and calls `${BASE}/admin` → `/orders/admin` → **404**.

**Fixes required**:
- `ordersApi.list()`: `GET /orders/admin` → `GET /admin/orders`
- `ordersApi.getById()`: `GET /orders/admin/:id` → `GET /admin/orders/:id`
- `ordersApi.updateStatus()`: `PATCH /orders/admin/:id/status` with `{status}` → `PATCH /admin/orders/:id/status` with `{newStatus}` (backend expects `newStatus` not `status`)
- `ordersApi.addNote()`: `POST /orders/admin/:id/notes` → `PATCH /admin/orders/:id/notes`
- Response shape: backend returns `{ data: rows, pagination: { page, limit, total, totalPages } }` — admin must extract `r.data.data` as the rows array and `r.data.pagination.total` for pagination.

---

## Decision 3: Dashboard API Fix (CONFIRMED)

**Decision**: Fix `dashboard.api.ts` to call `/admin/reports/dashboard` instead of `/admin/dashboard/metrics`.

**Rationale**: `app.ts` mounts `reportsRouter` at `/api/v1/admin/reports`. The router defines `GET /dashboard`. Full path: `/api/v1/admin/reports/dashboard`. Admin calls `/admin/dashboard/metrics` → 404. No separate metrics endpoint exists.

**Fix**: `dashboardApi.metrics()` → `GET /admin/reports/dashboard` → extract from `r.data.data`.

---

## Decision 4: Reports API Partial Fix (CONFIRMED)

**Decision**: Fix path for `customers` report; stub `products` and `coupons` reports as "not yet available".

**Rationale**: Backend reports router has: `GET /sales`, `GET /orders`, `GET /patients`, `GET /dashboard`. Admin `reports.api.ts` calls: `/admin/reports/sales` ✓, `/admin/reports/orders` ✓, `/admin/reports/products` ✗ (no route), `/admin/reports/customers` ✗ (should be `/patients`), `/admin/reports/coupons` ✗ (no route).

**Fixes**:
- `reportsApi.customers()` → call `/admin/reports/patients` (rename function to align with what backend returns)
- `reportsApi.products()` and `reportsApi.coupons()` → display a "This report is not yet available" placeholder on the corresponding admin pages; do NOT call a non-existent endpoint.

---

## Decision 5: Notifications Shape Fix (CONFIRMED)

**Decision**: Fix `notifications.api.ts` response extraction to match backend envelope.

**Rationale**: Backend `notifications.router.ts` returns:
```json
{ "success": true, "data": { "items": [...], "unreadCount": 5, "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } } }
```
Admin `notifications.api.ts` extracts: `r.data.data` (which would give `{ items, unreadCount, pagination }`) — the shape is different from what the admin `notificationsApi.list()` signature expects (`{ data: AdminNotification[]; total: number }`).

Also: `notificationsApi.unreadCount()` calls `GET /notifications/unread-count` which does NOT exist on the backend. The unread count is available in the `/notifications` response and in `/auth/me`.

**Fixes**:
- `notificationsApi.list()` → extract `r.data.data.items` for the notification array, `r.data.data.pagination.total` for count
- Remove `notificationsApi.unreadCount()` or alias it to re-use the list response count
- Update `AdminNotification` type to match actual backend notification schema (check `notifications.service.ts` for shape)

---

## Decision 6: Missing Backend Routes — Create Core Admin Routes (CONFIRMED)

**Decision**: Create the following backend route modules for core admin functionality:
1. `/api/v1/admin/users` — list facility users, get user + profile, update user status, assign roles
2. `/api/v1/admin/roles` — list, create, update, delete facility roles; assign/revoke permissions
3. `/api/v1/admin/permissions` — list all available permissions (from `permissions` table)
4. `/api/v1/admin/audit` — paginated audit log listing (from `audit` schema table)

**Rationale**: These four are required for the core admin RBAC management UI to function. The DB schema already has all the necessary tables (`facility_users`, `facility_roles`, `facility_role_permissions`, `permissions`, and the audit table). No new migrations are needed — routes just need to query existing data.

**Alternatives considered**: Stub these pages as "not yet implemented". Rejected — users, roles, and permissions are core admin features confirmed in CLAUDE.md as required for Phase 2. Without them the admin panel cannot manage access control at all.

---

## Decision 7: Missing Backend Routes — Stub Non-Critical Pages (CONFIRMED)

**Decision**: The following admin pages will display a "Feature coming soon" state. Their corresponding backend routes will NOT be created in Phase 12:
- `/clinics` pages — `clinicsApi` calls `/admin/clinics` (no backend route)
- `/partners` pages — `partnersApi` calls `/admin/partners` (no backend route)
- `/settings` page — `settingsApi` calls `/settings` (no backend route)
- `/admin/email-triggers` — `emailTriggersApi` calls `/admin/email-triggers` (no backend route)
- `/admin/faqs` pages — `faqsApi` calls `/admin/faqs` (no backend route)

**Rationale**: These features require new backend modules with business logic (e.g., facility management, pharmacy config). Phase 12 is an audit pass — building full clinic/partner/settings backends is Phase 13+ work. A "feature not yet available" empty state is better than a page that silently 404s on every load.

**How to apply**: Admin pages for these domains should wrap their content in a `<FeatureNotAvailable />` component that shows a clear message and does not attempt any API calls.

---

## Decision 8: Products API Path Check (CONFIRMED)

**Decision**: Products admin API calls `/products/admin/all` and `/products/admin/:id` — need to verify these match the backend catalogue product router.

**Research finding**: `product.router.ts` is mounted via `catalogueRouter` at `/api/v1/catalogue`. So the actual product paths are:
- `GET /api/v1/catalogue/products` (public)
- Likely `GET /api/v1/catalogue/products/admin/all` for admin list — needs confirmation from the full product router (not fully read)

**Decision**: Read the full `product.router.ts` to verify admin product routes before fixing. If the admin path `/products/admin/all` doesn't match, fix accordingly. Products are under `/catalogue/products` not `/products` in the backend.

**Confirmed fix needed**: Admin `products.api.ts` uses `BASE = "/products"` but backend mounts products at `/catalogue/products`. Fix: change BASE to `/catalogue/products`.

---

## Decision 9: Audit Log Schema (CONFIRMED)

**Decision**: The audit log backend table name is in `backend/src/db/schema/audit.ts`. Use the schema to create a proper `GET /admin/audit` endpoint returning paginated log entries.

**Rationale**: `auditSchema` is imported in `db/index.ts` so the table exists. The admin `audit.api.ts` expects `GET /admin/audit` returning `ListResponse<AuditLog>`. Need to verify the actual column names from `audit.ts` schema file to write correct Drizzle queries.

---

## Backend Response Shape Reference (CONFIRMED)

From reading backend routers, the standard response patterns are:

### Paginated list (used in orders, reports)
```json
{ "data": [...rows], "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

### Single record
```json
{ "data": { ...record } }
```

### Reports router (all reports)
```json
{ "data": { ...reportObject } }
```

### Notifications (different from standard)
```json
{ "success": true, "data": { "items": [...], "unreadCount": 5, "pagination": { ... } } }
```

### Auth /me response
```json
{ "data": { "id": "...", "email": "...", "firstName": "...", "lastName": "...", "emailVerified": true, "role": null, "facilityId": null, "unreadCount": 0 } }
```

**Note**: Some older admin API modules may use `meta` instead of `pagination`. The backend uses both patterns:
- Orders: `pagination` key
- Catalogue products: likely `meta` key (follow existing convention already in `usersApi.list()`)

---

## Tech Stack Summary (CONFIRMED)

| Layer | Technology | Status |
|-------|-----------|--------|
| Admin frontend | Next.js 16.2.6, React 19, TypeScript 5 | ✓ confirmed |
| Admin state | Zustand v5 + TanStack Query v5 | ✓ confirmed |
| Admin HTTP | Axios (apiClient in `admin/src/lib/apiClient.ts`) | ✓ confirmed |
| Admin auth store | `adminAuthStore.ts` — `hasPermission(key)` checks `user.permissions.includes(key)` | ✓ confirmed |
| Backend | Express.js + TypeScript strict | ✓ confirmed |
| Backend DB | PostgreSQL + Drizzle ORM | ✓ confirmed |
| Backend auth | JWT (access token in header, refresh in httpOnly cookie) | ✓ confirmed |
| Backend RBAC | Permissions-based; `requirePermission(key)` middleware | ✓ confirmed |
| Entity IDs | UUID strings returned as `id` (not `_id`) | ✓ confirmed |

---

## Full Backend Route Inventory (for Verification)

### Routes that EXIST and admin calls them (some with wrong paths):

| Backend Path | Method | Admin Calls | Status |
|---|---|---|---|
| `/api/v1/auth/super-admin/login` | POST | `/auth/super-admin/login` | ✓ |
| `/api/v1/auth/me` | GET | `/auth/me` | ✓ |
| `/api/v1/auth/logout` | POST | `/auth/logout` | ✓ |
| `/api/v1/auth/refresh` | POST | `/auth/refresh` | ✓ |
| `/api/v1/admin/orders` | GET | `/orders/admin` | ✗ PATH WRONG |
| `/api/v1/admin/orders/:id` | GET | `/orders/admin/:id` | ✗ PATH WRONG |
| `/api/v1/admin/orders/:id/status` | PATCH | `/orders/admin/:id/status` + wrong body key | ✗ PATH + BODY WRONG |
| `/api/v1/admin/orders/:id/cancel` | POST | not mapped | — |
| `/api/v1/admin/orders/:id/notes` | PATCH | `POST /orders/admin/:id/notes` | ✗ PATH + METHOD WRONG |
| `/api/v1/admin/reports/sales` | GET | `/admin/reports/sales` | ✓ |
| `/api/v1/admin/reports/orders` | GET | `/admin/reports/orders` | ✓ |
| `/api/v1/admin/reports/patients` | GET | `/admin/reports/customers` | ✗ PATH WRONG |
| `/api/v1/admin/reports/dashboard` | GET | `/admin/dashboard/metrics` | ✗ PATH WRONG |
| `/api/v1/admin/email-log` | GET | `/admin/email-log` | ✓ (need to verify shape) |
| `/api/v1/notifications` | GET | `/notifications` | ✓ path, ✗ shape |
| `/api/v1/notifications/:id/read` | PATCH | `/notifications/:id/read` | ✓ |
| `/api/v1/notifications/read-all` | POST | `/notifications/read-all` | ✓ |
| `/api/v1/notifications/:id` | DELETE | not mapped | — |
| `/api/v1/admin/notifications/broadcast` | POST | not mapped | — |
| `/api/v1/catalogue/products` | GET (public) | `/products` | ✗ prefix wrong |
| Healthcare routes | various | various | need verification |
| Appointments routes | various | various | need verification |
| Catalogue (categories, coupons, inventory) | various | various | need verification |

### Routes that DO NOT EXIST (admin calls them → 404):

| Admin Calls | Status | Plan |
|---|---|---|
| GET `/admin/dashboard/metrics` | ✗ MISSING | Fix path to `/admin/reports/dashboard` |
| GET `/users` | ✗ MISSING | Create backend route |
| GET `/admin/roles` | ✗ MISSING | Create backend route |
| POST `/admin/roles` | ✗ MISSING | Create backend route |
| PATCH `/admin/roles/:id` | ✗ MISSING | Create backend route |
| DELETE `/admin/roles/:id` | ✗ MISSING | Create backend route |
| PUT `/admin/roles/:id/permissions` | ✗ MISSING | Create backend route |
| GET `/admin/permissions` | ✗ MISSING | Create backend route |
| GET `/admin/audit` | ✗ MISSING | Create backend route |
| GET `/admin/clinics` | ✗ MISSING | Stub page |
| GET `/admin/partners` | ✗ MISSING | Stub page |
| GET `/settings` | ✗ MISSING | Stub page |
| GET `/admin/email-triggers` | ✗ MISSING | Stub page |
| GET `/admin/faqs` | ✗ MISSING | Stub page |
| GET `/admin/reports/products` | ✗ MISSING | Stub page |
| GET `/admin/reports/coupons` | ✗ MISSING | Stub page |
| GET `/notifications/unread-count` | ✗ MISSING | Remove this call |

# Quickstart Validation Guide: Admin Panel Audit Pass

**Feature**: specs/012-admin-audit-pass/

---

## Prerequisites

- Backend running on port 3001: `cd backend && npm run dev`
- Admin panel running on port 3002: `cd admin && npm run dev`
- Backend has at least one super-admin account (seeded or created manually)
- PostgreSQL and Redis running locally

---

## Scenario 1: Login and Dashboard

**Goal**: Confirm login works and dashboard shows live metrics (not zeroed-out placeholders).

1. Open `http://localhost:3002/login`
2. Enter super-admin credentials and submit
3. **Expected**: Redirect to `/dashboard`
4. **Expected**: Dashboard metric cards show non-zero values (assuming seeded data)
5. Open browser DevTools → Network tab
6. **Expected**: One request to `GET /api/v1/admin/reports/dashboard` returns 200 with `{ data: { ... } }`
7. **Not expected**: No request to `/admin/dashboard/metrics` (old broken path)

---

## Scenario 2: Orders List Page

**Goal**: Confirm orders load with the correct API path and response shape.

1. Navigate to `http://localhost:3002/orders`
2. **Expected**: Table renders with real order data (or empty state if no orders exist)
3. DevTools → Network: Request is `GET /api/v1/admin/orders` (not `/api/v1/orders/admin`)
4. Response shape: `{ data: [...], pagination: { page, limit, total, totalPages } }`
5. Click any order row
6. **Expected**: Navigate to `/orders/<id>` where `<id>` is a valid UUID — not `undefined`
7. **Expected**: Order detail page loads with full order data

**Key check**: Order rows use `order.id` not `order._id` for navigation.

---

## Scenario 3: Order Status Update

**Goal**: Confirm the update-status mutation uses the correct body key.

1. Navigate to an order detail page `/orders/<valid-uuid>`
2. Trigger a status change action (e.g., "Confirm Order" or "Process")
3. DevTools → Network: PATCH request to `GET /api/v1/admin/orders/:id/status`
4. **Expected request body**: `{ "newStatus": "confirmed" }` — NOT `{ "status": "confirmed" }`
5. **Expected**: 200 response, order status updates on page

---

## Scenario 4: Notifications

**Goal**: Confirm notification bell loads from the correct response shape.

1. On any dashboard page, observe the notification bell count
2. DevTools → Network: `GET /api/v1/notifications`
3. Response shape: `{ success: true, data: { items: [...], unreadCount: N, pagination: {...} } }`
4. **Expected**: Bell displays `unreadCount` correctly
5. **Not expected**: No call to `/notifications/unread-count` (removed endpoint)

---

## Scenario 5: Products List

**Goal**: Confirm product admin API uses the correct base path.

1. Navigate to `http://localhost:3002/products`
2. DevTools → Network: Request is `GET /api/v1/catalogue/products/...` (not `/api/v1/products/...`)
3. **Expected**: Products table renders with data or proper empty state

---

## Scenario 6: Stub Pages

**Goal**: Confirm stubbed pages don't make API calls or show broken spinners.

1. Navigate to each stubbed URL:
   - `http://localhost:3002/clinics`
   - `http://localhost:3002/partners`
   - `http://localhost:3002/settings`
   - `http://localhost:3002/settings/email-triggers`
   - `http://localhost:3002/faqs`
   - `http://localhost:3002/reports/products`
   - `http://localhost:3002/reports/coupons`
2. **Expected**: Each page renders a "Feature coming soon" (FeatureNotAvailable) component
3. DevTools → Network: **Zero API requests** on these pages
4. **Not expected**: 404 errors, infinite spinners, or empty white pages

---

## Scenario 7: Roles Management (Full CRUD)

**Goal**: Confirm roles API routes work end-to-end.

1. Navigate to `http://localhost:3002/roles`
2. **Expected**: Roles list renders with role names and permission counts
3. DevTools: `GET /api/v1/admin/roles` returns 200 with `{ data: [...] }`
4. Click "Create Role" → fill in name "Test Role" → submit
5. **Expected**: POST to `/api/v1/admin/roles` → 201 → new role appears in list
6. Click the new role → open edit/detail view
7. **Expected**: GET `/api/v1/admin/roles/:id` → returns role with permissions list
8. Toggle a permission checkbox → save
9. **Expected**: PUT `/api/v1/admin/roles/:id/permissions` → 200 → permissions updated
10. Delete the test role
11. **Expected**: DELETE `/api/v1/admin/roles/:id` → 200 → role removed from list

---

## Scenario 8: Permissions Page

**Goal**: Confirm all system permissions are listed from the database.

1. Navigate to `http://localhost:3002/permissions`
2. **Expected**: Full list of permissions from DB, grouped by domain prefix (orders.*, healthcare.*, etc.)
3. DevTools: `GET /api/v1/admin/permissions` → 200 → `{ data: PermissionItem[] }`
4. **Expected**: Zero empty groups, all permissions have a `key` and `name`

---

## Scenario 9: Users List

**Goal**: Confirm admin user management works.

1. Navigate to `http://localhost:3002/users`
2. **Expected**: User list renders with email, name, role
3. DevTools: `GET /api/v1/admin/users` → 200 with paginated response
4. Click a user row
5. **Expected**: Navigate to `/users/<valid-uuid>` — not `/users/undefined`
6. On user detail, confirm "Deactivate" button is visible only if `hasPermission('users.manage')` is true

---

## Scenario 10: Audit Log

**Goal**: Confirm audit log page loads from backend.

1. Navigate to `http://localhost:3002/audit`
2. **Expected**: Audit log entries rendered (may be empty on fresh DB)
3. DevTools: `GET /api/v1/admin/audit` → 200 with paginated response
4. **Expected**: `{ data: AuditEntry[], pagination: {...} }` — entries show `action`, `actorType`, `createdAt`

---

## Scenario 11: Permission Guard Smoke Test

**Goal**: Confirm `hasPermission()` gates are in place on destructive actions.

1. Log in as a super admin with all permissions
2. Navigate to an order detail page → **Expected**: "Cancel Order" button is visible
3. Log in as an admin with no permissions (or limited role with no `orders.manage`)
4. Navigate to same order detail
5. **Expected**: "Cancel Order" button is hidden
6. Repeat for: Invoice void (needs `invoices.manage`), Prescription approve/reject (needs `prescriptions.write`)

---

## Scenario 12: TypeScript Verification

**Goal**: Confirm zero TypeScript errors after all `_id` → `id` changes.

```bash
cd admin
npx tsc --noEmit
```

**Expected**: Exit code 0, zero errors output.

```bash
cd backend
npx tsc --noEmit
```

**Expected**: Exit code 0, zero errors output.

---

## Scenario 13: Reports Pages

**Goal**: Confirm sales and orders reports load; patients report loads from renamed path.

1. Navigate to `http://localhost:3002/reports/sales`
2. DevTools: `GET /api/v1/admin/reports/sales` → 200
3. Navigate to `http://localhost:3002/reports/orders`
4. DevTools: `GET /api/v1/admin/reports/orders` → 200
5. Navigate to `http://localhost:3002/reports/patients`
6. DevTools: `GET /api/v1/admin/reports/patients` → 200 (NOT `/customers`)

---

## Pass / Fail Summary

| Scenario | Test | Pass Condition |
|----------|------|----------------|
| S1 | Dashboard metrics | No `/admin/dashboard/metrics` call; live data shows |
| S2 | Orders list + navigation | Path `/admin/orders`; row links use `.id` not `._id` |
| S3 | Order status update | Body uses `{ newStatus }` not `{ status }` |
| S4 | Notifications | Response extracted from `r.data.data.items`; no `/unread-count` |
| S5 | Products list | Path `/catalogue/products/...` |
| S6 | Stub pages | Zero network requests on all 7 stub pages |
| S7 | Roles CRUD | Full create/edit/assign permissions/delete cycle works |
| S8 | Permissions list | Groups by domain; all permissions visible |
| S9 | Users list + navigation | Path `/admin/users`; row links use `.id` |
| S10 | Audit log | Path `/admin/audit`; entries render |
| S11 | Permission guards | Destructive actions hidden without permission |
| S12 | TypeScript clean | `tsc --noEmit` → 0 errors in both `admin/` and `backend/` |
| S13 | Reports pages | Patients at `/reports/patients`; products/coupons stub |

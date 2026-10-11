# Data Model: Admin Panel Audit Pass

**Feature**: specs/012-admin-audit-pass/

---

## Critical: Entity ID Field

All backend entities return `id: string` (PostgreSQL UUID). The admin types must use `id`, not `_id`. This applies to every interface below.

---

## 1. Corrected Admin TypeScript Types

### Core Identity Fields (ALL interfaces)

```typescript
// BEFORE (wrong — MongoDB convention)
interface FooEntity { _id: string; ... }

// AFTER (correct — PostgreSQL / Drizzle)
interface FooEntity { id: string; ... }
```

All of the following interfaces in `admin/src/types/admin.ts` must have `_id` renamed to `id`:

- `AdminUser`
- `AdminRole` (admin panel's RBAC role)
- `AuditLog`
- `AdminOrder`, `OrderItem`
- `AdminBrand`, `AdminProduct`, `AdminCoupon`
- `AdminPrescription`, `AdminCompoundingRequest`
- `AdminAskPharmacist`, `AdminAilmentRequest`
- `VaccineService`, `AppointmentSlot`, `AppointmentBooking`
- `AdminInvoice`, `InvoiceLineItem`, `InvoiceLineItemHistory`
- `PaymentTransaction`, `PaymentAllocation`
- `FAQ`

---

## 2. Backend Response Envelopes (Reference)

### Standard paginated list
```typescript
// Backend returns — always extract r.data.data for rows, r.data.pagination for page info
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Standard single record
```typescript
// Backend returns — extract r.data.data for the entity
interface SingleResponse<T> {
  data: T;
}
```

### Reports response
```typescript
// Same envelope as single record — extract r.data.data
interface ReportResponse<T> {
  data: T;
}
```

### Notifications (special shape)
```typescript
// GET /notifications → extract r.data.data.items for the list
interface NotificationsResponse {
  success: true;
  data: {
    items: AdminNotification[];
    unreadCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}
```

---

## 3. New Backend Route Entities

### Users API (`GET /admin/users`, `GET /admin/users/:id`)

```typescript
interface UserListItem {
  id: string;                  // UUID from users.id
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;           // from facility_users.is_active
  role: { id: string; name: string } | null;  // from facility_users.role_id → facility_roles
  joinedAt: string;            // facility_users.created_at (ISO string)
}

interface UserDetail extends UserListItem {
  emailVerified: boolean;
  isPlatformSuperAdmin: boolean;
  memberships: Array<{
    facilityId: string;
    facilityName: string;
    roleId: string | null;
    roleName: string | null;
    isActive: boolean;
    joinedAt: string;
  }>;
}

// PATCH /admin/users/:id/status — body
interface UpdateUserStatusBody {
  isActive: boolean;
}

// PATCH /admin/users/:id/roles — body
interface AssignUserRoleBody {
  roleId: string;
  facilityId: string;
}
```

### Roles API (`GET /admin/roles`, `POST /admin/roles`, `PATCH /admin/roles/:id`, `DELETE /admin/roles/:id`, `PUT /admin/roles/:id/permissions`)

```typescript
interface RoleListItem {
  id: string;                  // UUID from facility_roles.id
  facilityId: string;
  name: string;
  isSystemRole: boolean;
  permissionCount: number;     // COUNT of facility_role_permissions rows
  createdAt: string;
}

interface RoleDetail extends RoleListItem {
  permissions: string[];       // array of permission.key values
}

// POST /admin/roles — body
interface CreateRoleBody {
  facilityId: string;
  name: string;
}

// PATCH /admin/roles/:id — body
interface UpdateRoleBody {
  name?: string;
}

// PUT /admin/roles/:id/permissions — body
interface SetRolePermissionsBody {
  permissions: string[];       // array of permission key strings
}
```

### Permissions API (`GET /admin/permissions`)

```typescript
interface PermissionItem {
  key: string;                 // e.g. "orders.read", "prescriptions.write"
  name: string;
  description: string | null;
}

// Response shape: { data: PermissionItem[] }
// Grouped by domain prefix for display:
interface PermissionGroup {
  domain: string;              // e.g. "orders", "prescriptions", "healthcare"
  permissions: PermissionItem[];
}
```

### Audit API (`GET /admin/audit`)

```typescript
interface AuditEntry {
  id: number;                  // bigserial — numeric not UUID
  facilityId: string | null;
  actorId: string | null;
  actorType: string | null;    // e.g. "SUPER_ADMIN", "FACILITY_USER"
  action: string;              // e.g. "USER_DEACTIVATED", "ROLE_UPDATED"
  resourceType: string | null; // e.g. "User", "FacilityRole"
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// Query params for GET /admin/audit
interface AuditListParams {
  page?: number;
  limit?: number;
  facilityId?: string;
  action?: string;
  actorId?: string;
  dateFrom?: string;   // ISO date string
  dateTo?: string;     // ISO date string
}
```

---

## 4. Existing API Modules — Corrected Response Extraction

### Orders (`admin/src/api/orders.api.ts`)

```typescript
// GET /admin/orders
// Extract: rows = r.data.data (AdminOrder[]), pagination from r.data.pagination
// PATCH /admin/orders/:id/status — body key is { newStatus } not { status }
// PATCH /admin/orders/:id/notes — PATCH not POST

interface AdminOrderStatusBody {
  newStatus: string;    // was: status — WRONG
  note?: string;
}
```

### Dashboard (`admin/src/api/dashboard.api.ts`)

```typescript
// GET /admin/reports/dashboard  ← was: /admin/dashboard/metrics
// Extract: metrics = r.data.data
```

### Reports (`admin/src/api/reports.api.ts`)

```typescript
// GET /admin/reports/patients  ← was: /admin/reports/customers
// /admin/reports/products — does NOT exist → stub page only
// /admin/reports/coupons — does NOT exist → stub page only
```

### Notifications (`admin/src/api/notifications.api.ts`)

```typescript
// GET /notifications
// Extract list: r.data.data.items  (not r.data.data.data)
// Extract total: r.data.data.pagination.total
// Extract unreadCount: r.data.data.unreadCount  (no separate endpoint)
// REMOVE: GET /notifications/unread-count  ← does NOT exist
```

### Products (`admin/src/api/products.api.ts`)

```typescript
// BASE = "/catalogue/products"  ← was: "/products"
// All admin product routes are under /catalogue/products/...
```

---

## 5. State Transitions (for reference)

### Order status flow (backend `order.types.ts`)
`pending` → `confirmed` → `processing` → `shipped` → `delivered` | `cancelled`

### Prescription status
`pending` → `reviewing` → `approved` | `rejected`

### Compounding status
`pending` → `quote_sent` → `approved` → `compounding` → `ready` | `rejected`

### Appointment status
`pending` → `confirmed` → `completed` | `cancelled` | `no_show`

---

## 6. Validation Rules

### Create Role
- `name`: required, non-empty string, unique per facilityId
- `facilityId`: required, valid UUID — must exist in facilities table

### Update Role
- `name`: optional, non-empty if provided, unique per facilityId
- Cannot modify a role where `isSystemRole === true`

### Delete Role
- Cannot delete if `isSystemRole === true`
- Cannot delete if any `facility_users` row references this `roleId`

### Set Role Permissions
- `permissions`: array of strings, each must be a valid `key` in the `permissions` table
- Invalid keys are rejected with 422 validation error

### Update User Status
- `isActive`: boolean required

### Assign User Role
- `roleId`: valid UUID referencing an existing `facility_roles.id`
- `facilityId`: valid UUID — user must already be a member of this facility

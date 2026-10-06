# Vtech-Med — Multi-Tenant SaaS Platform Architecture (V1 — SUPERSEDED)

**Date:** 2026-10-06
**Status:** SUPERSEDED by `MediSyn_SaaS_Platform_Architecture_V2.md`
**Note:** Platform name is **Vtech-Med**. MediSyn is one facility (tenant) on the platform.

---

## 1. Product Vision

MediSyn is no longer a single pharmacy application. It is a **multi-tenant SaaS platform** that sells pharmacy and healthcare management tooling to facilities (pharmacies, clinics, health networks).

- MediSyn is the **software vendor**
- Each pharmacy / clinic / health network is a **facility (tenant)**
- Facilities are onboarded and configured by the MediSyn **super admin**
- Facilities get an **admin panel** to manage their own operations
- Facilities build their own **patient-facing frontends** using MediSyn's REST API
- Features available to a facility are controlled by their **subscription plan**

---

## 2. Database: PostgreSQL — PROPOSED

### Recommendation: Switch from MongoDB to PostgreSQL

| Need | MongoDB | PostgreSQL |
|---|---|---|
| Multi-tenant isolation | facilityId on every document (manual, trust the developer) | **Row-Level Security (RLS) — DB engine enforces it, impossible to leak** |
| Subscription + plan logic | Complex document nesting | **Relational joins — natural fit** |
| Permission/role tables | Document references, no FK guarantees | **FK constraints, referential integrity enforced** |
| Feature flags per facility | BSON nested docs | **JSONB — same flexibility, plus relational queries** |
| Complex reporting/billing | Aggregation pipelines | **SQL — far simpler analytics queries** |
| Existing project | MongoDB confirmed but not yet built | Drizzle ORM already partially scaffolded in project |

### Why RLS matters for multi-tenancy

PostgreSQL Row-Level Security enforces tenant isolation at the database engine level. Every query is automatically scoped to the current facility — a developer cannot accidentally return another tenant's data.

```sql
-- Set on every request (middleware)
SET LOCAL app.current_facility_id = 'uuid-of-current-facility';

-- RLS policy applied to every table automatically
CREATE POLICY facility_isolation ON orders
  USING (facility_id = current_setting('app.current_facility_id')::uuid);

-- Super admin bypasses RLS
SET LOCAL app.bypass_rls = 'true';
```

**OPEN QUESTION:** PostgreSQL confirmed as the database? This changes the backend stack from MongoDB + Mongoose to PostgreSQL + Drizzle.

---

## 3. Repo Structure (unchanged, monorepo)

```
/ (repo root)
├── frontend/    ← Patient-facing Next.js app (reference implementation)
├── backend/     ← Express.js REST API — multi-tenant, PostgreSQL
├── admin/       ← Admin panel Next.js app — multi-tenant SaaS admin
├── docs/
├── worklog/
├── CLAUDE.md
└── worklog.md
```

All three are independent apps with their own `package.json`. No root-level workspace.

---

## 4. The Four-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PLATFORM LEVEL                                         │
│  Actor: MediSyn super admin                                       │
│  Controls: facilities, subscription plans, modules, billing       │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2 — SUBSCRIPTION LEVEL                                     │
│  Actor: Facility's active plan                                    │
│  Controls: which modules a facility can access + feature flags    │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 3 — FACILITY RBAC LEVEL                                    │
│  Actor: Facility admin assigns roles to staff                     │
│  Controls: what a staff member can DO within accessible modules   │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 4 — ROW LEVEL (RLS)                                        │
│  Actor: PostgreSQL engine                                         │
│  Controls: which DB rows a query can touch (automatic, per tenant)│
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Core Data Model

### 5.1 Platform Modules

Defined once by MediSyn. Seeded into the database. Never changed by a facility.

```sql
platform_modules (
  id          UUID PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,   -- 'ecommerce', 'prescriptions', etc.
  name        TEXT NOT NULL,
  description TEXT,
  is_core     BOOLEAN DEFAULT false,  -- core modules are always on, not sold separately
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

**Core modules** (always enabled, not part of any plan):
- `auth` — authentication, session management
- `dashboard` — facility dashboard, basic metrics
- `users` — staff user management
- `settings` — facility settings, branding, API keys

**Optional modules** (sold via subscription plans):
- `ecommerce` — products, categories, cart, orders, coupons
- `stock_management` — inventory, stock movements, low-stock alerts, expiry tracking
- `prescriptions` — prescription requests, approvals, status history
- `compounding` — compounding requests (separate from prescriptions)
- `appointments` — vaccine services, availability slots, booking
- `ask_pharmacist` — patient Q&A with pharmacist
- `minor_ailments` — minor ailment assessment flows
- `analytics` — sales reports, order reports, patient metrics
- `webhooks` — outbound webhooks + API key management

---

### 5.2 Subscription Plans

```sql
subscription_plans (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,           -- 'Starter', 'Growth', 'Enterprise'
  slug           TEXT UNIQUE NOT NULL,
  price_monthly  NUMERIC(10,2),
  price_yearly   NUMERIC(10,2),
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
)

plan_modules (
  id             UUID PRIMARY KEY,
  plan_id        UUID REFERENCES subscription_plans(id),
  module_id      UUID REFERENCES platform_modules(id),
  feature_flags  JSONB DEFAULT '{}',      -- which features of this module are on
  UNIQUE(plan_id, module_id)
)
```

**Feature flags are plan-level defaults** — they can be overridden per facility (see §5.3).

Example `feature_flags` for ecommerce module:
```jsonc
{
  "coupons": false,
  "guest_checkout": true,
  "bulk_product_import": false,
  "multiple_currencies": false
}
```

---

### 5.3 Facilities (Tenants)

```sql
facilities (
  id                   UUID PRIMARY KEY,
  name                 TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,   -- used in API paths, not subdomains
  type                 TEXT NOT NULL,          -- 'pharmacy' | 'clinic' | 'health_network'
  status               TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'pending'
  subscription_plan_id UUID REFERENCES subscription_plans(id),
  settings             JSONB DEFAULT '{}',     -- branding, business rules, API config
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
)

facility_module_overrides (
  id                    UUID PRIMARY KEY,
  facility_id           UUID REFERENCES facilities(id),
  module_id             UUID REFERENCES platform_modules(id),
  enabled               BOOLEAN NOT NULL,        -- super admin force enable/disable
  feature_flag_overrides JSONB DEFAULT '{}',     -- per-facility feature flag overrides
  UNIQUE(facility_id, module_id)
)
```

**A facility's active modules** = plan's modules + super admin overrides.
**A module's feature flags** = plan's feature_flags merged with facility's feature_flag_overrides.

---

### 5.4 Permission System (RBAC per Facility)

```sql
-- Permissions are seeded by MediSyn per module (never created by facilities)
permissions (
  id           UUID PRIMARY KEY,
  module_slug  TEXT NOT NULL,     -- 'ecommerce'
  action       TEXT NOT NULL,     -- 'create' | 'read' | 'update' | 'delete' | 'approve'
  resource     TEXT NOT NULL,     -- 'product' | 'order' | 'coupon'
  description  TEXT,
  UNIQUE(module_slug, action, resource)
)
-- Example rows:
-- ecommerce, create, product
-- ecommerce, read,   order
-- ecommerce, update, order
-- ecommerce, approve, refund
-- prescriptions, approve, prescription_request
-- prescriptions, read, prescription_request

-- Roles are scoped per facility (facility admin creates custom roles)
facility_roles (
  id          UUID PRIMARY KEY,
  facility_id UUID REFERENCES facilities(id),
  name        TEXT NOT NULL,
  is_system   BOOLEAN DEFAULT false,  -- system roles cannot be deleted
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(facility_id, name)
)
-- System roles auto-created on facility onboarding:
-- owner, pharmacist, manager, staff, viewer

facility_role_permissions (
  role_id       UUID REFERENCES facility_roles(id),
  permission_id UUID REFERENCES permissions(id),
  PRIMARY KEY(role_id, permission_id)
)

-- Users assigned to a facility with a role
facility_users (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  facility_id UUID REFERENCES facilities(id),
  role_id     UUID REFERENCES facility_roles(id),
  status      TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'pending'
  invited_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, facility_id)
)
```

---

### 5.5 Users

```sql
users (
  id               UUID PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,           -- Argon2
  first_name       TEXT,
  last_name        TEXT,
  is_super_admin   BOOLEAN DEFAULT false,
  email_verified   BOOLEAN DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
)

-- A user can belong to multiple facilities (different roles per facility)
-- Resolved via facility_users table
```

---

### 5.6 All Module Tables (shared pattern)

Every table in every module follows the same pattern:

```sql
-- Example: orders table (ecommerce module)
orders (
  id          UUID PRIMARY KEY,
  facility_id UUID REFERENCES facilities(id) NOT NULL,  -- ALWAYS present
  -- ... module-specific columns
  created_at  TIMESTAMPTZ DEFAULT now()
)

-- RLS policy (applied to every facility-scoped table)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_facility_isolation ON orders
  USING (facility_id = current_setting('app.current_facility_id')::uuid);
```

---

## 6. JWT Structure

### Facility user JWT

```jsonc
{
  "sub": "user-uuid",
  "facilityId": "facility-uuid",
  "isSuperAdmin": false,
  "roleId": "role-uuid",
  "permissions": [
    "ecommerce:product:create",
    "ecommerce:order:read",
    "prescriptions:prescription_request:approve"
  ],
  "modules": ["ecommerce", "prescriptions", "stock_management"],
  "exp": 1234567890
}
```

### Super admin JWT

```jsonc
{
  "sub": "user-uuid",
  "facilityId": null,
  "isSuperAdmin": true,
  "exp": 1234567890
}
```

**Permissions are pre-computed at login** — no DB hit on every request for permission checks.
JWT is refreshed when a role or plan changes.

---

## 7. Request Lifecycle (Middleware Chain)

```
Incoming request
  │
  ├── 1. verifyJWT()
  │       → extract userId, facilityId, isSuperAdmin, permissions, modules
  │
  ├── 2. setRLSContext()
  │       → SET LOCAL app.current_facility_id = facilityId
  │       → (super admin: SET LOCAL app.bypass_rls = 'true')
  │
  ├── 3. requireModule('ecommerce')
  │       → check JWT.modules includes 'ecommerce'
  │       → if not: 403 MODULE_NOT_AVAILABLE
  │
  ├── 4. requirePermission('ecommerce:product:create')
  │       → check JWT.permissions includes the required permission
  │       → if not: 403 INSUFFICIENT_PERMISSIONS
  │
  └── 5. Route handler
          → all DB queries automatically scoped by RLS
          → no manual facilityId filters needed in service code
```

---

## 8. Feature Flag System

```typescript
// Usage in any route/service
const flags = await getModuleFlags(facilityId, 'ecommerce')

if (!flags.coupons) {
  throw new ForbiddenError('FEATURE_NOT_AVAILABLE')
}
```

**Resolution order** (last write wins):
```
plan_modules.feature_flags (plan default)
  ↓ merged with
facility_module_overrides.feature_flag_overrides (facility override by super admin)
  = effective flags for this facility
```

Flags are cached per facility per request (set once in middleware, reused in handlers).

---

## 9. Facility Settings (Customization)

All stored in `facilities.settings` JSONB:

```jsonc
{
  "branding": {
    "name": "Greenfield Pharmacy",
    "logo_url": "https://storage.medisyn.ca/facilities/uuid/logo.png",
    "primary_color": "#1677A8",
    "secondary_color": "#F2C14E",
    "favicon_url": null
  },
  "business_rules": {
    "appointment_duration_minutes": 30,
    "cancellation_notice_hours": 24,
    "max_daily_appointments": 50,
    "timezone": "America/Toronto"
  },
  "api": {
    "allowed_origins": ["https://greenfieldpharmacy.com"],
    "webhook_url": "https://greenfieldpharmacy.com/api/webhooks/medisyn",
    "webhook_secret": "hashed"
  },
  "locale": {
    "currency": "CAD",
    "province": "ON",
    "language": "en"
  }
}
```

Module-specific configurable data (e.g. which minor ailments a facility offers) lives in dedicated tables with `facility_id` — not in the settings blob.

---

## 10. API Keys (Facility Frontend Access)

Facilities build their own patient-facing frontends. They authenticate against MediSyn's API using:

```sql
facility_api_keys (
  id          UUID PRIMARY KEY,
  facility_id UUID REFERENCES facilities(id),
  name        TEXT NOT NULL,          -- 'Production Frontend', 'Mobile App'
  key_prefix  TEXT NOT NULL,          -- first 8 chars, shown in UI
  key_hash    TEXT NOT NULL,          -- Argon2 hash of full key
  scopes      TEXT[] NOT NULL,        -- ['ecommerce:read', 'prescriptions:create']
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

- Full key shown **once** at creation — never stored plaintext
- API key requests go through the same module + permission middleware
- Rate limits enforced per plan tier (e.g. Starter: 1000 req/day, Enterprise: unlimited)
- CORS: backend only accepts requests from origins listed in `facility.settings.api.allowed_origins`

---

## 11. Subscription Plans — Example Tiers

| Feature | Starter | Growth | Enterprise |
|---|:---:|:---:|:---:|
| Core (auth, dashboard, users, settings) | ✓ | ✓ | ✓ |
| Prescriptions | ✓ | ✓ | ✓ |
| Ask Pharmacist | ✓ | ✓ | ✓ |
| Minor Ailments | — | ✓ | ✓ |
| Appointments | — | ✓ | ✓ |
| Ecommerce | — | ✓ | ✓ |
| Stock Management | — | ✓ | ✓ |
| Compounding | — | — | ✓ |
| Analytics (basic) | — | ✓ | ✓ |
| Analytics (full + exports) | — | — | ✓ |
| Webhooks + API Keys | — | — | ✓ |
| Coupons | — | — | ✓ |
| Bulk product import | — | — | ✓ |
| Custom branding (full) | logo only | logo + colors | full |
| Staff seats | 5 | 20 | unlimited |
| API rate limit | 1,000/day | 10,000/day | unlimited |

Plans are **data in the database**, not hardcoded — super admin modifies them without a deploy.

---

## 12. Backend Module Folder Structure

```
backend/src/
├── core/
│   ├── auth/              ← JWT, login, register, password reset
│   ├── users/             ← user CRUD
│   ├── facilities/        ← facility onboarding, settings, API keys
│   ├── plans/             ← subscription plans, plan_modules
│   ├── modules/           ← platform_modules registry
│   ├── rbac/              ← roles, permissions, role_permissions
│   └── middleware/        ← verifyJWT, setRLS, requireModule, requirePermission
│
├── modules/
│   ├── ecommerce/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── coupons/
│   │   └── permissions.seed.ts
│   ├── stock_management/
│   │   ├── inventory/
│   │   ├── movements/
│   │   ├── alerts/
│   │   └── permissions.seed.ts
│   ├── prescriptions/
│   ├── compounding/
│   ├── appointments/
│   ├── ask_pharmacist/
│   ├── minor_ailments/
│   ├── analytics/
│   └── webhooks/
│
├── db/
│   ├── schema/            ← Drizzle schema (one file per module)
│   ├── migrations/
│   └── rls-policies/      ← SQL files for RLS policies per table
│
├── lib/
│   ├── feature-flags.ts   ← getModuleFlags() helper
│   ├── mailer.ts
│   ├── storage.ts         ← S3-compatible file storage
│   └── queue.ts           ← BullMQ
│
└── app.ts
```

---

## 13. Admin Panel Structure (Multi-Tenant)

Single app at `admin.medisyn.ca`. Login determines which view you get.

### Super Admin View
```
/super-admin/
├── facilities/            ← list, onboard, suspend, view details
├── plans/                 ← manage plans, modules, feature flags per plan
├── modules/               ← view platform module registry
├── settings/              ← platform-wide settings
└── audit-log/             ← cross-facility audit log
```

### Facility Admin View
```
/dashboard/                ← facility-scoped dashboard
/staff/                    ← invite, assign roles, suspend
/roles/                    ← create roles, assign permissions
/settings/                 ← branding, business rules, API keys
/subscription/             ← current plan, upgrade request

-- Module tabs (only visible if facility has the module):
/ecommerce/products/
/ecommerce/orders/
/ecommerce/coupons/
/prescriptions/
/compounding/
/appointments/
/stock/
/analytics/
```

Navigation is **dynamically built from JWT.modules** — modules not in the plan are not rendered.

---

## 14. Phase Plan

| Phase | Focus | Key Deliverables |
|---|---|---|
| **1** | Foundation + DB | PostgreSQL setup, Drizzle schema (core tables), RLS policy framework, Express scaffold, facilityId isolation proven end-to-end |
| **2** | Auth + Users | JWT (super admin + facility user), login, register, email verify, password reset, facility_users |
| **3** | Platform + Plans | platform_modules seed, subscription_plans CRUD, plan_modules, facility onboarding by super admin |
| **4** | RBAC | permissions seed per module, facility_roles, role_permissions, permission middleware, JWT permission embedding |
| **5** | Feature Flags | getModuleFlags() helper, flag resolution (plan → override), requireModule middleware, requireFeatureFlag middleware |
| **6** | Super Admin Panel | Facility management UI, plan management UI, module toggle, feature flag overrides UI |
| **7** | Facility Admin Shell | Multi-tenant admin panel shell, module-gated navigation, staff management, role assignment UI |
| **8** | Ecommerce Module | Products, categories, cart, orders, coupons — all facility-scoped, feature-flagged |
| **9** | Stock Management Module | Inventory, stock movements, low-stock alerts, expiry tracking |
| **10** | Healthcare Modules | Prescriptions, compounding, ask-pharmacist, minor ailments, appointments |
| **11** | Analytics Module | Sales, orders, patients — per facility, date range filters |
| **12** | Customization + API Keys | Branding config, API key management, CORS per facility, webhooks |
| **13** | Subscription UI | Plan display, upgrade request, billing history (payment gateway TBD) |
| **14** | Hardening | Rate limiting per plan tier, security audit, RLS policy tests, OpenAPI docs, integration tests |

---

## 15. Open Questions (Must Confirm Before Phase 1)

| # | Question | Status |
|---|---|---|
| 1 | **PostgreSQL confirmed** as the database (replacing MongoDB)? | OPEN |
| 2 | **Drizzle ORM** confirmed (already partially in project)? | OPEN |
| 3 | Existing admin/ codebase — **refactor** into multi-tenant or **rebuild fresh**? | OPEN |
| 4 | Self-serve plan upgrades in admin panel, or **super admin assigns plans manually** for now? | OPEN |
| 5 | A user can belong to **multiple facilities** (e.g. a pharmacist contracted to two pharmacies)? | OPEN |
| 6 | Payment gateway for subscription billing — **out of scope for MVP**? | OPEN |
| 7 | Does the existing `frontend/` (medisyn.ca) remain as a **reference implementation** or get deprecated? | OPEN |

---

## 16. Confirmed Decisions (as of 2026-10-06)

| Decision | Status |
|---|---|
| MediSyn is a SaaS platform — pharmacies/clinics are tenants ("facilities") | CONFIRMED |
| Shared DB with facilityId on every table (not separate DBs per tenant) | CONFIRMED |
| No subdomain per facility — single admin panel URL, tenant resolved by JWT | CONFIRMED |
| Facility type is flexible: pharmacy, clinic, or health network | CONFIRMED |
| MediSyn is purely the SaaS vendor — not operating its own pharmacy tenant | CONFIRMED |
| Facilities build their own patient-facing frontends using MediSyn's API | CONFIRMED |
| Modules are enabled/disabled per facility based on subscription plan | CONFIRMED |
| Feature flags within a module are controlled by plan + per-facility overrides | CONFIRMED |
| Permissions are pre-computed into JWT at login | CONFIRMED |
| Plans are data in DB — super admin can modify without a deploy | CONFIRMED |
| Monorepo: frontend/, backend/, admin/ — all independent apps | CONFIRMED |

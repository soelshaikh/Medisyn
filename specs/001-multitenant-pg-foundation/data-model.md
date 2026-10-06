# Data Model: Multi-Tenant Platform Foundation

**Feature**: `001-multitenant-pg-foundation` | **Date**: 2026-10-06

All tables are in the `public` schema unless noted. `UUID` type uses
`gen_random_uuid()` as default. `TIMESTAMPTZ` columns default to `now()`.
`facility_id` FK references `facilities.id` on all facility-scoped tables.

---

## Table Legend

| Symbol | Meaning |
|---|---|
| 🔑 | Primary key |
| 🔒 | RLS enforced (app_user sees own facility only) |
| 👑 | Platform-global table (no RLS, no facility_id) |
| 🔒→👑 | Controlled by app_super_admin only via BYPASSRLS |

---

## 1. facilities 👑

Platform-level tenant registry. One row per pharmacy/clinic/health network.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | Tenant identifier |
| name | TEXT | NOT NULL | Display name (e.g. "MediSyn Pharmacy") |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe identifier (e.g. "medisyn") |
| status | TEXT | NOT NULL, DEFAULT 'active' | `active` \| `suspended` \| `deactivated` |
| subscription_plan_id | UUID | FK → subscription_plans.id, NOT NULL | Active plan |
| settings | JSONB | NOT NULL, DEFAULT '{}' | Per-facility configuration overrides |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Indexes**: `slug` (UNIQUE), `subscription_plan_id`, `status`

**RLS**: None — table is platform-global. Only accessible via `app_super_admin` pool or
after authentication establishes `facilityId` in the request context.

**State transitions**: `active → suspended` (by super admin), `suspended → active`,
`active → deactivated` (terminal — cannot be reactivated via API).

---

## 2. users 👑

All platform users: facility staff, patients, and super admins. Not facility-scoped at
the table level — a user's facility association lives in `facility_users`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | User identifier |
| email | TEXT | NOT NULL, UNIQUE | Login identifier |
| password_hash | TEXT | NOT NULL | Argon2id hash |
| first_name | TEXT | NOT NULL | |
| last_name | TEXT | NOT NULL | |
| is_platform_super_admin | BOOLEAN | NOT NULL, DEFAULT false | Platform-level super admin flag |
| auth_version | INTEGER | NOT NULL, DEFAULT 1 | Incremented on role/permission change |
| email_verified | BOOLEAN | NOT NULL, DEFAULT false | |
| email_verify_token | TEXT | NULLABLE | One-time email verification token |
| email_verify_expires_at | TIMESTAMPTZ | NULLABLE | |
| password_reset_token | TEXT | NULLABLE | |
| password_reset_expires_at | TIMESTAMPTZ | NULLABLE | |
| last_login_at | TIMESTAMPTZ | NULLABLE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Indexes**: `email` (UNIQUE), `is_platform_super_admin` (partial where true)

**Note**: `auth_version` is the source of truth for permission staleness detection.
When a role, permission, or facility status changes, `auth_version` is incremented.
JWT claims carry `authVersion` at time of issuance. Middleware verifies JWT `authVersion`
matches the current DB value (via Redis 60s cache → DB fallback).

---

## 3. sessions 🔒

One row per active login (JWT refresh token binding). Revocation is the authoritative
source — Redis `revoked_session:{id}` is a fast-path cache only.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | Session identifier (embedded in JWT) |
| user_id | UUID | NOT NULL, FK → users.id ON DELETE CASCADE | |
| facility_id | UUID | NULLABLE, FK → facilities.id | NULL for super admin sessions |
| refresh_token_hash | TEXT | NOT NULL | Argon2id hash of refresh token |
| user_agent | TEXT | NULLABLE | Browser/client identifier |
| ip_address | TEXT | NULLABLE | Last known IP |
| revoked_at | TIMESTAMPTZ | NULLABLE | Non-null = revoked |
| revoked_reason | TEXT | NULLABLE | `user_logout` \| `admin_revoked` \| `facility_suspended` \| `password_changed` |
| expires_at | TIMESTAMPTZ | NOT NULL | Refresh token hard expiry |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| last_used_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Updated on every token refresh |

**Indexes**: `user_id`, `facility_id`, `revoked_at` (partial where null), composite
`(user_id, revoked_at)` for revokeAllUserSessions queries

**RLS**: `app_user` can SELECT own facility's sessions only.

---

## 4. platform_modules 👑

Catalog of all modules the platform supports. Rows are seeded and managed by super admins,
not created by facilities.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| key | TEXT | NOT NULL, UNIQUE | Slug used in code: `ecommerce`, `prescriptions`, etc. |
| name | TEXT | NOT NULL | Display name |
| description | TEXT | NULLABLE | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | False = module removed from platform |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Seed data** (minimum for Phase 1):
- `prescriptions` — Prescription request management
- `compounding` — Compounding request management
- `ecommerce` — Product catalogue + orders
- `appointments` — Appointment booking
- `ask_pharmacist` — Async pharmacist consultation
- `minor_ailments` — Minor ailment assessment
- `stock_management` — Inventory tracking

---

## 5. subscription_plans 👑

Plan definitions (e.g., Starter, Growth, Enterprise). Assigned to `facilities`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| key | TEXT | NOT NULL, UNIQUE | `starter` \| `growth` \| `enterprise` |
| name | TEXT | NOT NULL | Display name |
| description | TEXT | NULLABLE | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Inactive plans cannot be newly assigned |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

---

## 6. plan_modules 👑

Many-to-many: which modules are included in which plan.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| plan_id | UUID | NOT NULL, FK → subscription_plans.id | |
| module_id | UUID | NOT NULL, FK → platform_modules.id | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(plan_id, module_id)`

---

## 7. plan_entitlements 👑

Quantitative limits bundled with a plan (seats, API quota, storage GB, etc.).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| plan_id | UUID | NOT NULL, FK → subscription_plans.id | |
| resource_key | TEXT | NOT NULL | `staff_seats`, `api_requests_per_day`, `storage_gb` |
| limit_value | INTEGER | NOT NULL | -1 = unlimited |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(plan_id, resource_key)`

---

## 8. facility_module_overrides 🔒→👑

Super admin can add or remove modules for a specific facility, overriding plan defaults.
Written only by super admins (BYPASSRLS pool); read by the auth middleware chain.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | |
| module_id | UUID | NOT NULL, FK → platform_modules.id | |
| enabled | BOOLEAN | NOT NULL | true = force-add; false = force-remove |
| reason | TEXT | NULLABLE | Admin note |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| created_by | UUID | NOT NULL, FK → users.id | Super admin who set this |

**Unique**: `(facility_id, module_id)`

---

## 9. facility_entitlement_overrides 🔒→👑

Per-facility override of a plan's quantitative limit for a specific resource.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | |
| resource_key | TEXT | NOT NULL | Must match a known `plan_entitlements.resource_key` |
| limit_value | INTEGER | NOT NULL | -1 = unlimited |
| reason | TEXT | NULLABLE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| created_by | UUID | NOT NULL, FK → users.id | |

**Unique**: `(facility_id, resource_key)`

---

## 10. facility_usage_records 🔒

Current usage counters per facility per resource. Updated transactionally when bounded
resources are consumed (e.g., seat added, API call made).

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | |
| resource_key | TEXT | NOT NULL | |
| current_usage | INTEGER | NOT NULL, DEFAULT 0 | |
| period_start | DATE | NULLABLE | For time-windowed resources (e.g., API calls per day) |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(facility_id, resource_key, period_start)`

**RLS**: `app_user` can SELECT own facility's records; INSERT/UPDATE via service functions only.

---

## 11. permissions 👑

Atomic authorization units. Seeded from platform module definitions. One row per allowed
action on one resource within one module.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| module_id | UUID | NULLABLE, FK → platform_modules.id | NULL = platform-level permission |
| key | TEXT | NOT NULL, UNIQUE | `prescriptions:read`, `ecommerce:orders:cancel`, etc. |
| name | TEXT | NOT NULL | Display name |
| description | TEXT | NULLABLE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Naming convention**: `{module_key}:{resource}:{action}` or `{module_key}:{action}`

---

## 12. facility_roles 🔒

Named collections of permissions scoped to one facility. System roles are pre-seeded per
facility; facilities can define custom roles.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | |
| name | TEXT | NOT NULL | `pharmacist`, `staff`, `admin`, `patient`, etc. |
| is_system_role | BOOLEAN | NOT NULL, DEFAULT false | System roles cannot be deleted |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(facility_id, name)`

**RLS**: `app_user` can SELECT and manage own facility's roles.

---

## 13. facility_role_permissions 🔒

Many-to-many: which permissions belong to which facility role.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | Denormalised for RLS policy simplicity |
| role_id | UUID | NOT NULL, FK → facility_roles.id | |
| permission_id | UUID | NOT NULL, FK → permissions.id | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(role_id, permission_id)`

**RLS**: `app_user` can SELECT own facility's role-permission mappings.

---

## 14. facility_users 🔒

Many-to-many: user ↔ facility membership, with a role assignment per pair. A patient is
a row here with `role` pointing to the `patient` system role.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | |
| user_id | UUID | NOT NULL, FK → users.id | |
| role_id | UUID | NOT NULL, FK → facility_roles.id | |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | false = suspended within this facility |
| joined_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(facility_id, user_id)` — one role per user per facility

**RLS**: `app_user` can SELECT own facility's membership records.

---

## 15. audit_log 🔒

Append-only record of all security-sensitive operations. REVOKE UPDATE/DELETE from all
roles at the database level.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | BIGSERIAL | 🔑 PK, NOT NULL | Monotonic for ordering |
| facility_id | UUID | NULLABLE, FK → facilities.id | NULL for platform-level events |
| actor_id | UUID | NULLABLE, FK → users.id | NULL for system events |
| actor_type | TEXT | NOT NULL | `user` \| `system` \| `api_key` |
| action | TEXT | NOT NULL | `auth.login`, `session.revoke`, `rbac.role_change`, etc. |
| resource_type | TEXT | NULLABLE | `prescription`, `user`, `facility`, etc. |
| resource_id | TEXT | NULLABLE | ID of the affected resource |
| metadata | JSONB | NOT NULL, DEFAULT '{}' | Event-specific details (never raw PHI) |
| ip_address | TEXT | NULLABLE | |
| user_agent | TEXT | NULLABLE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**RLS**: `app_user` can SELECT and INSERT for own facility_id only. `app_super_admin`
bypasses RLS. REVOKE UPDATE, DELETE from both roles.

**Indexes**: `facility_id`, `actor_id`, `action`, `created_at DESC` (composite for
audit log queries), `resource_type + resource_id` (for resource-specific audit trails)

---

## 16. patient_profiles 🔒

Extended patient information stored separately from `users` for PHI isolation. Links to
`users.id` for auth; `facility_id` for RLS.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | 🔑 PK, NOT NULL | |
| facility_id | UUID | NOT NULL, FK → facilities.id | |
| user_id | UUID | NOT NULL, FK → users.id | |
| date_of_birth | DATE | NULLABLE | |
| health_card_number_encrypted | TEXT | NULLABLE | AES-256-GCM ciphertext |
| health_card_province | TEXT | NULLABLE | 2-letter province code |
| phone | TEXT | NULLABLE | |
| address_line1 | TEXT | NULLABLE | |
| address_line2 | TEXT | NULLABLE | |
| city | TEXT | NULLABLE | |
| province | TEXT | NULLABLE | |
| postal_code | TEXT | NULLABLE | |
| allergies | TEXT | NULLABLE | Free text — may contain PHI |
| medical_notes | TEXT | NULLABLE | Free text — PHI; admin-visible only |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Unique**: `(facility_id, user_id)`

**RLS**: `app_user` can SELECT own facility's patient profiles.

**PHI note**: `health_card_number_encrypted` stores AES-256-GCM ciphertext. Application
layer encrypts/decrypts. DB cannot decrypt. PHI access MUST be logged in `audit_log`.

---

## Entity Relationships

```
subscription_plans ──< plan_modules >── platform_modules
        │                                       │
        ↓                                       ↓
   facilities ────────────────────── facility_module_overrides
        │                            facility_entitlement_overrides
        │                            facility_usage_records
        │
        ├──< facility_roles >── facility_role_permissions >── permissions
        │
        ├──< facility_users >── users
        │         │
        │         └──< sessions
        │
        ├──< patient_profiles >── users
        │
        └──< audit_log
```

---

## Facility-Scoped Tables (RLS Required)

The following tables MUST have `ENABLE ROW LEVEL SECURITY` and a SELECT policy using
`current_facility_id()`. The automated schema test in `tests/isolation/rls-coverage.test.ts`
verifies this list is complete.

1. `sessions`
2. `facility_module_overrides`
3. `facility_entitlement_overrides`
4. `facility_usage_records`
5. `facility_roles`
6. `facility_role_permissions`
7. `facility_users`
8. `audit_log` (special: also REVOKE UPDATE/DELETE)
9. `patient_profiles`

**Platform-global tables** (no RLS, no `facility_id`):
- `facilities`, `users`, `platform_modules`, `subscription_plans`, `plan_modules`,
  `plan_entitlements`, `permissions`

---

## Validation Rules (from spec requirements)

- `facilities.status` — must be one of: `active`, `suspended`, `deactivated`
- `sessions.facility_id` — may be NULL only when `users.is_platform_super_admin = true`
- `facility_users` — one role per user per facility (UNIQUE constraint)
- `audit_log.id` — BIGSERIAL; no UPDATE/DELETE at DB level
- `health_card_number_encrypted` — stored only as ciphertext; never plaintext in DB
- `permissions.key` — format: `{module}:{resource}:{action}` enforced in application layer
- `facility_roles` — system roles (`is_system_role = true`) cannot be deleted via API

---

## State Transitions

### facilities.status
```
active ──→ suspended (super admin; all facility sessions revoked)
suspended ──→ active (super admin)
active ──→ deactivated (super admin; terminal)
```

### sessions.revoked_at
```
NULL (active)
  ──→ TIMESTAMPTZ set (revoked)
       revoked_reason: user_logout | admin_revoked | facility_suspended | password_changed
```
Revocation is one-way. A revoked session cannot be reactivated.

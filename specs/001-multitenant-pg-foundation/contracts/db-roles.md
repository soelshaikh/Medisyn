# Contract: PostgreSQL Roles and Connection Pools

**Feature**: `001-multitenant-pg-foundation`

This document defines the two-role, two-pool database access model.

---

## Two PostgreSQL Roles

### Role 1: app_user

**Purpose**: All regular application requests — facility staff, patients, super admins
running facility-scoped queries.

**Attributes**: RLS enforced (no BYPASSRLS). Cannot DROP or ALTER tables.

**Granted**: SELECT, INSERT, UPDATE, DELETE on all application tables EXCEPT:
- `audit_log` — REVOKE UPDATE, DELETE (append-only)
- No access to system catalogs

**RLS behaviour**: Every query against a facility-scoped table is filtered by the
`tenant_isolation` RLS policy. A query that reaches a facility-scoped table without
tenant context set causes `current_facility_id()` to raise an exception.

### Role 2: app_super_admin

**Purpose**: Cross-facility operations — super admin panel queries, system maintenance,
bulk reads across tenants.

**Attributes**: `BYPASSRLS` — RLS policies are not evaluated for this role. Cannot DROP
or ALTER tables.

**Granted**: SELECT, INSERT, UPDATE, DELETE on all application tables EXCEPT:
- `audit_log` — REVOKE UPDATE, DELETE (append-only — applies even to super admin)

**Usage restriction**: The `app_super_admin` connection pool (`superAdminDb`) is
importable ONLY from `src/core/super-admin/`. This restriction is enforced by ESLint.

---

## Two Connection Pools

### Pool 1: db (app_user pool)

- Connects as: `app_user`
- Used in: `withTenantContext()` and all regular request handling
- PgBouncer mode: transaction
- Min/max connections: configurable via environment; suggestion: min=2, max=10 per process
- Connection string env var: `DATABASE_URL`

### Pool 2: superAdminDb (app_super_admin pool)

- Connects as: `app_super_admin`
- Used in: `superAdminQuery()` inside `src/core/super-admin/` only
- PgBouncer mode: transaction
- Min/max connections: lower (super admin operations are infrequent); suggestion: min=1, max=3
- Connection string env var: `DATABASE_SUPER_ADMIN_URL`

---

## ESLint Import Restriction

The ESLint rule blocks any import of `superAdminDb` from outside `src/core/super-admin/`:

```json
{
  "no-restricted-imports": [
    "error",
    {
      "paths": [
        {
          "name": "@/db",
          "importNames": ["superAdminDb"],
          "message": "superAdminDb may only be imported from src/core/super-admin/"
        }
      ]
    }
  ]
}
```

This rule MUST run in CI on every PR. A failing lint check blocks merge.

---

## PgBouncer Transaction Mode Compatibility

PgBouncer in transaction mode assigns a backend PostgreSQL connection for the duration of
one transaction, then returns it to the pool. This means:

- Session-level configuration (`SET config_param = value` or `set_config(key, value, false)`)
  persists on the connection after the transaction ends and may be seen by the next request
  that is assigned the same connection.
- Transaction-level configuration (`SET LOCAL` or `set_config(key, value, true)`) is cleared
  at transaction end.

**Required**: ALL tenant context setting MUST use `set_config('app.current_facility_id', value, true)`.

**Prohibited**: `SET SESSION app.current_facility_id = '...'`, `set_config(key, value, false)`,
any session-level configuration of `app.current_facility_id`.

---

## DB Role Creation Script (DDL)

The following DDL is run once during database setup. It is NOT part of Drizzle migrations
(which run as a privileged role), but is documented here as the canonical definition.

```sql
-- Create roles
CREATE ROLE app_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE app_super_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;

-- Create login roles that inherit from the above
CREATE ROLE app_user_login LOGIN PASSWORD '...' INHERIT;
GRANT app_user TO app_user_login;

CREATE ROLE app_super_admin_login LOGIN PASSWORD '...' INHERIT;
GRANT app_super_admin TO app_super_admin_login;

-- Revoke public schema defaults
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_user, app_super_admin;

-- Grant table permissions after migrations (run by migration script)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_super_admin;
REVOKE UPDATE, DELETE ON audit_log FROM app_user, app_super_admin;

-- Ensure future tables also get grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_super_admin;
```

---

## Security Properties

| Property | Guaranteed by |
|---|---|
| Facility A cannot read Facility B's data | PostgreSQL RLS on `app_user` role |
| A missing `withTenantContext()` call causes an error | `current_facility_id()` raises exception |
| Super admin operations cannot bypass audit log | REVOKE DELETE/UPDATE on `audit_log` for `app_super_admin` |
| Super admin pool is never used from feature modules | ESLint import restriction (CI enforced) |
| Tenant context does not leak across PgBouncer connections | `set_config(..., true)` is transaction-local |

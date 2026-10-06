# Quickstart Validation Guide: Multi-Tenant Platform Foundation

**Feature**: `001-multitenant-pg-foundation`

This guide walks through validating that the Phase 1 implementation is correct. It covers
local environment setup, running the automated isolation tests, and verifying the Phase 1
acceptance criteria from Architecture V2.1 §18 are all green.

---

## Prerequisites

| Tool | Minimum Version | Why |
|---|---|---|
| Node.js | 22.x LTS | Runtime |
| Docker Desktop | 4.x | PostgreSQL + Redis containers |
| pnpm (or npm) | 9.x | Package manager |
| psql | 16.x | Schema inspection + manual queries |

**Install backend dependencies** (from `backend/`):
```bash
cd backend
npm install
```

---

## 1. Start Infrastructure

From the repository root:

```bash
cd backend
docker compose up -d
```

This starts:
- **PostgreSQL 16** on port 5432 (default credentials in `docker-compose.yml`)
- **Redis 7** on port 6379

Wait for both containers to be healthy:
```bash
docker compose ps
```
Both should show `(healthy)`.

---

## 2. Create PostgreSQL Roles

Run the role creation script (once per fresh database):

```bash
psql $DATABASE_ADMIN_URL -f scripts/create-roles.sql
```

This creates `app_user` and `app_super_admin` roles. See
[contracts/db-roles.md](./contracts/db-roles.md) for the DDL.

---

## 3. Run Database Migrations

```bash
npm run db:migrate
```

This runs all Drizzle migrations in `src/db/migrations/`. Verify the output shows all
migrations applied with no errors.

---

## 4. Apply RLS Policies

```bash
psql $DATABASE_URL -f src/db/rls/current-facility-id.sql
psql $DATABASE_URL -f src/db/rls/policies.sql
```

Verify the `current_facility_id()` function was created:
```bash
psql $DATABASE_URL -c "SELECT current_facility_id();"
```
**Expected**: An exception: `tenant context not set: app.current_facility_id is missing`
This confirms fail-closed behaviour.

---

## 5. Grant Table Permissions

```bash
psql $DATABASE_ADMIN_URL -f scripts/grant-permissions.sql
```

Verify `audit_log` permissions are correct:
```bash
psql $DATABASE_ADMIN_URL -c "\dp audit_log"
```
**Expected**: `app_user` and `app_super_admin` have SELECT and INSERT only — no UPDATE, DELETE.

---

## 6. Seed Platform Data

```bash
npm run db:seed
```

This seeds `platform_modules` (7 modules) and `permissions`. Verify:
```bash
psql $DATABASE_URL -c "SELECT key FROM platform_modules ORDER BY key;"
```
**Expected**: 7 rows (`ask_pharmacist`, `appointments`, `compounding`, `ecommerce`,
`minor_ailments`, `prescriptions`, `stock_management`).

---

## 7. Run Automated Tests

### RLS Coverage Test

Verifies every facility-scoped table has `ENABLE ROW LEVEL SECURITY` and a policy:

```bash
npm run test -- tests/isolation/rls-coverage.test.ts
```

**Expected**: All tables in the facility-scoped list pass. Zero failures.

**What it checks** (from [data-model.md](./data-model.md#facility-scoped-tables-rls-required)):
- `sessions`, `facility_module_overrides`, `facility_entitlement_overrides`,
  `facility_usage_records`, `facility_roles`, `facility_role_permissions`,
  `facility_users`, `audit_log`, `patient_profiles`

### Cross-Tenant Isolation Tests

Runs all Phase 1 acceptance criteria tests:

```bash
npm run test -- tests/isolation/cross-tenant.test.ts
```

**Expected**: All tests pass. Zero failures.

These tests correspond to the Phase 1 gate criteria from Architecture V2.1 §18:

| Test ID | Description |
|---|---|
| ISO-001 | Facility A reads only Facility A's rows from all scoped tables |
| ISO-002 | Facility A update on Facility B's row ID → 0 rows affected |
| ISO-003 | Facility A delete on Facility B's row ID → 0 rows affected |
| ISO-004 | Missing tenant context → exception raised (not empty rows) |
| ISO-005 | Invalid UUID tenant context → exception raised |
| ISO-006 | super admin (BYPASSRLS) can read both facilities' rows |
| ISO-007 | withTenantContext sets context before fn executes |
| ISO-008 | withTenantContext context is cleared after transaction commits |
| ISO-009 | withTenantContext context is cleared after transaction rolls back |
| ISO-010 | Two concurrent requests with different facilityIds don't cross-contaminate |
| REV-001 | Revoked session → 401 (Redis cache hit) |
| REV-002 | Revoked session → 401 (DB fallback, Redis unavailable) |
| REV-003 | Valid (non-revoked) session → passes step 2 |
| REV-004 | revokeAllUserSessions marks all user's sessions as revoked |
| REV-005 | revokeAllFacilitySessions marks all facility's sessions as revoked |
| REV-006 | Redis + DB both unavailable → 503 (not 200 or 401) |
| AUX-001 | audit_log INSERT succeeds as app_user |
| AUX-002 | audit_log UPDATE fails as app_user (permission denied) |
| AUX-003 | audit_log DELETE fails as app_user (permission denied) |
| AUX-004 | audit_log UPDATE fails as app_super_admin (permission denied) |

### Full Test Suite

```bash
npm run test
```

**Expected**: All tests pass. The overall pass/fail is the Phase 1 gate signal.

---

## 8. Manual Smoke Checks

### Verify tenant context fail-closed

Open a psql session as `app_user_login` and attempt a query without context:

```sql
-- This should raise: tenant context not set
SET ROLE app_user;
SELECT * FROM facility_users;
```

**Expected**: `ERROR: tenant context not set: app.current_facility_id is missing`

### Verify cross-tenant isolation via psql

```sql
-- Set context to Facility A's ID
SELECT set_config('app.current_facility_id', '<facility_a_uuid>', true);
-- Query sessions — should only return Facility A's sessions
SELECT id, facility_id FROM sessions;
```

**Expected**: Only rows where `facility_id = <facility_a_uuid>`.

### Verify audit_log is append-only

```sql
-- As app_user_login
UPDATE audit_log SET metadata = '{}'::jsonb WHERE id = 1;
```

**Expected**: `ERROR: permission denied for table audit_log`

---

## 9. Phase 1 Gate Checklist

Before moving to Phase 2, confirm:

- [ ] `npm run test` exits with code 0 — all tests green
- [ ] `rls-coverage.test.ts` — all 9 facility-scoped tables have RLS + policy
- [ ] `cross-tenant.test.ts` — all 20 isolation/session/audit tests pass (ISO + REV + AUX)
- [ ] ESLint passes: `npm run lint` — `superAdminDb` import restriction verified
- [ ] TypeScript compiles: `npm run typecheck` — zero errors
- [ ] Manual smoke: `current_facility_id()` raises without context
- [ ] Manual smoke: audit_log UPDATE/DELETE rejected for both roles

When all items are checked, Phase 2 may begin.

---

## References

- [data-model.md](./data-model.md) — full entity schema with fields and relationships
- [contracts/middleware-chain.md](./contracts/middleware-chain.md) — middleware step contracts
- [contracts/tenant-context.md](./contracts/tenant-context.md) — `withTenantContext()` contract
- [contracts/db-roles.md](./contracts/db-roles.md) — PostgreSQL roles and pool contracts
- [Architecture V2.1](../../docs/MediSyn_SaaS_Platform_Architecture_V2.md) — §18 acceptance criteria

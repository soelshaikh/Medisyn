# Contract: withTenantContext()

**Feature**: `001-multitenant-pg-foundation`

This document defines the contract for `withTenantContext()` — the single canonical
wrapper for all facility-scoped database operations.

---

## Function Signature

```typescript
async function withTenantContext<T>(
  facilityId: string,
  fn: (tx: TenantTransaction) => Promise<T>
): Promise<T>
```

`TenantTransaction` is a Drizzle transaction object. Its exact type is an implementation
detail; the contract is that it supports all Drizzle query methods.

---

## Behaviour Contract

1. **Opens a Drizzle transaction** against the `app_user` connection pool.

2. **Sets tenant context as the first statement** in the transaction:
   ```sql
   SELECT set_config('app.current_facility_id', $1, true)
   ```
   The third argument `true` scopes the setting to the current transaction only.
   This is always the first statement — `fn` never executes before context is set.

3. **Invokes `fn(tx)`** with the transaction object.

4. **Commits** the transaction if `fn` resolves.

5. **Rolls back** the transaction if `fn` throws. The error is re-thrown to the caller.

6. **Clears tenant context** when the transaction ends (commit or rollback), because
   `set_config(..., true)` is transaction-scoped by definition.

---

## Invariants

- `fn` MUST NOT import or use the module-level `db` or `superAdminDb` directly.
  It receives `tx` as its only DB access path.
- `facilityId` MUST be a valid UUID string. Passing an empty string, null, or undefined
  will cause the `current_facility_id()` PostgreSQL function to raise an exception.
- `withTenantContext` MUST NOT be called inside another `withTenantContext` call with the
  same or a different `facilityId`. Nested transactions use savepoints — the inner
  `set_config` call with `true` applies to the inner transaction (savepoint), and when
  the savepoint is released or rolled back, the outer transaction may lose tenant context.
  **One `withTenantContext` per request handler.** If multiple resources need updating,
  do them all within the single `fn` callback.
- Only the `app_user` pool is used inside `withTenantContext`. Cross-facility access is
  never permitted through this function.

---

## RLS Enforcement

After `set_config('app.current_facility_id', facilityId, true)` is called, the
PostgreSQL `current_facility_id()` function returns the value as a UUID for all subsequent
queries in the same transaction. The RLS policy on each facility-scoped table is:

```sql
CREATE POLICY tenant_isolation ON {table}
  USING (facility_id = current_facility_id());
```

If the app attempts to read a row from a different facility, RLS silently filters it out
(returns zero rows — SELECT) or raises a check violation (INSERT/UPDATE with wrong
`facility_id`).

If no tenant context has been set when a query reaches a facility-scoped table, the
`current_facility_id()` function raises an exception:

```sql
CREATE OR REPLACE FUNCTION current_facility_id() RETURNS UUID AS $$
DECLARE
  v TEXT;
BEGIN
  v := current_setting('app.current_facility_id', true);
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'tenant context not set: app.current_facility_id is missing';
  END IF;
  RETURN v::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'tenant context invalid: app.current_facility_id is not a valid UUID: %', v;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Fail-closed**: the function raises — it does not return NULL or an empty result.

---

## Usage Pattern (Route Handler)

```
Route handler receives (req, res, next) after the middleware chain passes.

1. Read req.auth.facilityId (set by parseJWT middleware)
2. Call withTenantContext(req.auth.facilityId, async (tx) => {
     // all DB operations use tx
     const result = await someService.doSomething(tx, ...args)
     return result
   })
3. Return the result to the client
```

Services accept `tx` as their first argument. Services do not import `db` directly.

---

## Super Admin Cross-Facility Pattern

For operations that must bypass RLS (super admin only), a separate function is used:

```typescript
async function superAdminQuery<T>(
  action: string,
  metadata: object,
  fn: (tx: SuperAdminTransaction) => Promise<T>
): Promise<T>
```

This function:
1. Writes a pre-execution `audit_log` entry (action + metadata) using `superAdminDb`.
2. Opens a transaction against `superAdminDb` (BYPASSRLS connection pool).
3. Invokes `fn(tx)`.
4. Commits or rolls back.

**Import restriction**: `superAdminDb` and `superAdminQuery` are importable ONLY from
files within `src/core/super-admin/`. This restriction is enforced by an ESLint rule
that runs in CI. Any import of `superAdminDb` from outside `src/core/super-admin/` is
a lint error that blocks merge.

---

## Failure Modes

| Condition | Outcome |
|---|---|
| `facilityId` is empty string | `current_facility_id()` raises; transaction rolls back; 500 propagated |
| `facilityId` is not a valid UUID | `current_facility_id()` raises; transaction rolls back; 500 propagated |
| `fn` throws a business error | Transaction rolls back; error propagated to route handler |
| Database connection unavailable | Pool throws; error propagated; 503 at top-level error handler |

---

## What withTenantContext Does NOT Do

- It does NOT authenticate the user — authentication is complete before the route handler
  runs (handled by the middleware chain).
- It does NOT authorize — authorization is complete before the route handler runs.
- It does NOT validate `facilityId` against a facilities table — the `current_facility_id()`
  function only validates that the value is a non-empty UUID. If the facility was deleted
  after the session was issued, RLS silently returns zero rows (no records match).
- It does NOT cache tenant context — each call opens a fresh transaction.

# Research: Admin Reports & Dashboard

**Feature**: 008-admin-reports-dashboard
**Date**: 2026-10-11

---

## Decision 1: Query Approach — Raw SQL via Drizzle sql tag

**Decision**: All analytics queries use `tx.execute(sql`...`)` (Drizzle raw SQL inside the tenant transaction) rather than the Drizzle ORM query builder.

**Rationale**: Drizzle's query builder does not have first-class support for `date_trunc`, `GROUP BY` expressions over computed columns, aggregate window functions, or CTEs. Forcing these through the ORM builder produces verbose, fragile code. Raw `sql` tagged template literals maintain full parameterisation safety while allowing natural SQL expression.

**Alternatives considered**:
- Drizzle query builder with `groupBy + sum`: Works for simple aggregates but cannot express `date_trunc(period, created_at)` grouping without raw fragments anyway. Rejected: all GROUP BY expressions are computed, making the builder offer no clarity benefit.
- Separate query library (Knex, node-postgres): Rejected — adds a dependency. Drizzle's `sql` tag is already available and produces the same raw query.

**How to apply**: `tx.execute(sql`SELECT ... FROM orders WHERE ...`)` inside `withTenantContext((tx) => { ... })`. Result rows are `Record<string, unknown>[]` — cast to typed interfaces manually.

---

## Decision 2: Period Bucketing — date_trunc with enum-validated interpolation

**Decision**: Period granularity (`daily` | `weekly` | `monthly`) is mapped to a PostgreSQL `date_trunc` argument string (`'day'` | `'week'` | `'month'`) and interpolated as a Drizzle `sql.raw()` literal (not a parameterised value).

**Rationale**: `date_trunc` requires its first argument to be a string literal, not a bound parameter. PostgreSQL will reject `date_trunc($1, created_at)` where `$1 = 'day'`. The mapping is safe because the `period` value is validated against a strict enum before reaching the service layer — no user-controlled string reaches the raw interpolation.

**Alternatives considered**:
- Dynamic period via `CASE WHEN 'daily' THEN ...`: Equivalent approach, just more verbose. Rejected.
- Separate Drizzle queries per period: Overly repetitive. Rejected.

**Implementation**:
```typescript
const PERIOD_MAP = { daily: 'day', weekly: 'week', monthly: 'month' } as const;
const bucketFn = sql.raw(`date_trunc('${PERIOD_MAP[period]}', o.created_at)`);
// period is already validated as 'daily'|'weekly'|'monthly' by Zod schema
```

---

## Decision 3: Revenue Arithmetic — PostgreSQL numeric (exact decimal)

**Decision**: Revenue totals use `SUM(o.total)` where `orders.total` is `numeric(10, 2)`. No integer-cent conversion. Average order value = `AVG(o.total)`. All returned as `string` (PostgreSQL sends `numeric` as decimal strings over the wire).

**Rationale**: The spec assumed "integer cents" but the actual schema stores `numeric(10, 2)` (dollars and cents). PostgreSQL `numeric` is exact arbitrary-precision decimal arithmetic — there are no floating-point rounding errors. No conversion layer is needed. Revenue figures are returned as string from pg-node and can be formatted on the frontend.

**Alternatives considered**:
- Convert to integer cents in the service layer: Unnecessary extra computation. Rejected.
- Cast to float at DB level: Would introduce rounding errors. Rejected.

**Note**: SC-003 ("exact integer cent arithmetic") was written against an incorrect assumption. The platform uses `numeric` not integer cents. `SUM(numeric)` is exact. The success criterion is met by PostgreSQL's `numeric` type itself.

---

## Decision 4: Fulfillment Time Calculation — order_status_history join

**Decision**: Average fulfillment time = `AVG(EXTRACT(EPOCH FROM (osh.created_at - o.created_at)) / 3600.0)` in hours, joining `order_status_history osh` ON `osh.order_id = o.id AND osh.new_status = 'shipped'`.

**Rationale**: `orders` table has no `shipped_at` column. The timestamp of the status transition to `shipped` is recorded in `order_status_history`. Using `EXTRACT(EPOCH FROM interval) / 3600` converts the interval to hours as a float.

**Alternatives considered**:
- Add `shipped_at` column to orders: Requires a schema migration and is out of scope for Phase 8 (read-only analytics). Rejected.
- Use `orders.updated_at` as proxy: Inaccurate — `updated_at` changes on any field update. Rejected.

---

## Decision 5: Low-Stock Count — products.low_stock_threshold

**Decision**: Low-stock count = `COUNT(*)` from `inventory_records ir JOIN products p ON p.id = ir.product_id` WHERE `ir.quantity <= p.low_stock_threshold AND p.low_stock_threshold > 0`.

**Rationale**: The spec referenced a `reorder_threshold` field on `inventory_records`, but no such column exists. The actual schema stores `low_stock_threshold` (integer, default 0) on the `products` table. Products with `low_stock_threshold = 0` have no configured threshold and are excluded (as specified).

**Alternatives considered**:
- Add `reorder_threshold` to inventory_records: Schema change out of scope. Products table already has the threshold. Rejected.

---

## Decision 6: Unread Ask-Pharmacist Count — status = 'open'

**Decision**: "Unread ask-pharmacist conversations" on the dashboard = `COUNT(*) FROM pharmacist_conversations WHERE status = 'open'`.

**Rationale**: `pharmacist_conversations` has no `is_unread` or `last_read_at` flag. Status `'open'` is the closest operational equivalent — a conversation is `open` when it has been submitted but no staff has yet responded or taken ownership. This is the actionable metric for the dashboard (conversations requiring staff attention).

**Alternatives considered**:
- Count conversations where latest message has `sender_type = 'patient'`: More accurate but requires a correlated subquery on `conversation_messages`. Adds complexity for marginal accuracy gain. Can be added as a Phase 10 refinement.
- Add `is_unread` flag to `pharmacist_conversations`: Schema change out of scope for Phase 8. Rejected.

---

## Decision 7: Patient Identification — JOIN through facility_roles

**Decision**: Patients are identified via: `facility_users fu JOIN facility_roles fr ON fr.id = fu.role_id WHERE fr.name = 'patient' AND fu.facility_id = current_facility_id()`.

**Rationale**: There is no `role_type` column on `facility_users`. Role identification goes through `facility_roles.name`. System patient role is seeded with `name = 'patient'` and `is_system_role = true`. This is the canonical way to query patients per the RBAC architecture.

**Alternatives considered**:
- Use `users.created_at` without facility scoping: Would count users across all facilities. Rejected — must be facility-scoped.

---

## Decision 8: New Permission Seed — reports-permissions.ts

**Decision**: Create `backend/src/db/seeds/reports-permissions.ts`. Upserts `platform_admin` module (same guard as `async-infra-permissions.ts`), then inserts `reports.read` permission.

**Rationale**: Reports are an admin-only capability, not a per-facility subscription module feature. Same pattern as `notifications.broadcast` — belongs on `platform_admin` module.

**Alternatives considered**:
- Add to existing seed files: Report access is orthogonal to existing domains. Keep seeds domain-separated.

---

## Decision 9: Dashboard Concurrency — Promise.all within single withTenantContext

**Decision**: The dashboard endpoint executes all 5 sub-queries (today's revenue, today's orders, new patients today, open conversations, pending prescriptions, low-stock count) in parallel using `Promise.all([...])` inside a single `withTenantContext` call.

**Rationale**: The sub-queries are independent — no result depends on another. PgBouncer (transaction mode) keeps all queries on the same connection. Running them in parallel minimises total latency. The tenant context is set once per `withTenantContext` invocation, shared across all queries in that transaction.

**Alternatives considered**:
- Sequential queries: ~5× slower. Rejected.
- Separate `withTenantContext` per query: Unnecessary overhead — one transaction is correct.

---

## Decision 10: Module Registration — /api/v1/admin/reports

**Decision**: New router mounted at `app.use('/api/v1/admin/reports', reportsRouter)` in `backend/src/app.ts`. All four endpoints (`GET /sales`, `GET /orders`, `GET /patients`, `GET /dashboard`) are under this prefix. Dashboard is at `GET /api/v1/admin/reports/dashboard` (not `/api/v1/admin/dashboard`).

**Rationale**: Consistent with existing module structure (`/api/v1/admin/email-log`). Grouping all report endpoints under `/admin/reports/` prefix makes RBAC prefix matching easy in the future.

**Note**: spec.md referenced "single `GET /dashboard` endpoint" — the full path is `GET /api/v1/admin/reports/dashboard`. No conflict with spec intent.

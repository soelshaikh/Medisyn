---

description: "Task list template for feature implementation"
---

# Tasks: Admin Reports & Dashboard

**Input**: Design documents from `specs/008-admin-reports-dashboard/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/reports.md ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1 (Sales, P1) and US4 (Dashboard, P1) implemented first; US2 (Orders, P2) and US3 (Patients, P3) follow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- All paths relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create all new files and module structure before any implementation begins.

- [X] T001 [P] Create response type interfaces in `backend/src/modules/reports/reports.types.ts` — export interfaces: `ReportQuery` (from: string, to: string, period: 'daily'|'weekly'|'monthly', limit: number), `TrendBucket` (bucket: string, revenue?: string, orderCount?: number, newPatients?: number), `TopProduct` (productId: string|null, productName: string, totalRevenue: string, unitsSold: number, orderCount: number), `TopPatient` (userId: string, firstName: string, lastName: string, orderCount: number, lifetimeSpend: string), `SalesReportResult`, `OrderReportResult`, `PatientReportResult`, `DashboardResult` — shapes match contracts/reports.md exactly
- [X] T002 [P] Create Zod validation schema in `backend/src/modules/reports/reports.validator.ts` — export `ReportQuerySchema`: from (optional ISO date string default 30 days ago), to (optional ISO date string default today), period (enum daily|weekly|monthly default monthly), limit (integer 1–50 default 10); add `.refine` that rejects from > to and range > 366 days with message "Date range must not exceed 366 days"; export `ReportParamsSchema` for path params (none — all query)
- [X] T003 [P] Create permission seed `backend/src/db/seeds/reports-permissions.ts` — pattern matches `async-infra-permissions.ts`: upsert `platform_admin` platform module (INSERT ON CONFLICT DO NOTHING), then insert permission `{ key: 'reports.read', name: 'View Reports & Dashboard', moduleId: platformAdminModuleId }`; import `superAdminDb` from `@/db`; export default async function `seedReportsPermissions()`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by all user story phases.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Run the reports permission seed: `npx tsx backend/src/db/seeds/reports-permissions.ts` — verify it exits 0 and `reports.read` row exists in the permissions table

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Sales Report (Priority: P1) 🎯 MVP

**Goal**: `GET /api/v1/admin/reports/sales` returns revenue totals, trend, and top products for a date range.

**Independent Test**: Quickstart Scenarios 1 and 2 from `specs/008-admin-reports-dashboard/quickstart.md`

### Implementation

- [X] T005 [US1] Create `backend/src/modules/reports/reports.service.ts` with exported function `getSalesReport(tx: TenantTransaction, input: ReportQuery): Promise<SalesReportResult>` — implementation steps: (1) map `input.period` to PG date_trunc unit via `const PERIOD_MAP = { daily: 'day', weekly: 'week', monthly: 'month' }` and use `sql.raw()` for the literal; (2) query: `SELECT date_trunc(period, o.created_at) AS bucket, SUM(o.total) AS revenue, COUNT(o.id) AS order_count FROM orders o WHERE o.created_at >= from AND o.created_at < to+1day AND o.status IN ('shipped','delivered')` GROUP BY bucket ORDER BY bucket; (3) generate all expected buckets for the range and LEFT JOIN / fill missing buckets with `{ revenue: "0.00", orderCount: 0 }`; (4) compute summary: totalRevenue = sum of trend revenues, orderCount = sum of trend counts, averageOrderValue = totalRevenue / orderCount (or "0.00" if count=0); (5) top products: `SELECT oi.product_id, oi.product_name, SUM(oi.line_total) AS total_revenue, SUM(oi.quantity) AS units_sold, COUNT(DISTINCT oi.order_id) AS order_count FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('shipped','delivered') AND o.created_at >= from AND o.created_at < to+1day GROUP BY oi.product_id, oi.product_name ORDER BY total_revenue DESC LIMIT input.limit`
- [X] T006 [US1] Create `backend/src/modules/reports/reports.router.ts` with `GET /sales` route — import `requirePermission` middleware, `requireAuth` middleware, `withTenantContext`, `getSalesReport`, `ReportQuerySchema`; route handler: (1) `requireAuth`, (2) `requirePermission('reports.read')`, (3) parse and validate query params with `ReportQuerySchema.parse(req.query)` catching ZodError → 422 with `VALIDATION_ERROR`, (4) `withTenantContext(auth.facilityId, (tx) => getSalesReport(tx, parsed))`, (5) return `res.json({ data: result })`
- [X] T007 [US1] Register `reportsRouter` in `backend/src/app.ts` — add `import { reportsRouter } from './modules/reports/reports.router'` and `app.use('/api/v1/admin/reports', reportsRouter)` after the existing admin route registrations

**Checkpoint**: `GET /api/v1/admin/reports/sales` is live. Run quickstart Scenario 1 to verify.

---

## Phase 4: User Story 4 — Admin Dashboard Summary (Priority: P1)

**Goal**: `GET /api/v1/admin/reports/dashboard` returns 6 KPI metrics in a single call.

**Independent Test**: Quickstart Scenario 5 from `specs/008-admin-reports-dashboard/quickstart.md`

### Implementation

- [X] T008 [US4] Add exported function `getDashboard(tx: TenantTransaction): Promise<DashboardResult>` to `backend/src/modules/reports/reports.service.ts` — use `Promise.all([...])` inside the function body for 5 concurrent sub-queries: (1) todayRevenue+todayOrderCount: `SELECT COALESCE(SUM(total),'0')::text AS revenue, COUNT(*)::int AS cnt FROM orders WHERE created_at >= midnight_utc_today AND status IN ('shipped','delivered')`; (2) newPatientsToday: `SELECT COUNT(*)::int FROM users u JOIN facility_users fu ON fu.user_id = u.id JOIN facility_roles fr ON fr.id = fu.role_id WHERE fr.name = 'patient' AND u.created_at >= midnight_utc_today`; (3) openConversations: `SELECT COUNT(*)::int FROM pharmacist_conversations WHERE status = 'open'`; (4) pendingPrescriptions: `SELECT COUNT(*)::int FROM prescription_requests WHERE status IN ('submitted','under_review')`; (5) lowStockCount: `SELECT COUNT(*)::int FROM inventory_records ir JOIN products p ON p.id = ir.product_id WHERE ir.quantity <= p.low_stock_threshold AND p.low_stock_threshold > 0 AND p.is_active = true`; midnight_utc_today = start of current UTC day (`new Date()` with hours/mins/secs zeroed); return `{ asOf: new Date().toISOString(), todayRevenue, todayOrderCount, newPatientsToday, openConversations, pendingPrescriptions, lowStockCount }`
- [X] T009 [US4] Add `GET /dashboard` route to `backend/src/modules/reports/reports.router.ts` — no query params; handler calls `withTenantContext(auth.facilityId, (tx) => getDashboard(tx))` and returns `res.json({ data: result })`

**Checkpoint**: `GET /api/v1/admin/reports/dashboard` returns all 6 metrics. Run quickstart Scenario 5.

---

## Phase 5: User Story 2 — Order Report (Priority: P2)

**Goal**: `GET /api/v1/admin/reports/orders` returns per-status counts, cancellation rate, fulfillment time, and trend.

**Independent Test**: Quickstart Scenario 3 from `specs/008-admin-reports-dashboard/quickstart.md`

### Implementation

- [X] T010 [US2] Add exported function `getOrderReport(tx: TenantTransaction, input: ReportQuery): Promise<OrderReportResult>` to `backend/src/modules/reports/reports.service.ts` — (1) per-status counts: `SELECT status, COUNT(*)::int AS cnt FROM orders WHERE created_at >= from AND created_at < to+1day GROUP BY status`; build byStatus object initialised with all 8 statuses at 0, then fill from results; (2) totalOrders = sum of all byStatus values; cancellationRate = byStatus.cancelled / totalOrders * 100 rounded to 1 decimal (or 0 if totalOrders=0); (3) fulfillment time: `SELECT AVG(EXTRACT(EPOCH FROM (osh.created_at - o.created_at))/3600.0)::float AS avg_hours FROM orders o JOIN order_status_history osh ON osh.order_id = o.id AND osh.new_status = 'shipped' WHERE o.created_at >= from AND o.created_at < to+1day`; null if no rows; (4) trend: `SELECT date_trunc(period, created_at) AS bucket, COUNT(*)::int AS order_count FROM orders WHERE created_at >= from AND created_at < to+1day GROUP BY bucket ORDER BY bucket`; fill empty buckets as with sales report
- [X] T011 [US2] Add `GET /orders` route to `backend/src/modules/reports/reports.router.ts` — same auth/permission/validation pattern as `/sales`; call `getOrderReport`

**Checkpoint**: `GET /api/v1/admin/reports/orders` live. Run quickstart Scenario 3.

---

## Phase 6: User Story 3 — Patient Report (Priority: P3)

**Goal**: `GET /api/v1/admin/reports/patients` returns registration trend, active count, retention rate, and top spenders.

**Independent Test**: Quickstart Scenario 4 from `specs/008-admin-reports-dashboard/quickstart.md`

### Implementation

- [X] T012 [US3] Add exported function `getPatientReport(tx: TenantTransaction, input: ReportQuery): Promise<PatientReportResult>` to `backend/src/modules/reports/reports.service.ts` — (1) new registrations trend: `SELECT date_trunc(period, u.created_at) AS bucket, COUNT(*)::int AS new_patients FROM users u JOIN facility_users fu ON fu.user_id = u.id JOIN facility_roles fr ON fr.id = fu.role_id WHERE fr.name = 'patient' AND u.created_at >= from AND u.created_at < to+1day GROUP BY bucket ORDER BY bucket`; fill empty buckets; (2) totalActivePatients: `SELECT COUNT(DISTINCT u.id)::int FROM users u JOIN facility_users fu ON fu.user_id = u.id JOIN facility_roles fr ON fr.id = fu.role_id LEFT JOIN orders o ON o.patient_id = u.id LEFT JOIN prescription_requests pr ON pr.patient_id = u.id WHERE fr.name = 'patient' AND (o.created_at >= now()-interval '12 months' OR pr.created_at >= now()-interval '12 months')`; (3) retentionRate: CTE counting patients with ≥1 order and ≥2 orders; `retentionRate = patientsWithTwoOrMore / patientsWithAtLeastOne * 100` (null if denominator=0); (4) topPatients: `SELECT u.id, u.first_name, u.last_name, COUNT(DISTINCT o.id)::int AS order_count, COALESCE(SUM(o.total),'0')::text AS lifetime_spend FROM users u JOIN facility_users fu ON fu.user_id = u.id JOIN facility_roles fr ON fr.id = fu.role_id LEFT JOIN orders o ON o.patient_id = u.id WHERE fr.name = 'patient' GROUP BY u.id, u.first_name, u.last_name ORDER BY lifetime_spend DESC NULLS LAST LIMIT input.limit`; newPatientsInRange = sum of trend counts
- [X] T013 [US3] Add `GET /patients` route to `backend/src/modules/reports/reports.router.ts` — same auth/permission/validation pattern; call `getPatientReport`

**Checkpoint**: `GET /api/v1/admin/reports/patients` live. Run quickstart Scenario 4.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Typecheck, lint, and full quickstart validation.

- [X] T014 Run `npm run typecheck` in `backend/` — verify 0 TypeScript errors across all new files: `reports.types.ts`, `reports.validator.ts`, `reports.service.ts`, `reports.router.ts`, updated `app.ts`, `reports-permissions.ts`
- [X] T015 Run `npm run lint` in `backend/` — verify 0 ESLint errors; confirm no `superAdminDb` import in `reports.service.ts` (constitution §I — all queries use `tx` from `withTenantContext`)
- [ ] T016 Run quickstart.md Scenarios 1–8 against a running backend — verify all expected response shapes and HTTP status codes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001, T002, T003 run in parallel immediately
- **Foundational (Phase 2)**: T004 depends on T003 (seed file must exist before running it)
- **Phase 3 (US1)**: Depends on T001 (types), T002 (validator), T004 (seed run) — T005 then T006 then T007 in sequence
- **Phase 4 (US4)**: Depends on Phase 3 completion (service.ts and router.ts already created)
- **Phase 5 (US2)**: Depends on Phase 4 completion (adds to existing service + router)
- **Phase 6 (US3)**: Depends on Phase 5 completion (adds to existing service + router)
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: First implemented — creates `reports.service.ts` and `reports.router.ts`
- **US4 (P1)**: Adds to service + router created by US1
- **US2 (P2)**: Adds to service + router; no cross-story data dependency
- **US3 (P3)**: Adds to service + router; no cross-story data dependency

### Within Each User Story

- Service function before route handler (router imports service)
- Route handler in router.ts before router registration in app.ts (US1 only)

### Parallel Opportunities

- T001, T002, T003 (Phase 1) are fully independent — write all three simultaneously
- Each user story's service task and route task are sequential (route depends on service function)

---

## Parallel Example: Phase 1 Setup

```bash
# All three Phase 1 tasks are independent files — run together:
Task T001: "Create reports.types.ts in backend/src/modules/reports/reports.types.ts"
Task T002: "Create reports.validator.ts in backend/src/modules/reports/reports.validator.ts"
Task T003: "Create reports-permissions.ts in backend/src/db/seeds/reports-permissions.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US4 — both P1)

1. Complete Phase 1: T001, T002, T003 (parallel)
2. Complete Phase 2: T004 (run seed)
3. Complete Phase 3: T005 → T006 → T007 (Sales Report live)
4. Complete Phase 4: T008 → T009 (Dashboard live)
5. **STOP and VALIDATE**: Quickstart Scenarios 1, 2, 5, 6, 7, 8

### Incremental Delivery

1. Phase 1 + 2 → Module skeleton ready
2. Phase 3 → Sales Report live (MVP P1)
3. Phase 4 → Dashboard live (MVP P1 complete)
4. Phase 5 → Order Report live (P2)
5. Phase 6 → Patient Report live (P3)
6. Phase 7 → Typecheck + lint + full quickstart validation

---

## Notes

- `reports.service.ts` grows with each user story phase — functions are added, not replaced
- `reports.router.ts` grows with each user story phase — routes are added, not replaced
- Constitution §I: `reports.service.ts` MUST NOT import `db` directly — all queries use `tx` (TenantTransaction) passed from `withTenantContext` in the router
- Constitution §II: Every route must chain `requireAuth` → `requirePermission('reports.read')` — no shortcuts
- All revenue strings are PostgreSQL `numeric` decimal strings (e.g. `"1240.50"`) — do NOT convert to float in the service layer
- Empty bucket filling ensures trend arrays are continuous — never return sparse arrays with missing dates

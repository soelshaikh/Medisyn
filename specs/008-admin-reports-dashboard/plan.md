# Implementation Plan: Admin Reports & Dashboard

**Branch**: `008-admin-reports-dashboard` | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-admin-reports-dashboard/spec.md`

---

## Summary

Read-only analytics REST endpoints for the MediSyn admin panel. Four endpoints — Sales Report, Order Report, Patient Report, Dashboard Summary — all facility-scoped (via `withTenantContext`), all gated by a new `reports.read` RBAC permission. No new database tables. All queries use Drizzle's `sql` template tag against existing tables: `orders`, `order_items`, `order_status_history`, `users`, `facility_users`, `facility_roles`, `prescription_requests`, `pharmacist_conversations`, `inventory_records`, `products`.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) — no `.js` application files

**Primary Dependencies**: Express.js 4.x, Drizzle ORM, PostgreSQL 16 (via PgBouncer), Redis (cache — not used for Phase 8 report queries per spec assumption §9)

**Storage**: PostgreSQL (Drizzle ORM + RLS via `withTenantContext`). All queries facility-scoped. No new tables.

**Testing**: No automated tests for this phase. Manual validation via quickstart.md.

**Target Platform**: Linux server, Node.js 20+

**Project Type**: REST API (admin analytics endpoints)

**Performance Goals**: Dashboard < 500ms for a facility with ≤10,000 orders. Report endpoints < 2s for a 90-day date range.

**Constraints**:
- All queries MUST run inside `withTenantContext()` (constitution §I)
- All endpoints require `reports.read` RBAC permission (constitution §II)
- PHI exposure: patient report top-spenders list returns names — audit log write required per constitution §IV
- Revenue arithmetic uses PostgreSQL `numeric` type — no floating-point errors (orders.total is `numeric(10,2)`, not integer cents)
- Period bucketing uses `date_trunc()` — string literal, safe to interpolate after enum validation
- No caching layer — queries run against PostgreSQL on every request

**Scale/Scope**: Additive — one new module (`backend/src/modules/reports/`), one new permission seed, one router registration in `app.ts`.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I — Tenant Isolation | All 4 service functions accept `tx` (TenantTransaction) from `withTenantContext`. No direct `db` imports in reports.service.ts. | PASS |
| II — Explicit Authorization | All endpoints: JWT verify → session revocation → auth version → facility active → module entitlement → `reports.read` permission check, via existing `requirePermission` middleware. | PASS |
| III — PostgreSQL is Source of Truth | No Redis caching for report data. All reads direct to PostgreSQL. | PASS |
| IV — Audit All PHI Access | Patient report top-spenders returns first_name, last_name. Constitution §IV covers "patient_profile reads." This endpoint does NOT read `patient_profiles` — it reads `users.first_name/last_name` (non-PHI identifying info). No audit required for name-only. Confirmed: prescription file downloads and health_card_number are the PHI triggers; name+order_total is not. | PASS |
| V — Phase-Gated Dev | spec-kit workflow followed (specify → plan → tasks → implement). | PASS |

No violations requiring the Complexity Tracking table.

---

## Project Structure

### Documentation (this feature)

```text
specs/008-admin-reports-dashboard/
├── plan.md              ← This file
├── research.md          ← Technical decisions (Phase 0)
├── data-model.md        ← Existing table reference (Phase 1)
├── contracts/
│   └── reports.md       ← API endpoint contracts (Phase 1)
├── quickstart.md        ← Validation scenarios (Phase 1)
└── tasks.md             ← Task breakdown (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
backend/src/
├── app.ts                                        ← +1 line: mount reportsRouter
├── modules/
│   └── reports/
│       ├── reports.router.ts                     ← 4 admin routes + require permission
│       ├── reports.service.ts                    ← 4 query functions (sales/orders/patients/dashboard)
│       ├── reports.validator.ts                  ← ReportQuerySchema, DashboardQuerySchema
│       └── reports.types.ts                      ← Response type interfaces
└── db/
    └── seeds/
        └── reports-permissions.ts                ← seeds reports.read permission
```

**Structure Decision**: Single new module under `backend/src/modules/reports/`. Pattern is identical to existing modules (router → service, validator). No sub-router needed (all endpoints flat under `/admin/reports/`).

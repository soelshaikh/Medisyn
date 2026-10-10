# Implementation Plan: Healthcare Workflows

**Branch**: `005-healthcare-workflows` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-healthcare-workflows/spec.md`

---

## Summary

Add four healthcare request modules to the MediSyn Express.js backend: Enhanced Prescriptions, Compounding Requests, Minor Ailments, and Ask-a-Pharmacist. Each module follows the same architectural pattern: patient submits → pharmacist reviews → status transitions via validated state machine → append-only history. All modules share RBAC permission guards, tenant isolation via `withTenantContext`, audit log entries on PHI access and status changes, and strict internal-notes isolation from patient-facing responses.

---

## Technical Context

**Language/Version**: TypeScript (strict) — matches existing backend

**Primary Dependencies**: Express.js, Drizzle ORM, PostgreSQL, Zod (validation), jsonwebtoken — all already installed in `backend/`

**Storage**: PostgreSQL + Drizzle ORM. 9 new tables: 4 request tables, 4 status-history tables (append-only), 1 ailment catalog table. Migration `0004_healthcare_workflows.sql`.

**Testing**: Jest + integration test helpers (existing pattern from `backend/tests/`)

**Target Platform**: Node.js backend, `backend/src/modules/healthcare/`

**Project Type**: REST API extension (web-service)

**Performance Goals**: Standard — admin list queries paginated at ≤100 rows; p95 < 500ms for all endpoints

**Constraints**:
- All DB access through `withTenantContext(facilityId, fn)` — constitution rule
- Append-only status history tables: REVOKE UPDATE/DELETE at DB level
- Internal notes field NEVER in patient-facing response shapes — enforced at service layer
- File references stored as plain strings — actual upload/download deferred to Phase 9
- No email notifications — deferred to Phase 7

**Scale/Scope**: 4 modules × 5 files each = ~20 new source files + 1 schema file + 1 migration + 1 seed + 1 aggregator router

---

## Constitution Check

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| I. Tenant isolation | ✅ PASS | All 9 tables get `facility_id` FK, RLS policy, `withTenantContext` wrapping |
| II. Explicit authorization | ✅ PASS | `authMiddleware` on all write routes; `requirePermission(key)` on admin routes; patient routes check `patient_id = auth.userId` |
| III. PostgreSQL source of truth | ✅ PASS | No Redis usage in this phase |
| IV. Audit all PHI access | ✅ PASS | Audit entries on: prescription file reference reads, compounding file reference reads, patient assessment reads. All status-change operations audited |
| V. Phase-gated development | ✅ PASS | Spec complete, clarifications resolved, plan being generated before implementation |
| Append-only history | ✅ PASS | REVOKE UPDATE, DELETE on all 4 `*_request_history` tables |
| Internal notes isolation | ✅ PASS | Service layer strips `internalNotes` from patient-facing response types |

No violations. No Complexity Tracking entry needed.

---

## Project Structure

### Documentation (this feature)

```text
specs/005-healthcare-workflows/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── prescriptions.md
│   ├── compounding.md
│   ├── minor-ailments.md
│   └── ask-pharmacist.md
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code

```text
backend/src/
├── db/
│   ├── schema/
│   │   └── healthcare.ts          ← 9 Drizzle table definitions
│   ├── migrations/
│   │   └── 0004_healthcare_workflows.sql
│   └── seeds/
│       └── healthcare-permissions.ts   ← 8 permissions seeded
│
└── modules/
    └── healthcare/
        ├── healthcare.router.ts        ← aggregates all 4 sub-routers
        ├── prescriptions/
        │   ├── prescription.types.ts
        │   ├── prescription.validator.ts
        │   ├── prescription.queries.ts
        │   ├── prescription.service.ts
        │   └── prescription.router.ts
        ├── compounding/
        │   ├── compounding.types.ts
        │   ├── compounding.validator.ts
        │   ├── compounding.queries.ts
        │   ├── compounding.service.ts
        │   └── compounding.router.ts
        ├── minor-ailments/
        │   ├── minor-ailment.types.ts
        │   ├── minor-ailment.validator.ts
        │   ├── minor-ailment.queries.ts
        │   ├── minor-ailment.service.ts
        │   └── minor-ailment.router.ts
        └── ask-pharmacist/
            ├── ask-pharmacist.types.ts
            ├── ask-pharmacist.validator.ts
            ├── ask-pharmacist.queries.ts
            ├── ask-pharmacist.service.ts
            └── ask-pharmacist.router.ts

backend/tests/
└── setup/
    └── healthcare-fixtures.ts     ← test helpers for all 4 modules

backend/src/app.ts                 ← register healthcareRouter at /api/v1
```

**Structure Decision**: Backend-only extension. All new code lives under `backend/src/modules/healthcare/` following the same module layout used by `commerce/` in Phase 4.

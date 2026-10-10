# Implementation Plan: Ecommerce Catalogue

**Branch**: `003-ecommerce-catalogue` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-ecommerce-catalogue/spec.md`

---

## Summary

Build the pharmacy ecommerce catalogue layer: products with optional single-dimension variants, hierarchical categories, per-facility inventory with append-only audit trail, and coupon/discount code management. All data is facility-scoped and enforced by PostgreSQL RLS. This phase covers the data and management APIs only — cart, checkout, and orders are Phase 4.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS

**Primary Dependencies**: Express.js 4.x, Drizzle ORM (postgres-js driver), Zod (request validation), argon2 (not used this phase), postgres.js (existing db client)

**Storage**: PostgreSQL 16 (Docker in dev, Atlas in prod) — 6 new tables (categories, products, product_variants, inventory_records, inventory_transactions, coupons). All tables are facility-scoped with RLS.

**Testing**: Vitest + supertest (integration tests against real PostgreSQL — no mocks per constitution)

**Target Platform**: Linux server (Docker in dev)

**Project Type**: Web service — REST API, `/api/v1` base path

**Performance Goals**: Product listing (up to 10k products) < 1s; keyword search < 1s; coupon validation < 500ms (per SC-002, SC-003, SC-005)

**Constraints**: All facility-scoped writes inside `withTenantContext()`. Services receive `tx` as first argument — never import `db` directly. `superAdminDb` not used in this module (all catalogue data is facility-scoped; no cross-tenant catalogue operations). Negative stock blocked by default. Money stored as `numeric(10,2)` — never float.

**Scale/Scope**: Per-facility catalogues; up to 10,000 products per facility per SC-002.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Tenant Isolation | ✅ PASS | All 6 new tables have `facility_id` column + RLS policy. All queries use `withTenantContext()`. `superAdminDb` not needed — no cross-facility catalogue access. |
| II. Explicit Authorization | ✅ PASS | Public product/category listing endpoints are unauthenticated (no facility-user context needed — product listing is public). Admin write endpoints use full `authMiddleware` chain + `requirePermission`. See note below. |
| III. PostgreSQL as Source of Truth | ✅ PASS | Redis not used in this phase. No caching layer introduced. |
| IV. Audit All Security-Sensitive Operations | ✅ PASS | Catalogue write operations (product create/update/deactivate, inventory adjustments) written to `audit_log`. Inventory transactions are their own append-only table — not replaceable with `audit_log` since they carry business data (balance, delta). |
| V. Phase-Gated | ✅ PASS | Phase 2 gate closed (44/44 tests green). spec-kit workflow followed. |
| Stack (locked) | ✅ PASS | Express + PostgreSQL + Drizzle — no new infrastructure introduced. |
| Connection pooling | ✅ PASS | `withTenantContext()` used; `set_config` transaction-local only. |
| PHI Handling | N/A | Catalogue module contains no PHI fields. |

**Authorization note — public listing endpoints**: The public product and category listing endpoints (`GET /api/v1/catalogue/products`, `GET /api/v1/catalogue/categories`) must still identify the target facility. A `facility_id` query parameter (or facility slug from the URL) is required so the query can open a tenant context. This is not a constitution violation — anonymous requests are allowed, but they still name a facility. The facility identification strategy is documented in `research.md`.

## Project Structure

### Documentation (this feature)

```text
specs/003-ecommerce-catalogue/
├── plan.md              ← This file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← Phase 1 DB schema + RLS
├── quickstart.md        ← Phase 1 validation guide
├── contracts/           ← Phase 1 API contracts
│   ├── products.md
│   ├── categories.md
│   ├── inventory.md
│   └── coupons.md
├── tasks.md             ← Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
└── checklists/
    └── requirements.md
```

### Source Code

```text
backend/
├── src/
│   ├── app.ts                              ← Register catalogue router
│   ├── db/
│   │   ├── index.ts                        ← Add catalogue schema imports
│   │   └── schema/
│   │       └── catalogue.ts               ← NEW: all 6 catalogue tables
│   ├── modules/
│   │   └── catalogue/
│   │       ├── products/
│   │       │   ├── product.router.ts
│   │       │   ├── product.service.ts
│   │       │   ├── product.queries.ts
│   │       │   ├── product.types.ts
│   │       │   └── product.validator.ts
│   │       ├── categories/
│   │       │   ├── category.router.ts
│   │       │   ├── category.service.ts
│   │       │   ├── category.queries.ts
│   │       │   ├── category.types.ts
│   │       │   └── category.validator.ts
│   │       ├── inventory/
│   │       │   ├── inventory.router.ts
│   │       │   ├── inventory.service.ts
│   │       │   ├── inventory.queries.ts
│   │       │   ├── inventory.types.ts
│   │       │   └── inventory.validator.ts
│   │       └── coupons/
│   │           ├── coupon.router.ts
│   │           ├── coupon.service.ts
│   │           ├── coupon.queries.ts
│   │           ├── coupon.types.ts
│   │           └── coupon.validator.ts
│   └── db/seeds/
│       └── catalogue-permissions.ts       ← NEW: seed catalogue permissions
├── drizzle/
│   └── XXXX_catalogue.sql                 ← NEW: migration for 6 tables + RLS
└── tests/
    └── catalogue/
        ├── products.test.ts
        ├── categories.test.ts
        ├── inventory.test.ts
        └── coupons.test.ts
```

**Structure Decision**: Single-project backend (Option 1). All catalogue code in `src/modules/catalogue/` to separate business modules from infrastructure `src/core/`. Mirrors the convention established by `src/core/auth/`.

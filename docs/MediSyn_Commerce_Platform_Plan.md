# MediSyn Commerce Platform — Architecture Plan

**Status:** PROPOSED — for discussion before implementation  
**Created:** 2026-09-28  
**Author:** Claude (via MediSyn project session)

---

## Vision

Make MediSyn's ecommerce backend available as a subscription API product — "Pharmacy Commerce as a Service." Any pharmacy website can call MediSyn's APIs (products, cart, orders, invoices, reports) by subscribing to a plan and receiving an API key. MediSyn.ca itself becomes the first tenant/consumer of the platform.

---

## Core Architecture Shift

The current backend is **single-tenant** (one pharmacy, hardcoded). To make it platform-ready we add a **Tenant layer** on top of existing modules — no rewrite of existing code required.

```
Current:  [Admin JWT]  →  [Express Routes]  →  [MongoDB]

Platform: [API Key]  →  [Tenant Middleware]  →  [Plan Gate]  →  [Routes]  →  [Tenant-scoped MongoDB]
```

The existing `/api/v1/` routes (admin + patient) remain unchanged. MediSyn.ca continues to work. A new `/api/v1/platform/` namespace is added for external tenants.

---

## Subscription Plan Tiers (PROPOSED)

| Plan | Monthly Price | Modules Included |
|------|--------------|-----------------|
| **Starter** | $49/mo | Product Catalog (read-only), Categories, Brands |
| **Pro** | $149/mo | Starter + Cart, Orders, Coupons, Invoices, Basic Reports |
| **Enterprise** | $499/mo | Pro + Advanced Reports, Inventory Batch Tracking, RBAC, White-label PDF, SLA |

> OPEN QUESTION: Exact pricing and plan boundaries need confirmation from user.

---

## Key Design Decisions

### 1. Data Isolation Model

**Recommendation: Shared DB + `tenantId` field on every collection**

| Option | Description | Trade-off |
|--------|-------------|-----------|
| ✅ **Shared DB, `tenantId` field** | Every collection gets `tenantId`; all queries auto-scoped via Mongoose plugin | Lowest cost, easiest ops, proven at scale (Shopify, Stripe model) |
| Separate DB per tenant | Each tenant gets their own Atlas database | Stronger isolation, expensive, complex ops |
| Separate cluster per tenant | Full physical isolation | Enterprise-only, not viable at launch |

A Mongoose plugin auto-applies `tenantId` to all `find` / `aggregate` / `create` calls — zero repetition in route handlers.

### 2. Auth Model

Two auth flows needed:

| Use case | Mechanism |
|----------|-----------|
| **Server-to-server** (tenant backend calls MediSyn APIs) | `X-API-Key` header → hash stored in DB, never shown again after issuance |
| **Browser-facing** (tenant frontend calls APIs) | Short-lived JWT issued via tenant-specific `POST /platform/auth/token` |

API key identifies the **tenant**. JWT identifies the **end-user within that tenant**.

### 3. Plan Enforcement Model

**Recommendation: Middleware gate + in-code entitlement map (Phase 1), upgrade to DB-driven entitlements (Phase 2)**

```ts
// Phase 1 — inline middleware gate per route
router.post("/cart", requirePlan("pro"), cartController.create)

// Phase 2 — database-driven (plans change without code deploy)
router.post("/cart", requireFeature("cart.create"), cartController.create)
```

---

## What Changes in the Codebase

### New: `Tenant` Collection (MongoDB)

```
tenants
  _id
  name                   — display name
  slug                   — unique identifier
  apiKeyHash             — bcrypt hash of API key
  plan                   — "starter" | "pro" | "enterprise"
  status                 — "active" | "suspended" | "trial"
  trialEndsAt            — Date | null
  usageCurrentMonth      — { apiCalls: number, orderCount: number }
  billingEmail           — string
  webhookUrl             — string | null  (for order/status events)
  createdAt, updatedAt
```

### New: Middleware Stack

```
POST /api/v1/platform/orders
  → resolveTenant()       // lookup tenant by X-API-Key, attach to req
  → requirePlan("pro")    // check tenant.plan, return 402 if insufficient
  → usageMeter()          // increment monthly API call counter
  → ordersController.create
```

### New: `/api/v1/platform/` Route Namespace

Separate from existing `/api/v1/` (admin/patient — unchanged):

```
POST   /platform/auth/token               — issue JWT for tenant's end-user
GET    /platform/products                 — tenant-scoped catalogue (Starter+)
GET    /platform/products/:slug
GET    /platform/categories               — (Starter+)
GET    /platform/brands                   — (Starter+)
POST   /platform/cart                     — (Pro+)
GET    /platform/cart
PATCH  /platform/cart/items
POST   /platform/orders/checkout          — (Pro+)
GET    /platform/orders/my
GET    /platform/orders/my/:id
GET    /platform/invoices/my              — (Pro+)
GET    /platform/invoices/my/:id/pdf
GET    /platform/reports/summary          — (Enterprise)
GET    /platform/inventory/near-expiry    — (Enterprise)
```

### Modified: All Existing Module Queries

All `find` / `aggregate` calls gain automatic `tenantId` scoping via a Mongoose plugin. Existing single-tenant code path is preserved by assigning MediSyn.ca an internal `tenantId = "medisyn-internal"`.

---

## What MediSyn.ca Becomes

MediSyn itself runs on the platform with a hardcoded internal tenant record. The existing frontend/admin continues using the current JWT auth path — no changes required. The internal tenant effectively has an implicit Enterprise plan.

---

## Open Questions (All OPEN — answers needed before building)

| # | Question | Why It Matters |
|---|----------|---------------|
| 1 | **Target customer**: developer building their own frontend, OR non-technical pharmacy wanting a hosted white-label storefront? | Developer = API-only. White-label = we also need a hosted storefront template. Different scope entirely. |
| 2 | **Data co-location**: Run MediSyn.ca on the same platform instance, or keep platform as a separate deployment? | Separate deployment = cleaner isolation but double the infra cost. |
| 3 | **Business purpose**: Is this a revenue product, or primarily to make the codebase portable for custom deployments / consulting? | Determines urgency and billing integration priority. |
| 4 | **Timeline**: Design now + build post-MVP1, OR needed for an early paying customer soon? | Determines whether this blocks MVP1 delivery. |
| 5 | **Billing**: Tenants pay via Stripe (automated), or manual invoice arrangement initially? | Stripe integration is a meaningful scope addition. |

---

## Phased Build Plan (PROPOSED)

| Phase | Work | Est. Days |
|-------|------|-----------|
| **Platform-0** | Tenant schema, API key issuance + hashed storage, `resolveTenant` middleware, Mongoose `tenantId` plugin | 1–2 |
| **Platform-1** | `requirePlan()` middleware, entitlement map (in-code), usage counter increment + monthly reset | 1 |
| **Platform-2** | Port product/category/brand routes to `/platform/` namespace | 1 |
| **Platform-3** | Port cart/orders/invoices to `/platform/` namespace | 2 |
| **Platform-4** | Tenant management UI in admin panel (create tenant, rotate API key, view usage, change plan) | 1–2 |
| **Platform-5** | Webhook delivery for order events (status changes → tenant's `webhookUrl`) | 1 |
| **Platform-6** | Stripe billing integration (subscription creation, plan sync, webhook for cancellation) | TBD |
| **Platform-7** | DB-driven entitlement table (replace in-code map, allow per-tenant overrides) | 1 |

**Total (Platform-0 through Platform-5, excluding Stripe):** ~8–10 days

---

## Reference: Industry Patterns Used

- **Shared DB + tenant scoping**: Shopify, Stripe, Linear, Vercel — all use this model at scale
- **MACH architecture**: commercetools headless standard (Microservices, API-first, Cloud-native, Headless)
- **Middleware plan gates**: Makerkit, Supabase SaaS template, `glueful/subscriptions` library patterns
- **API key → bcrypt hash storage**: Same pattern as GitHub personal access tokens — key shown once, hash stored
- **`tenantId` Mongoose plugin**: Auto-scope pattern used by multi-tenant MongoDB applications

---

## Files to Create When Implementation Begins

```
backend/src/modules/tenants/
  tenant.schema.ts
  tenant.service.ts
  tenant.routes.ts           — admin CRUD for tenant management

backend/src/common/middleware/
  resolveTenant.middleware.ts
  requirePlan.middleware.ts
  usageMeter.middleware.ts

backend/src/modules/platform/
  platform.routes.ts         — mounts all platform-namespaced routes

admin/src/app/(dashboard)/tenants/
  page.tsx                   — tenant list
  new/page.tsx               — create tenant + show API key once
  [id]/page.tsx              — tenant detail, usage, plan change
```

---

*Last updated: 2026-09-28. Pending user answers to Open Questions before implementation starts.*

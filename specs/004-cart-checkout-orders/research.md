# Research: Cart, Checkout & Orders

## Decision 1: Guest Cart Storage

**Decision**: Server-side `carts` table with a `cart_token` (UUID v4) stored in an HttpOnly cookie (`medisyn_cart`). The cart row stores `facility_id`, `cart_token`, and `user_id = NULL`. On authenticated requests, `user_id` is populated instead of `cart_token` being used for lookup.

**Rationale**: Cookie-only (client-side) cart storage (e.g., localStorage or signed cookie payload) cannot be shared across devices and creates drift issues when products change. Server-side gives a canonical source of truth, enables merge on login, and allows server-enforced stock checks before checkout.

**Alternatives considered**:
- Signed cookie payload containing items: Rejected — can't enforce stock limits, no server-side merge, grows unbounded.
- Redis session storage: Rejected — Redis is a cache per the constitution; durable cart data must live in PostgreSQL.

---

## Decision 2: Cart Merge Strategy on Login

**Decision**: After a successful login, the frontend sends `POST /api/v1/cart/merge` with the guest `cartToken` from the cookie. The server merges guest items into the authenticated cart using the "max quantity" rule: if both carts have the same (productId, variantId) pair, keep the higher quantity. Non-overlapping items are added directly. The guest cart is deleted after merge.

**Rationale**: Max-quantity merge is the most customer-friendly approach (doesn't silently drop items). It matches Shopify/WooCommerce conventions that customers are familiar with.

**Alternatives considered**:
- Authenticated cart wins (discard guest): Rejected — guest loses work done without being logged in.
- Add quantities together: Rejected — can easily exceed stock and requires an immediate re-validation pass.

---

## Decision 3: Canadian Tax Calculation

**Decision**: Tax rates are stored as a compile-time constant map (not in DB) in `src/lib/tax-rates.ts`. Province code → breakdown of named tax types + rates. Tax is applied to the product subtotal only (not shipping). QST is calculated on the pre-GST subtotal (additive method, QC since 2013).

**Rates map**:
```
AB, NT, NU, YT → { gst: 5% }
BC             → { gst: 5%, pst: 7% }
MB             → { gst: 5%, pst: 7% }
ON             → { hst: 13% }
QC             → { gst: 5%, qst: 9.975% }
SK             → { gst: 5%, pst: 6% }
NS, NB, PEI, NL → { hst: 15% }
```

**Rationale**: Provincial tax rates are federal/provincial law — they change very infrequently (budget cycles). Storing in DB adds admin overhead with near-zero benefit. Hardcoding with a named constant makes audit trivial.

**Alternatives considered**:
- DB-driven tax rules table: Rejected for Phase 4 — adds schema complexity for rates that rarely change. Can be migrated to DB in a future hardening phase if needed.
- Apply tax per-line-item: Rejected — Canadian practice is to apply tax to the order subtotal, not per item.

---

## Decision 4: Order Number Generation

**Decision**: A dedicated `facility_sequences` table with `(facility_id, resource_type, next_val)`. Inside the order creation transaction, the row is locked with `SELECT FOR UPDATE`, `next_val` is incremented, and the number is formatted as `ORD-{zero-padded-5-digits}` (e.g., `ORD-00001`).

**Rationale**: This is the standard pattern for facility-scoped human-readable identifiers. `SELECT FOR UPDATE` on a single sequence row is effectively a mutex — no two concurrent transactions in the same facility can get the same number. The `facility_sequences` table is facility-scoped with RLS, so `app_user` can update it within `withTenantContext`.

**Alternatives considered**:
- PostgreSQL SEQUENCE per facility: Rejected — sequences can't easily be scoped to a tenant in a shared schema.
- `MAX(order_number_int) + 1`: Rejected — race condition under concurrent order placement.
- UUID as order number: Rejected — not human-readable (spec requires human-readable order numbers).

---

## Decision 5: Concurrency-Safe Stock Decrement at Order Placement

**Decision**: Reuse the exact same `SELECT FOR UPDATE` pattern from Phase 3 inventory management. `lockInventoryRecord(tx, productId, variantId)` is called for each order line item inside the `withTenantContext` transaction. If any item is insufficient, the entire transaction is rolled back. Stock is decremented via `insertInventoryTransaction` (append-only record) + `updateInventoryQuantity`.

**Rationale**: Phase 3 already proved this pattern works (INV-040 concurrency test). Reusing it avoids duplication and keeps inventory state consistent — all stock changes go through `inventory_transactions`, maintaining the audit trail.

**Alternatives considered**:
- Optimistic locking with version counter: Rejected — more complex, requires retry logic, and Phase 3 SELECT FOR UPDATE already handles this cleanly.

---

## Decision 6: Checkout Preview vs Order Placement (Two-Phase)

**Decision**: Two distinct endpoints:
1. `POST /api/v1/checkout/preview` — computes totals (address + shipping method → subtotal + tax + shipping + total) and validates stock. Does NOT create any DB records. Returns a preview token (short-lived, signed, contains the computed totals hash) that the frontend must submit with order placement to confirm the user saw accurate totals.
2. `POST /api/v1/checkout/place` — accepts the preview token + confirmation. Re-computes all totals server-side from scratch (the preview token is only for UX confirmation, NOT trusted for amounts). Uses SELECT FOR UPDATE for stock. Creates order + line items + first status history entry. Clears cart.

**Note on preview token**: The preview token is a convenience for UX flow validation only — the server recalculates everything from scratch at placement regardless. This prevents the "silent price change between preview and confirm" scenario.

**Rationale**: Clean separation of "show me what I'll pay" (read-only, no DB writes) and "commit the purchase" (transactional, locks stock). Matches e-commerce best practices (Shopify, Stripe Payment Intents pattern).

**Alternatives considered**:
- Single endpoint (preview + place in one call): Rejected — user never sees totals before committing.
- Trust preview totals at placement: Rejected — violates constitution principle and spec FR-016 ("re-validate stock and recalculate all totals server-side at the moment of order placement").

---

## Decision 7: Shipping Methods

**Decision**: A `shipping_methods` table (facility-scoped, admin-managed) lives under the catalogue module. Each method has a `name`, `flat_rate` (numeric), `estimated_days_min`, `estimated_days_max`, and `is_active`. Admin CRUD via `shipping-methods.manage` permission. Public GET endpoint (with `resolveFacility`) for checkout to list available options.

**Rationale**: Keeps all catalogue/commercial configuration in one module. Flat-rate is sufficient for Phase 4 (spec assumption).

---

## Decision 8: Order Status Transition Enforcement

**Decision**: A compile-time constant map in `order.types.ts`:
```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['ready'],
  ready:      ['shipped'],
  shipped:    ['delivered'],
  delivered:  ['refunded'],
  cancelled:  [],
  refunded:   [],
};
```
Service validates `VALID_TRANSITIONS[currentStatus].includes(newStatus)` before any status update. Throws `INVALID_STATUS_TRANSITION` (422) if not valid. Terminal statuses (`cancelled`, `refunded`) have empty arrays → all transitions rejected.

**Rationale**: State machine as a constant is readable, testable, and impossible to bypass. Any change to the allowed transitions is a deliberate code change (not a DB config change), which is appropriate for a compliance-sensitive workflow.

---

## Decision 9: New Permissions Required

Two new permissions added to the permissions seed:
- `orders.read` — view all facility orders (admin/staff)
- `orders.manage` — advance status, cancel, initiate refund (admin/staff)
- `shipping-methods.manage` — create/update/deactivate shipping methods (admin)

Patients access their own orders via their authenticated session (no special permission — service enforces `order.patientId === req.auth.userId`).

---

## Decision 10: `facility_sequences` Table and RLS

The `facility_sequences` table will have RLS like all other facility-scoped tables, with the policy `facility_id = current_facility_id()`. The `app_user` role will have SELECT and UPDATE grants. This allows the order creation service (running under `withTenantContext`) to lock and increment the sequence safely.

Initial row for `order` resource type is inserted per-facility when the facility is created (or on-demand with `INSERT ... ON CONFLICT DO NOTHING` + upsert pattern).

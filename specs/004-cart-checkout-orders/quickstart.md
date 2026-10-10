# Quickstart: Cart, Checkout & Orders

Validate that the feature works end-to-end by following the scenarios below.

---

## Prerequisites

1. Backend running: `npm run dev` in `backend/` (port 3001)
2. Database migrated: `npm run db:migrate` in `backend/`
3. Test facilities seeded: `npm run db:seed:facilities` in `backend/`
4. Platform modules seeded: `npm run db:seed` in `backend/`
5. An authenticated test user exists in the `test-pharmacy` facility with `orders.manage` and `shipping-methods.manage` permissions
6. All tools use header `X-Facility-ID: <test-pharmacy-facility-id>`

---

## Scenario 1: Guest Add to Cart, Merge on Login

### Setup
- No auth required for guest steps

### Steps
1. `POST /api/v1/cart/items` (guest — no auth, X-Facility-ID set)
   - Body: `{ "productId": "<active-product-id>", "quantity": 2 }`
   - **Expected**: 201, body has `data.items[0].quantity = 2`, response sets `Set-Cookie: medisyn_cart=<uuid>`

2. `GET /api/v1/cart` (guest — send `medisyn_cart` cookie)
   - **Expected**: 200, `data.itemCount = 1`, `data.items[0].quantity = 2`

3. Login to get a JWT (user with an existing empty cart)

4. `POST /api/v1/cart/merge` (authenticated)
   - Body: `{ "cartToken": "<uuid from cookie>" }`
   - **Expected**: 200, merged cart contains the item, response includes `Set-Cookie: medisyn_cart=; Max-Age=0`

---

## Scenario 2: Checkout Preview → Place Order

### Setup
- Authenticated user with items in cart
- An active shipping method exists (create one via admin endpoints first)

### Steps
1. `POST /api/v1/checkout/preview`
   - Body: `{ "shippingAddress": { "street": "123 Main St", "city": "Toronto", "province": "ON", "postalCode": "M5V 2T6", "country": "CA" }, "shippingMethodId": "<id>" }`
   - **Expected**: 200, `data.breakdown.taxBreakdown` contains `{ type: "HST", rate: "0.13" }`, `data.previewToken` present

2. `POST /api/v1/checkout/place`
   - Body: `{ "previewToken": "<token>", "shippingAddress": { ... same ... }, "shippingMethodId": "<id>" }`
   - **Expected**: 201, `data.orderNumber` matches `ORD-00001` format, `data.status = "pending"`, cart is now empty

3. `GET /api/v1/cart` → **Expected**: 200, `data.itemCount = 0`

---

## Scenario 3: Province Tax Validation

Verify each tax type is computed correctly:

| Province | Expected Tax Type | Expected Rate |
|----------|-----------------|---------------|
| ON | HST | 13% |
| AB | GST | 5% |
| BC | GST + PST | 5% + 7% |
| QC | GST + QST | 5% + 9.975% |
| NS | HST | 15% |

Use `POST /checkout/preview` with each province and verify `data.breakdown.taxBreakdown` shape.

---

## Scenario 4: Concurrent Stock Enforcement

Run two simultaneous `POST /checkout/place` requests for the same product where combined quantity exceeds stock.

**Expected**: One succeeds (201), one fails (422, `INSUFFICIENT_STOCK`). Final inventory reflects only one order's decrement.

---

## Scenario 5: Order Status Lifecycle (Admin)

1. Admin `PATCH /api/v1/admin/orders/:id/status` → `{ "newStatus": "confirmed" }`
   - **Expected**: 200, `data.status = "confirmed"`, statusHistory has 2 entries

2. Attempt `PATCH` → `{ "newStatus": "pending" }` (invalid reverse transition)
   - **Expected**: 422, `error.code = "INVALID_STATUS_TRANSITION"`

3. `PATCH` → `{ "newStatus": "cancelled" }` from `confirmed`
   - **Expected**: 200, `data.status = "cancelled"`, inventory restored (each line item quantity added back)

---

## Scenario 6: Order Number Sequencing

Place two orders in the same facility rapidly.

**Expected**: `ORD-00001` and `ORD-00002` (no gaps, no duplicates).

---

## Scenario 7: Security — Patient Can Only See Own Orders

User A places an order. User B tries to access `GET /api/v1/orders/<user-A-order-id>`.

**Expected**: 404 (not 403 — don't leak existence)

---

## Scenario 8: Shipping Methods CRUD

1. `POST /api/v1/admin/shipping-methods` → `{ "name": "Express", "flatRate": 24.99, "estimatedDaysMin": 1, "estimatedDaysMax": 2 }`
   - **Expected**: 201

2. `GET /api/v1/shipping-methods` (public, no auth) → **Expected**: 200, includes "Express"

3. `PATCH /api/v1/admin/shipping-methods/:id/deactivate`
   - **Expected**: 200, `isActive = false`

4. `GET /api/v1/shipping-methods` (public) → **Expected**: 200, "Express" NOT listed

---

## Key References

- Tax rates: `backend/src/lib/tax-rates.ts`
- Status machine: `specs/004-cart-checkout-orders/data-model.md#state-machine-order-status`
- API contracts:
  - Cart: `specs/004-cart-checkout-orders/contracts/cart.md`
  - Checkout: `specs/004-cart-checkout-orders/contracts/checkout.md`
  - Orders: `specs/004-cart-checkout-orders/contracts/orders.md`
  - Shipping Methods: `specs/004-cart-checkout-orders/contracts/shipping-methods.md`

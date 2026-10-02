# Batch & Lot Inventory Management — Implementation Plan
**Status:** PENDING — not yet started  
**Created:** 2026-09-27  
**Owner:** Soel Shaikh

---

## 0. Why FEFO, Not FIFO

**CONFIRMED decision: FEFO (First Expired, First Out)**

For pharmaceutical products, FEFO is the correct strategy — not FIFO. Reasons:

| Concern | Why it matters |
|---|---|
| Expiry-critical stock | A batch received yesterday but expiring in 2 weeks must ship before a batch received 6 months ago expiring in 2 years |
| Patient safety | Dispensing expired medication is a health risk and a regulatory violation |
| Regulatory standard | FDA 21 CFR 211, Health Canada regulations, and pharmacy software industry standard all require FEFO |
| FIFO fallback | When two batches have the same expiry date, FIFO (earlier received date first) is used as a tiebreaker |

---

## 1. What Is Missing Today

Current product inventory UI shows only:
- Qty in stock (single number)
- Low stock at (threshold)
- Tracking: Enabled/Disabled
- Adjust Stock (manual +/-)

**What is missing:**
- Batch / lot numbers
- Expiry dates per batch
- Manufacture dates
- Per-batch quantity tracking
- FEFO allocation at fulfillment
- Inventory movement audit trail
- Batch selection UI during order fulfillment (shipped status)

---

## 2. Core Concepts

### Batch (Lot)
A specific production run of a product. Example — "Dolo 650mg":
```
Batch A  |  Lot# DOLO-2024-B01  |  Expiry: 2025-03-31  |  Qty: 20
Batch B  |  Lot# DOLO-2024-B02  |  Expiry: 2025-07-31  |  Qty: 15
Batch C  |  Lot# DOLO-2024-B03  |  Expiry: 2026-01-31  |  Qty: 30
Batch D  |  Lot# DOLO-2025-B01  |  Expiry: 2026-09-30  |  Qty: 10
Batch E  |  Lot# DOLO-2025-B02  |  Expiry: 2027-03-31  |  Qty: 25
                                         Total stock: 100
```

### FEFO Order of Picking
When an order for 35 units arrives:
```
Step 1: Take all 20 from Batch A (expires soonest)
Step 2: Take 15 from Batch B
Step 3: Done — 35 units allocated
```

---

## 3. Fulfillment Flow — Two Phases

### Phase A: Checkout (customer places order)
```
Customer adds product to cart → checkout
  ↓
System checks availability:
  SUM(currentQty) of active, non-expired batches for product
  Must be >= ordered quantity
  ↓
If available:
  System runs FEFO allocation silently:
    Sort batches by expiryDate ASC, then receivedDate ASC (tiebreaker)
    Greedily assign until qty satisfied
    Store result as orderBatchAllocations on the order document:
      [{ batchId, batchNumber, expiryDate, allocatedQty }]
  ↓
  Decrement each batch's reservedQty (soft hold — not yet fulfilled)
  Product's aggregateStock cache decrements by ordered qty
```

### Phase B: Fulfillment (admin marks order as "shipped")
```
Admin opens order → clicks "Mark as Shipped"
  ↓
System shows batch confirmation modal:
  Pre-filled with FEFO-allocated batches from Phase A
  Admin can:
    a) Confirm as-is (one click — most common)
    b) Override — select different batches / adjust split quantities
  ↓
On confirm:
  Release reservedQty on each batch
  Decrement currentQty on each (confirmed) batch
  Create inventory movement records for audit
  Order moves to "shipped" status
```

**Why two phases?**

| Single phase (checkout only) | Two phases (recommended) |
|---|---|
| Batch allocated at checkout but admin may pick from different physical batch | Preserves admin override at physical picking time |
| No flexibility if a batch is damaged/recalled after checkout | Admin can swap before shipping |
| Simpler DB | Audit trail spans both reservation and fulfillment |

---

## 4. Data Model

### 4a. `product_batches` collection

```typescript
{
  _id: ObjectId,
  productId: ObjectId,          // ref → products
  batchNumber: string,          // e.g., "DOLO-2024-B01" — unique per product
  expiryDate: Date,             // required — drives FEFO
  manufacturedDate: Date | null,
  receivedDate: Date,           // when this batch was added to system — FIFO tiebreaker

  initialQty: number,           // qty when batch was created (integer, never changes)
  currentQty: number,           // qty remaining (decremented on fulfillment)
  reservedQty: number,          // qty held by pending/confirmed/processing orders
  availableQty: number,         // virtual: currentQty - reservedQty (or stored as computed)

  status: "active" | "depleted" | "expired" | "recalled",
  // "depleted": currentQty = 0
  // "expired": expiryDate < today (system auto-flags, configurable lead time)
  // "recalled": admin manually recalled this batch

  notes: string,                // e.g., "Received from supplier X", "Temperature excursion"
  recallReason: string | null,
  recalledAt: Date | null,
  recalledBy: ObjectId | null,  // admin user

  supplier: string | null,      // optional supplier/vendor name
  purchaseOrderRef: string | null,

  createdBy: ObjectId,          // admin who added batch
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes:**
- `{ productId, batchNumber }` — unique (no duplicate batch# per product)
- `{ productId, status, expiryDate }` — FEFO query index
- `{ expiryDate, status }` — expiry alert dashboard query
- `{ status }` — filtering active/recalled

---

### 4b. `inventory_movements` collection

Full audit trail of every stock change.

```typescript
{
  _id: ObjectId,
  productId: ObjectId,          // ref → products
  batchId: ObjectId,            // ref → product_batches
  batchNumber: string,          // snapshot (in case batch is later recalled)

  movementType:
    | "batch_received"          // new batch added
    | "order_reserved"          // checkout: qty held
    | "order_fulfilled"         // shipped: reservation converted to fulfillment
    | "reservation_released"    // order cancelled: reservation reversed
    | "manual_adjustment"       // admin +/- stock
    | "batch_recalled"          // batch pulled from stock
    | "expired_writeoff",       // manual expiry writeoff

  qty: number,                  // positive = stock in, negative = stock out
  qtyBefore: number,            // currentQty before this movement (snapshot)
  qtyAfter: number,             // currentQty after this movement (snapshot)

  orderId: ObjectId | null,     // ref → orders (null for manual ops)
  orderNumber: string | null,   // snapshot

  performedBy: ObjectId | null, // admin user (null for system-automated)
  notes: string,

  createdAt: Date,
}
```

**Indexes:**
- `{ productId, createdAt }`
- `{ batchId, createdAt }`
- `{ orderId }` — look up all movements for an order
- `{ movementType, createdAt }`

---

### 4c. Changes to `orders` collection (extend existing schema)

Add to existing order document:
```typescript
// New field on IOrder
batchAllocations: Array<{
  productId: ObjectId,
  productName: string,         // snapshot
  batchId: ObjectId,
  batchNumber: string,         // snapshot
  expiryDate: Date,            // snapshot
  allocatedQty: number,
  fulfilledQty: number | null, // null until shipped; may differ if admin overrides
  allocationStage: "reserved" | "fulfilled",
}>
```

---

### 4d. Changes to `products` collection (extend existing schema)

Replace single `stock` number with:
```typescript
// Keep for backwards compatibility + performance (cache)
stock: number,               // aggregateStock = SUM(currentQty - reservedQty) of active non-expired batches
                             // Updated whenever batch quantities change
lowStockAt: number,          // unchanged
trackInventory: boolean,     // unchanged

// New
batchTrackingEnabled: boolean,  // false = old behavior (no batches); true = batch mode
totalBatches: number,           // count of active batches (cache)
nearExpiryAlertDays: number,    // default 90 — alert when batch expires within N days
```

**Migration strategy:** All existing products default to `batchTrackingEnabled: false`. Admin enables per product and then starts adding batches. When enabled, the existing `stock` value becomes the base for an "opening" batch with no expiry (or admin must add batches manually).

---

## 5. FEFO Allocation Algorithm

```typescript
function fefoAllocate(
  batches: ProductBatch[],    // active, non-expired, sorted by expiryDate ASC then receivedDate ASC
  requiredQty: number
): AllocationResult[] {
  const allocations: AllocationResult[] = []
  let remaining = requiredQty

  for (const batch of batches) {
    if (remaining <= 0) break
    const available = batch.currentQty - batch.reservedQty
    if (available <= 0) continue
    const take = Math.min(available, remaining)
    allocations.push({ batchId: batch._id, batchNumber: batch.batchNumber,
                        expiryDate: batch.expiryDate, allocatedQty: take })
    remaining -= take
  }

  if (remaining > 0) {
    throw new InsufficientStockError(`Only ${requiredQty - remaining} of ${requiredQty} units available`)
  }

  return allocations
}
```

MongoDB query for eligible batches:
```typescript
ProductBatch.find({
  productId,
  status: 'active',
  expiryDate: { $gt: new Date() },  // not expired
}).sort({ expiryDate: 1, receivedDate: 1 })   // FEFO then FIFO tiebreaker
```

---

## 6. Admin Batch Confirmation Modal (UI — Shipped Status)

When admin clicks "Mark as Shipped" on an order:

```
┌─────────────────────────────────────────────────────┐
│  Confirm Batch Allocation                            │
│  Order #ORD-2026-000123                              │
├─────────────────────────────────────────────────────┤
│  Product: Dolo 650mg                 Ordered: 35    │
│                                                     │
│  ✓ Batch DOLO-2024-B01  Exp: Mar 2025   20 units   │
│  ✓ Batch DOLO-2024-B02  Exp: Jul 2025   15 units   │
│                                    Total: 35 units  │
│                                                     │
│  [Override Batches]           [Confirm & Ship]      │
├─────────────────────────────────────────────────────┤
│  Product: Paracetamol 500mg          Ordered: 10    │
│  ✓ Batch PARA-2025-B03  Exp: Jan 2026   10 units   │
│                                    Total: 10 units  │
│                                                     │
│  [Override Batches]           [Confirm & Ship]      │
└─────────────────────────────────────────────────────┘
```

**Override flow:**
- Admin clicks "Override Batches"
- Dropdown of all available batches for that product (sorted FEFO, showing qty/expiry)
- Admin can split across batches
- System validates: SUM of override quantities = ordered quantity
- System validates: no batch currentQty - reservedQty goes negative

---

## 7. Product Admin UI Changes

### 7a. Product Detail — Inventory Section (replace current)

```
┌─────────────────────────────────────────────────────────┐
│  Inventory                                               │
│                                                          │
│  Batch Tracking        [Toggle: Enabled]                 │
│  Aggregate Stock       100 units                         │
│  Reserved              35 units (3 pending orders)       │
│  Available             65 units                          │
│  Low Stock At          10                                │
│  Near-Expiry Alert     Within 90 days                    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Batches                                    [+ Add Batch]│
│                                                          │
│  Batch #         Expiry      Qty   Reserved  Status      │
│  DOLO-2024-B01   Mar 2025    20     5        ⚠ Near Exp  │
│  DOLO-2024-B02   Jul 2025    15     10       Active      │
│  DOLO-2024-B03   Jan 2026    30     20       Active      │
│  DOLO-2025-B01   Sep 2026    10     0        Active      │
│  DOLO-2025-B02   Mar 2027    25     0        Active      │
│                                              [Recall]    │
└─────────────────────────────────────────────────────────┘
```

### 7b. Add Batch Form

```
Batch Number*         [__________________________]
Expiry Date*          [MM/YYYY]
Manufactured Date     [MM/YYYY]
Initial Quantity*     [______]
Supplier              [__________________________]
Purchase Order Ref    [__________________________]
Notes                 [__________________________]
                                          [Save Batch]
```

### 7c. Manual Stock Adjustment (existing Adjust Stock button)
When batch tracking is enabled:
- Must select which batch to adjust
- Must provide reason
- Creates `manual_adjustment` movement record

---

## 8. Near-Expiry Alerts

Batches expiring within `nearExpiryAlertDays` (default 90):
- Flagged with ⚠ in product batch list
- Shown in admin dashboard widget: "X batches expiring within 90 days"
- Admin can set alert threshold per product

Auto-status transitions (background job or on-read):
- If `expiryDate < now` and `status === 'active'` → status becomes `expired`
- Expired batches excluded from FEFO allocation automatically

---

## 9. Products Without Batch Tracking

When `batchTrackingEnabled: false`:
- Existing behavior preserved exactly (single stock number, adjust stock modal)
- No batch modal at fulfillment
- No FEFO allocation
- Checkout uses existing `$inc` stock decrement

This allows gradual rollout — admin enables batch tracking per product when ready.

---

## 10. Phase-by-Phase Task Breakdown

### Phase 1 — Architecture Validation
- [ ] Read `backend/src/modules/products/products.schema.ts` — exact stock fields
- [ ] Read `backend/src/modules/orders/orders.service.ts` — checkout stock deduction logic
- [ ] Read `backend/src/modules/orders/orders.schema.ts` — confirm order status enum
- [ ] Confirm: does `updateOrderStatus` have a hook point for "shipped"?
- [ ] Confirm: how does existing `Adjust Stock` work backend-side?
- [ ] Identify all places that read/write `product.stock`

### Phase 2 — Backend Foundation
- [ ] `backend/src/modules/inventory/productBatch.schema.ts`
- [ ] `backend/src/modules/inventory/inventoryMovement.schema.ts`
- [ ] `backend/src/modules/inventory/inventory.service.ts`
  - [ ] `addBatch()`
  - [ ] `fefoAllocate()` — pure function, testable
  - [ ] `reserveBatches()` — called on checkout
  - [ ] `fulfillBatches()` — called on shipped
  - [ ] `releaseReservations()` — called on cancellation
  - [ ] `recallBatch()`
  - [ ] `manualAdjustment()`
  - [ ] `getNearExpiryBatches()`
  - [ ] `getProductBatches()`
- [ ] Extend `orders.schema.ts` — add `batchAllocations[]`
- [ ] Modify `orders.service.ts` — `checkout()`: call `reserveBatches()` when batch tracking enabled
- [ ] Modify `orders.service.ts` — `updateOrderStatus()`: on `shipped`, call `fulfillBatches()`
- [ ] Modify `orders.service.ts` — `cancelMyOrder()`: call `releaseReservations()`
- [ ] Extend `products.schema.ts` — add `batchTrackingEnabled`, `nearExpiryAlertDays`

### Phase 3 — Inventory API Routes
- [ ] `backend/src/modules/inventory/inventory.routes.ts`
  - [ ] `GET /admin/products/:id/batches` — list all batches for product
  - [ ] `POST /admin/products/:id/batches` — add new batch
  - [ ] `PATCH /admin/products/:id/batches/:batchId` — edit (notes/dates only — qty via adjustment)
  - [ ] `POST /admin/products/:id/batches/:batchId/recall` — recall batch
  - [ ] `POST /admin/products/:id/batches/:batchId/adjust` — manual qty adjustment
  - [ ] `GET /admin/products/:id/batches/:batchId/movements` — movement history
  - [ ] `GET /admin/inventory/near-expiry` — dashboard: batches expiring soon
  - [ ] `GET /admin/inventory/movements` — global movement log

### Phase 4 — Order Fulfillment Batch Confirmation API
- [ ] `GET /admin/orders/:id/batch-allocations` — current allocations for order
- [ ] `POST /admin/orders/:id/confirm-batches` — confirm or override allocations before marking shipped
- [ ] Modify `PATCH /admin/orders/:id/status` — if status = shipped, require batch confirmation first (or auto-confirm FEFO if no override)

### Phase 5 — Admin UI

**Product changes:**
- [ ] Replace existing Inventory section in product detail page
- [ ] Batch list table (batchNumber, expiry, qty, reserved, status, recall action)
- [ ] Add Batch modal form
- [ ] Edit batch notes/dates modal
- [ ] Recall batch modal (with reason)
- [ ] Manual adjust stock modal (now requires batch selection when enabled)

**Order fulfillment:**
- [ ] Batch confirmation modal on "Mark as Shipped" action
- [ ] Override batch selection UI
- [ ] Show batchAllocations on order detail (read-only after shipped)

**Dashboard widgets:**
- [ ] Near-expiry alert widget (X batches expiring in 90 days)
- [ ] Inventory movements tab on product detail

**Inventory section (new nav item):**
- [ ] Near-expiry batches list page (`/inventory/near-expiry`)
- [ ] Global movement log page (`/inventory/movements`)

---

## 11. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Race: two orders checkout simultaneously, both allocate from same batch | HIGH | Atomic `$inc` on `reservedQty` with check; MongoDB findOneAndUpdate |
| R2 | Batch recalled after order reserved but before shipped | MEDIUM | Recall endpoint checks reservedQty > 0 — warns admin, forces re-allocation |
| R3 | Existing checkout code doesn't call FEFO — stock deducted from aggregate only | HIGH | Wrap in feature flag `batchTrackingEnabled`; no change for non-batch products |
| R4 | Admin marks shipped without confirming batches | MEDIUM | API requires batch confirmation step; auto-confirm FEFO if no override needed |
| R5 | Batch expiry date passes while units are reserved | MEDIUM | FEFO query filters `expiryDate > now` — expired batch not picked; admin alerted |
| R6 | product.stock cache drifts from actual batch sum | MEDIUM | Recalculate cache on every batch operation; add periodic reconcile job |
| R7 | Cancellation doesn't release reservations | HIGH | `cancelMyOrder()` explicitly calls `releaseReservations()` — unit tested |
| R8 | Manual adjustment bypasses audit trail | HIGH | All stock changes go through `InventoryService.manualAdjustment()` — creates movement record |

---

## 12. Files to Create / Modify Summary

### New files
```
backend/src/modules/inventory/
  productBatch.schema.ts
  inventoryMovement.schema.ts
  inventory.service.ts
  inventory.routes.ts
  inventory.validation.ts

admin/src/api/inventory.api.ts
admin/src/hooks/useInventory.ts
admin/src/app/(dashboard)/products/[id]/components/BatchList.tsx
admin/src/app/(dashboard)/products/[id]/components/AddBatchModal.tsx
admin/src/app/(dashboard)/products/[id]/components/AdjustBatchModal.tsx
admin/src/app/(dashboard)/products/[id]/components/RecallBatchModal.tsx
admin/src/app/(dashboard)/orders/[id]/components/BatchConfirmModal.tsx
admin/src/app/(dashboard)/inventory/near-expiry/page.tsx
admin/src/app/(dashboard)/inventory/movements/page.tsx
```

### Modified files
```
backend/src/modules/products/products.schema.ts   ← add batchTrackingEnabled, nearExpiryAlertDays
backend/src/modules/orders/orders.schema.ts       ← add batchAllocations[]
backend/src/modules/orders/orders.service.ts      ← checkout + shipped + cancel hooks
backend/src/app.ts                                ← register inventory module

admin/src/types/admin.ts                          ← add Batch, InventoryMovement interfaces
admin/src/app/(dashboard)/products/[id]/page.tsx  ← replace Inventory section
admin/src/app/(dashboard)/orders/[id]/page.tsx    ← add batch confirmation to shipped action
admin/src/components/common/AdminSidebar.tsx      ← add Inventory nav section
```

---

## 13. Open Questions (None Blocking)

| # | Question | Default if not answered |
|---|---|---|
| OQ1 | Should the system auto-expire batches by cron, or flag on-read? | Flag on-read + near-expiry dashboard |
| OQ2 | Can admin split one ordered item across 3+ batches? | Yes — any number of batches, must sum to ordered qty |
| OQ3 | Should recalled batch movements trigger a customer notification? | No — internal operation only |
| OQ4 | Should batch numbers be auto-generated or always manual? | Always manual (pharmacy sets their own lot numbers from supplier) |
| OQ5 | What happens when batch tracking is enabled on a product with existing stock? | Admin must add opening batches manually — existing stock in "legacy" non-batch pool warns admin |
| OQ6 | Show batch numbers on customer-facing invoice PDF? | Yes — for traceability (expiry date + batch# on invoice line item) |

---

*Note: OQ6 connects directly to the Invoice Module plan (PLAN_invoice_module.md). Batch numbers and expiry dates from `batchAllocations` should appear on the invoice line items.*

---

## Research Sources

- [Pharmacy Inventory: Why FEFO Is Non-Negotiable — Rexolia](https://rexolia.com/blog/pharmacy-inventory-management-why-fefo-is-non-negotiable/)
- [FEFO vs FIFO vs LIFO: What Is the Difference — GMP Insiders](https://gmpinsiders.com/fefo-vs-fifo-vs-lifo/)
- [First Expired First Out Guide — ASC Software](https://ascsoftware.com/blog/fefo-inventory-management-guide/)
- [Batch & Expiry Date Management — Candela Pharmacy](https://www.candelapharmacy.com/batch-expiry-date-management/)
- [Managing Expiration Dates in Ecommerce — DCL Logistics](https://dclcorp.com/blog/fulfillment/managing-expiration-dates/)

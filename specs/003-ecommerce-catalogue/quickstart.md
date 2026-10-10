# Quickstart Validation Guide: Ecommerce Catalogue

**Feature**: Phase 3 — Ecommerce Catalogue
**Date**: 2026-10-09
**Purpose**: Runnable validation scenarios that prove the feature works end-to-end. Run after implementation (`/speckit-implement`) to verify all success criteria.

---

## Prerequisites

1. Docker containers running (from project root):
   ```bash
   cd backend/
   docker compose up -d
   ```

2. Migrations run (including the new catalogue migration):
   ```bash
   npm run db:migrate
   ```

3. Seed data loaded (includes catalogue permissions):
   ```bash
   npm run db:seed
   ```

4. Dev server running:
   ```bash
   npm run dev
   ```
   Server available at `http://localhost:3001`.

5. A test facility and admin user exist from Phase 2 seeds. Retrieve their IDs:
   ```bash
   # From psql or your DB tool:
   SELECT id, slug FROM facilities LIMIT 1;
   SELECT u.id, u.email FROM users u LIMIT 1;
   ```

---

## Step 1 — Authenticate and get a token

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test1234!","facilityId":"<FACILITY_ID>"}' \
  | jq '.data.accessToken'
```

Store the access token as `$TOKEN` for subsequent requests.

---

## Step 2 — Create a category (SC-007: requires auth + permission)

```bash
curl -s -X POST http://localhost:3001/api/v1/catalogue/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Vitamins & Supplements","displayOrder":0}' \
  | jq .
```

**Expected**: `201` with `id` and auto-generated `slug: "vitamins-supplements"`.

Store the category ID as `$CAT_ID`.

---

## Step 3 — Create a subcategory

```bash
curl -s -X POST http://localhost:3001/api/v1/catalogue/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Vitamin C\",\"parentId\":\"$CAT_ID\"}" \
  | jq .
```

**Expected**: `201` with `parentId` set.

Store as `$SUBCAT_ID`.

---

## Step 4 — Create a product with variants (SC-001: appears in listing within 3s)

```bash
curl -s -X POST http://localhost:3001/api/v1/catalogue/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d "{
    \"sku\": \"VITC-001\",
    \"name\": \"Vitamin C\",
    \"categoryId\": \"$SUBCAT_ID\",
    \"price\": \"12.99\",
    \"variantDimensionLabel\": \"Strength\",
    \"variants\": [
      {\"sku\": \"VITC-500MG\", \"dimensionValue\": \"500mg\", \"price\": \"12.99\"},
      {\"sku\": \"VITC-1000MG\", \"dimensionValue\": \"1000mg\", \"price\": \"18.99\"}
    ]
  }" \
  | jq .
```

**Expected**: `201` with product `id`. Two variants created. Inventory records for each variant auto-created with `quantity: 0`.

Store as `$PRODUCT_ID`.

---

## Step 5 — Public listing (SC-002: under 1s; SC-007: public access allowed)

```bash
curl -s http://localhost:3001/api/v1/catalogue/products \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data | length'
```

**Expected**: Returns at least 1 product. `stockStatus: "out_of_stock"` (quantity is 0). Response arrives in under 1 second.

---

## Step 6 — Category filter (including subcategory products)

```bash
curl -s "http://localhost:3001/api/v1/catalogue/products?category_id=$CAT_ID" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data[].name'
```

**Expected**: The "Vitamin C" product appears even though it's assigned to the subcategory (`$SUBCAT_ID`), not the root (`$CAT_ID`). This verifies recursive category filtering (FR-005).

---

## Step 7 — Keyword search (SC-003: under 1s)

```bash
curl -s "http://localhost:3001/api/v1/catalogue/products?search=vitamin+c" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data[].name'
```

**Expected**: "Vitamin C" product is returned. Response under 1 second.

---

## Step 8 — Category tree (SC-008: full tree in one request)

```bash
curl -s http://localhost:3001/api/v1/catalogue/categories \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.'
```

**Expected**: Root category "Vitamins & Supplements" appears with a `children` array containing "Vitamin C". No additional requests needed.

---

## Step 9 — Adjust inventory (SC-006: complete record; SC-005: concurrency-safe)

Add 50 units to the 500mg variant:

```bash
curl -s -X POST "http://localhost:3001/api/v1/catalogue/inventory/products/$PRODUCT_ID/adjust" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d "{\"variantId\":\"<VARIANT_500MG_ID>\",\"quantityDelta\":50,\"reason\":\"RESTOCK\",\"note\":\"Initial stock\"}" \
  | jq .
```

**Expected**: `200` with `resultingBalance: 50`. Check the history:

```bash
curl -s "http://localhost:3001/api/v1/catalogue/inventory/products/$PRODUCT_ID/history?variant_id=<VARIANT_500MG_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data[0]'
```

**Expected**: One record with `quantityDelta: 50`, `resultingBalance: 50`, `reason: "RESTOCK"`, `actorId` set.

---

## Step 10 — Negative stock rejection (FR-020)

```bash
curl -s -X POST "http://localhost:3001/api/v1/catalogue/inventory/products/$PRODUCT_ID/adjust" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d "{\"variantId\":\"<VARIANT_500MG_ID>\",\"quantityDelta\":-999,\"reason\":\"DAMAGED\"}" \
  | jq .
```

**Expected**: `409 INSUFFICIENT_STOCK`. Balance unchanged.

---

## Step 11 — Stock visibility in product listing (FR-007: out_of_stock shown, not hidden)

The 1000mg variant has never been stocked (quantity = 0). Fetch the product detail:

```bash
curl -s "http://localhost:3001/api/v1/catalogue/products/$PRODUCT_ID" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data.variants[] | {dimensionValue, stockStatus, quantity}'
```

**Expected**: 500mg shows `stockStatus: "in_stock"`, 1000mg shows `stockStatus: "out_of_stock"`. Both variants are present (not hidden).

---

## Step 12 — Create and validate a coupon

```bash
curl -s -X POST http://localhost:3001/api/v1/catalogue/coupons \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d '{"code":"save20","type":"PERCENTAGE","discountValue":"20","minOrderTotal":"50","maxDiscountAmount":"100","isActive":true}' \
  | jq .
```

**Expected**: `201`. Code stored as `"SAVE20"` (uppercased). Validate it:

```bash
curl -s -X POST http://localhost:3001/api/v1/catalogue/coupons/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d '{"code":"SAVE20","orderTotal":"75.00"}' \
  | jq .
```

**Expected**: `valid: true`, `effectiveDiscount: "15.00"` (20% of $75 = $15, under the $100 cap). `internalNotes` is absent from the response.

---

## Step 13 — Deactivate product (FR-007: disappears from public listing)

```bash
curl -s -X DELETE "http://localhost:3001/api/v1/catalogue/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data.isActive'
```

**Expected**: `false`. Then:

```bash
curl -s http://localhost:3001/api/v1/catalogue/products \
  -H "X-Facility-ID: <FACILITY_ID>" \
  | jq '.data | length'
```

**Expected**: `0` (deactivated product no longer appears in public listing).

---

## Step 14 — Authorization gate (SC-007)

```bash
# Unauthenticated write — should be 401
curl -s -X POST http://localhost:3001/api/v1/catalogue/products \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d '{"sku":"HACK","name":"Hack","price":"0"}' \
  | jq '.error.code'
```

**Expected**: `UNAUTHORIZED` (401).

---

## Step 15 — Cycle detection (FR-013)

```bash
# Attempt to set root category's parent to its own subcategory
curl -s -X PATCH "http://localhost:3001/api/v1/catalogue/categories/$CAT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Facility-ID: <FACILITY_ID>" \
  -H "Content-Type: application/json" \
  -d "{\"parentId\":\"$SUBCAT_ID\"}" \
  | jq '.error.code'
```

**Expected**: `CYCLE_DETECTED` (409).

---

## Acceptance Test Suite

Run the full integration test suite:

```bash
cd backend/
npm run test -- tests/catalogue/
```

**Expected**: All tests pass. Check individual files:
- `tests/catalogue/products.test.ts`
- `tests/catalogue/categories.test.ts`
- `tests/catalogue/inventory.test.ts`
- `tests/catalogue/coupons.test.ts`

---

## Success Criteria Verification

| SC | Criterion | Verified By |
|----|-----------|-------------|
| SC-001 | Product appears in listing within 3s of save | Step 4 + Step 5 |
| SC-002 | 10k-product listing < 1s | Load test (optional — not required for gate) |
| SC-003 | Keyword search < 1s | Step 7 |
| SC-004 | Concurrent adjustments = correct final balance | `inventory.test.ts` concurrency test |
| SC-005 | Coupon validation < 500ms | Step 12 |
| SC-006 | Every adjustment has complete record | Step 9 history check |
| SC-007 | Unauthenticated writes = 401/403 | Step 14 |
| SC-008 | Category tree in single request | Step 8 |

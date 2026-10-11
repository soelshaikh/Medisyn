# Quickstart: Admin Reports & Dashboard

**Feature**: 008-admin-reports-dashboard
**Purpose**: End-to-end validation scenarios to confirm each user story works after implementation.

---

## Prerequisites

1. Backend running: `npm run dev` in `backend/` (server at http://localhost:4000)
2. PostgreSQL and Redis running (Docker: `docker compose up -d`)
3. Facility seeded with test data: at least 5 orders in various statuses, 3 patients, 2 prescription requests with `status = 'submitted'`, 1 `pharmacist_conversation` with `status = 'open'`, 1 inventory record below its product's `low_stock_threshold`
4. Permission seed run: `npx tsx src/db/seeds/reports-permissions.ts` (creates `reports.read`)
5. Admin user with `reports.read` permission assigned; obtain JWT via `POST /api/v1/auth/login`

Store the token:
```sh
TOKEN="<your-jwt-here>"
BASE="http://localhost:4000/api/v1/admin/reports"
```

---

## Scenario 1 — Sales Report (User Story 1)

**Goal**: Revenue totals and product trends returned for a date range.

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/sales?from=2026-01-01&to=2026-12-31&period=monthly&limit=5" | jq .
```

**Expected**:
- HTTP 200
- `data.summary.totalRevenue` is a decimal string (e.g. `"1240.50"`)
- `data.summary.revenueStatuses` = `["shipped", "delivered"]`
- `data.trend` array has one entry per month in the range
- `data.topProducts` array has ≤5 items, sorted by `totalRevenue` descending
- `data.topProducts[].productId` may be `null` for deleted products; `productName` is always a non-empty string

**Verify revenue filter**: Pending and cancelled orders must NOT inflate `totalRevenue`. Cross-check: `SUM(total)` manually from your test data for delivered+shipped orders only.

---

## Scenario 2 — Invalid Date Range (User Story 1 — edge case)

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/sales?from=2026-12-01&to=2026-01-01" | jq .
```

**Expected**: HTTP 422, `error: "VALIDATION_ERROR"`, message references `from` must not be after `to`.

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/sales?from=2025-01-01&to=2026-12-31" | jq .
```

**Expected**: HTTP 422 — range exceeds 366 days.

---

## Scenario 3 — Order Report (User Story 2)

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/orders?from=2026-01-01&to=2026-12-31&period=weekly" | jq .
```

**Expected**:
- HTTP 200
- `data.summary.byStatus` contains all 8 keys: `pending, confirmed, processing, ready, shipped, delivered, cancelled, refunded` — zero for any that have no orders
- `data.summary.cancellationRate` is a float rounded to 1 decimal
- `data.summary.averageFulfillmentHours` is a float (or `null` if no shipped orders exist in range)
- `data.trend` has one entry per week bucket in the range

---

## Scenario 4 — Patient Report (User Story 3)

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/patients?from=2026-01-01&to=2026-12-31&period=monthly&limit=5" | jq .
```

**Expected**:
- HTTP 200
- `data.summary.newPatientsInRange` matches count of users with patient role who joined in range
- `data.summary.retentionRate` is a float (or `null` if zero patients with orders)
- `data.topPatients` sorted by `lifetimeSpend` descending; each entry has `userId, firstName, lastName, orderCount, lifetimeSpend`

---

## Scenario 5 — Dashboard Summary (User Story 4)

```sh
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/dashboard" | jq .
```

**Expected**:
- HTTP 200
- Response contains all 6 keys: `todayRevenue, todayOrderCount, newPatientsToday, openConversations, pendingPrescriptions, lowStockCount`
- `openConversations` ≥ 1 (matches seeded open conversation)
- `pendingPrescriptions` ≥ 2 (matches seeded submitted prescriptions)
- `lowStockCount` ≥ 1 (matches seeded low-stock inventory record)
- `asOf` is a valid ISO 8601 timestamp close to the current time

---

## Scenario 6 — Unauthorized Access (RBAC check)

Using a patient JWT (no `reports.read` permission):

```sh
PATIENT_TOKEN="<patient-jwt>"
curl -s -H "Authorization: Bearer $PATIENT_TOKEN" "$BASE/dashboard" | jq .
```

**Expected**: HTTP 403, `error: "FORBIDDEN"`.

---

## Scenario 7 — Empty Date Range (no orders)

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/sales?from=2000-01-01&to=2000-01-31" | jq .
```

**Expected**: HTTP 200, `data.summary.totalRevenue = "0.00"`, `data.summary.orderCount = 0`, `data.trend` contains buckets with zeroed values (not an empty array — buckets are always generated for the range).

---

## Scenario 8 — Default Parameters

```sh
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/sales" | jq .
```

**Expected**: HTTP 200. `data.from` = 30 days ago (date string), `data.to` = today (date string), `data.period` = `"monthly"`.

# API Contracts: Admin Reports & Dashboard

**Feature**: 008-admin-reports-dashboard
**Base path**: `/api/v1/admin/reports`
**Auth**: All endpoints require a valid JWT + `reports.read` RBAC permission. Facility-scoped (RLS).

---

## Common Query Parameters (all report endpoints)

| Parameter | Type | Required | Default | Validation |
|---|---|---|---|---|
| `from` | ISO 8601 date (`YYYY-MM-DD`) | No | 30 days ago | Must be ≤ `to` |
| `to` | ISO 8601 date (`YYYY-MM-DD`) | No | today | Must be ≥ `from` |
| `period` | `daily` \| `weekly` \| `monthly` | No | `monthly` | Enum — others rejected |

**Range constraint**: `to - from` must not exceed 366 days. Returns 422 if exceeded.

---

## GET /api/v1/admin/reports/sales

Returns revenue totals, order count, average order value, trend series, and top-selling products for the given date range.

### Request

```http
GET /api/v1/admin/reports/sales?from=2026-09-01&to=2026-09-30&period=daily&limit=10
Authorization: Bearer <token>
```

Additional parameter:
| Parameter | Type | Required | Default | Validation |
|---|---|---|---|---|
| `limit` | integer | No | 10 | 1–50 (top products count) |

### Response 200

```json
{
  "data": {
    "period": "daily",
    "from": "2026-09-01",
    "to": "2026-09-30",
    "summary": {
      "totalRevenue": "12450.75",
      "orderCount": 87,
      "averageOrderValue": "143.11",
      "revenueStatuses": ["shipped", "delivered"]
    },
    "trend": [
      { "bucket": "2026-09-01", "revenue": "540.00", "orderCount": 4 },
      { "bucket": "2026-09-02", "revenue": "720.50", "orderCount": 5 }
    ],
    "topProducts": [
      {
        "productId": "uuid-or-null",
        "productName": "Metformin 500mg",
        "totalRevenue": "3200.00",
        "unitsSold": 64,
        "orderCount": 18
      }
    ]
  }
}
```

**Field notes**:
- `totalRevenue`, `averageOrderValue`, `trend[].revenue`, `topProducts[].totalRevenue`: Decimal strings from PostgreSQL `numeric(10,2)`.
- `productId` may be `null` if the product was deleted after the order was placed. `productName` is always the snapshot value and will never be null.
- `trend` has one entry per bucket in the date range. Buckets with no orders still appear with `revenue: "0.00"` and `orderCount: 0` to enable continuous charting.

### Response 422 — Validation error

```json
{
  "error": "VALIDATION_ERROR",
  "message": "from must not be after to",
  "details": [{ "field": "from", "message": "from must not be after to" }]
}
```

---

## GET /api/v1/admin/reports/orders

Returns order count breakdown by status, cancellation rate, average fulfillment time, and daily volume trend.

### Request

```http
GET /api/v1/admin/reports/orders?from=2026-09-01&to=2026-09-30&period=daily
Authorization: Bearer <token>
```

### Response 200

```json
{
  "data": {
    "period": "daily",
    "from": "2026-09-01",
    "to": "2026-09-30",
    "summary": {
      "totalOrders": 102,
      "byStatus": {
        "pending": 8,
        "confirmed": 3,
        "processing": 5,
        "ready": 2,
        "shipped": 12,
        "delivered": 62,
        "cancelled": 9,
        "refunded": 1
      },
      "cancellationRate": 8.8,
      "averageFulfillmentHours": 14.2
    },
    "trend": [
      { "bucket": "2026-09-01", "orderCount": 4 },
      { "bucket": "2026-09-02", "orderCount": 3 }
    ]
  }
}
```

**Field notes**:
- `cancellationRate`: float, rounded to 1 decimal place. `(cancelled / totalOrders) * 100`.
- `averageFulfillmentHours`: float (hours), rounded to 1 decimal. Null if no shipped orders in range.
- `byStatus`: all 8 statuses always present, zero if none in range.

---

## GET /api/v1/admin/reports/patients

Returns new patient registration trend, total active count, retention rate, and top patients by lifetime spend.

### Request

```http
GET /api/v1/admin/reports/patients?from=2026-07-01&to=2026-09-30&period=monthly&limit=10
Authorization: Bearer <token>
```

Additional parameter:
| Parameter | Type | Required | Default | Validation |
|---|---|---|---|---|
| `limit` | integer | No | 10 | 1–50 (top patients count) |

### Response 200

```json
{
  "data": {
    "period": "monthly",
    "from": "2026-07-01",
    "to": "2026-09-30",
    "summary": {
      "newPatientsInRange": 34,
      "totalActivePatients": 412,
      "retentionRate": 61.3
    },
    "trend": [
      { "bucket": "2026-07-01", "newPatients": 11 },
      { "bucket": "2026-08-01", "newPatients": 13 },
      { "bucket": "2026-09-01", "newPatients": 10 }
    ],
    "topPatients": [
      {
        "userId": "uuid",
        "firstName": "Jane",
        "lastName": "Smith",
        "orderCount": 12,
        "lifetimeSpend": "1842.50"
      }
    ]
  }
}
```

**Field notes**:
- `totalActivePatients`: patients with ≥1 order OR ≥1 prescription request in the past 12 months from `to` date.
- `retentionRate`: float, 1 decimal. `(patients with ≥2 orders / patients with ≥1 order) * 100`. Null if zero patients with orders.
- `topPatients` sorted by `lifetimeSpend` descending. `lifetimeSpend` = all-time, not range-limited.

---

## GET /api/v1/admin/reports/dashboard

Single-call summary of all key facility metrics for the current day (UTC midnight to now).

### Request

```http
GET /api/v1/admin/reports/dashboard
Authorization: Bearer <token>
```

No query parameters. "Today" = UTC midnight of the current day to the current timestamp.

### Response 200

```json
{
  "data": {
    "asOf": "2026-10-11T14:32:00.000Z",
    "todayRevenue": "1240.50",
    "todayOrderCount": 9,
    "newPatientsToday": 2,
    "openConversations": 5,
    "pendingPrescriptions": 11,
    "lowStockCount": 3
  }
}
```

**Field notes**:
- `asOf`: server timestamp when the dashboard was computed.
- `todayRevenue`: sum of `orders.total` for orders with `status IN ('shipped', 'delivered')` created today (UTC).
- `openConversations`: count of `pharmacist_conversations` with `status = 'open'` (all-time, not just today — these are conversations awaiting staff attention).
- `pendingPrescriptions`: count of `prescription_requests` with `status IN ('submitted', 'under_review')` (all-time active backlog).
- `lowStockCount`: `inventory_records` where `quantity <= products.low_stock_threshold AND low_stock_threshold > 0 AND products.is_active = true`.

---

## Error Responses (all endpoints)

| Status | Code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but missing `reports.read` permission |
| 422 | `VALIDATION_ERROR` | Invalid query parameters (bad date format, `from > to`, range > 366 days, invalid period) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

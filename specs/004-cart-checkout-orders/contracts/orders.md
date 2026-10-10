# Contract: Orders API

Base path: `/api/v1/orders`

---

## GET /api/v1/orders (Patient — my orders)

List the authenticated patient's own orders. Patients only see their own orders.

**Auth**: Required (JWT, patient role implied — no special permission needed)

### Query Parameters
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | string | — | Filter by status enum |
| `page` | integer | 1 | |
| `limit` | integer | 20 | Max 100 |

### Response `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "orderNumber": "ORD-00001",
      "status": "pending",
      "itemCount": 2,
      "total": "39.35",
      "createdAt": "2026-10-09T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

## GET /api/v1/orders/:orderId (Patient — order detail)

Get full detail of one order. Patient must be the order owner.

**Auth**: Required (JWT)

### Response `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "orderNumber": "ORD-00001",
    "status": "pending",
    "shippingAddress": {
      "street": "123 Main St",
      "unit": "Apt 4B",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5V 2T6",
      "country": "CA"
    },
    "shippingMethod": {
      "name": "Standard Shipping",
      "flatRate": "9.99",
      "estimatedDaysMin": 3,
      "estimatedDaysMax": 7
    },
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "variantId": "uuid | null",
        "productName": "Vitamin D 1000IU",
        "variantLabel": "90 Capsules",
        "sku": "VIT-D-1000-90",
        "quantity": 2,
        "unitPrice": "12.99",
        "lineTotal": "25.98"
      }
    ],
    "breakdown": {
      "subtotal": "25.98",
      "taxBreakdown": [
        { "type": "HST", "rate": "0.13", "amount": "3.38" }
      ],
      "taxTotal": "3.38",
      "shippingCost": "9.99",
      "total": "39.35"
    },
    "statusHistory": [
      {
        "previousStatus": null,
        "newStatus": "pending",
        "note": null,
        "createdAt": "2026-10-09T14:30:00.000Z"
      }
    ],
    "createdAt": "2026-10-09T14:30:00.000Z",
    "updatedAt": "2026-10-09T14:30:00.000Z"
  }
}
```

**Note**: `notes` (internal admin notes) are NEVER included in patient-facing responses.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `ORDER_NOT_FOUND` | 404 | Order not found or not owned by caller |

---

## POST /api/v1/orders/:orderId/cancel (Patient self-cancel)

Patient may cancel their own order only when status is `pending`.

**Auth**: Required (JWT)

### Request Body
```json
{}
```
(empty body — no fields required)

### Response `200 OK`
Returns the updated order detail (same shape as GET /:orderId — without `notes`).

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `ORDER_NOT_FOUND` | 404 | Order not found or not owned by caller |
| `INVALID_STATUS_TRANSITION` | 422 | Order is not in `pending` status |

---

## GET /api/v1/admin/orders (Admin — list all facility orders)

List all orders for the facility. Requires `orders.read` permission.

**Auth**: Required (JWT + `orders.read` permission)

### Query Parameters
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | string | — | Filter by status |
| `patientId` | uuid | — | Filter by patient |
| `orderNumber` | string | — | Search by order number (partial match) |
| `dateFrom` | ISO date | — | Filter created_at >= |
| `dateTo` | ISO date | — | Filter created_at <= |
| `page` | integer | 1 | |
| `limit` | integer | 25 | Max 100 |
| `sort` | string | `createdAt:desc` | `createdAt:asc|desc`, `total:asc|desc` |

### Response `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "orderNumber": "ORD-00001",
      "status": "pending",
      "patientId": "uuid",
      "patientName": "Jane Doe",
      "itemCount": 2,
      "total": "39.35",
      "createdAt": "2026-10-09T14:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 1, "totalPages": 1 }
}
```

---

## GET /api/v1/admin/orders/:orderId (Admin — order detail)

Get full admin view of one order including internal notes.

**Auth**: Required (JWT + `orders.read` permission)

### Response `200 OK`
Same shape as patient GET /:orderId **plus**:
```json
{
  "data": {
    "...all patient fields...",
    "patientId": "uuid",
    "patientName": "Jane Doe",
    "notes": "Leave at door",
    "statusHistory": [
      {
        "previousStatus": null,
        "newStatus": "pending",
        "changedById": null,
        "changedByName": null,
        "note": null,
        "createdAt": "2026-10-09T14:30:00.000Z"
      }
    ]
  }
}
```

---

## PATCH /api/v1/admin/orders/:orderId/status (Admin — advance status)

Advance an order to the next status in the lifecycle.

**Auth**: Required (JWT + `orders.manage` permission)

### Request Body
```json
{
  "newStatus": "confirmed",
  "note": "Payment verified"
}
```

**Validation**:
- `newStatus`: must be a valid transition from the current status (see state machine in data-model.md)
- `note`: optional, max 500 chars

**Business rules**:
- Transitions to `cancelled`: triggers stock restoration (one `RETURN` inventory transaction per line item, within the same DB transaction)
- All transitions: append to `order_status_history`

### Response `200 OK`
Returns the updated admin order detail.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `ORDER_NOT_FOUND` | 404 | |
| `INVALID_STATUS_TRANSITION` | 422 | newStatus not valid from current status |

---

## POST /api/v1/admin/orders/:orderId/cancel (Admin cancel)

Admin cancel. Allowed from `pending` or `confirmed`.

**Auth**: Required (JWT + `orders.manage` permission)

### Request Body
```json
{
  "note": "Duplicate order"
}
```

### Response `200 OK`
Returns the updated admin order detail.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `ORDER_NOT_FOUND` | 404 | |
| `INVALID_STATUS_TRANSITION` | 422 | Order is already cancelled/refunded or past `confirmed` |

---

## PATCH /api/v1/admin/orders/:orderId/notes (Admin — update internal notes)

Update the internal notes on an order. Notes are never shown to patients.

**Auth**: Required (JWT + `orders.manage` permission)

### Request Body
```json
{
  "notes": "Customer called to confirm delivery address"
}
```

### Response `200 OK`
Returns the updated admin order detail.

---

## Error Response Shape (all endpoints)
```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot transition from 'delivered' to 'confirmed'",
    "statusCode": 422
  }
}
```

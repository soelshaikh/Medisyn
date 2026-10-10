# Contract: Shipping Methods API

Base path: `/api/v1/shipping-methods`

---

## GET /api/v1/shipping-methods (Public — list active options)

List all active shipping methods for the facility. Used by the checkout UI to present options. No auth required.

**Facility resolution**: `X-Facility-ID` header (required).

### Response `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Standard Shipping",
      "description": "Regular mail delivery",
      "flatRate": "9.99",
      "estimatedDaysMin": 3,
      "estimatedDaysMax": 7
    },
    {
      "id": "uuid",
      "name": "Express Shipping",
      "description": "Priority courier",
      "flatRate": "24.99",
      "estimatedDaysMin": 1,
      "estimatedDaysMax": 2
    },
    {
      "id": "uuid",
      "name": "Free Shipping",
      "description": "Standard 5–10 business days",
      "flatRate": "0.00",
      "estimatedDaysMin": 5,
      "estimatedDaysMax": 10
    }
  ]
}
```

Results are sorted by `display_order ASC, flat_rate ASC`.

---

## GET /api/v1/admin/shipping-methods (Admin — list all)

List all shipping methods for the facility (active + inactive).

**Auth**: Required (JWT + `shipping-methods.manage` permission)

### Response `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Standard Shipping",
      "description": "Regular mail delivery",
      "flatRate": "9.99",
      "estimatedDaysMin": 3,
      "estimatedDaysMax": 7,
      "isActive": true,
      "displayOrder": 0,
      "createdAt": "2026-10-09T12:00:00.000Z",
      "updatedAt": "2026-10-09T12:00:00.000Z"
    }
  ]
}
```

---

## POST /api/v1/admin/shipping-methods

Create a new shipping method.

**Auth**: Required (JWT + `shipping-methods.manage` permission)

### Request Body
```json
{
  "name": "Express Shipping",
  "description": "Priority courier",
  "flatRate": 24.99,
  "estimatedDaysMin": 1,
  "estimatedDaysMax": 2,
  "displayOrder": 1
}
```

**Validation**:
- `name`: required, non-empty string, max 100 chars. Unique per facility.
- `description`: optional string, max 500 chars
- `flatRate`: required, numeric ≥ 0, max 2 decimal places
- `estimatedDaysMin`: required, integer ≥ 0
- `estimatedDaysMax`: required, integer ≥ `estimatedDaysMin`
- `displayOrder`: optional, integer, default 0

### Response `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "name": "Express Shipping",
    "description": "Priority courier",
    "flatRate": "24.99",
    "estimatedDaysMin": 1,
    "estimatedDaysMax": 2,
    "isActive": true,
    "displayOrder": 1,
    "createdAt": "2026-10-09T12:00:00.000Z",
    "updatedAt": "2026-10-09T12:00:00.000Z"
  }
}
```

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `SHIPPING_METHOD_NAME_EXISTS` | 409 | Duplicate name in facility |
| `VALIDATION_ERROR` | 422 | Invalid field values |

---

## PATCH /api/v1/admin/shipping-methods/:id

Update a shipping method's fields. Partial update (PATCH semantics — only provided fields are updated).

**Auth**: Required (JWT + `shipping-methods.manage` permission)

### Request Body
Any subset of POST fields:
```json
{
  "flatRate": 19.99,
  "estimatedDaysMax": 5
}
```

### Response `200 OK`
Returns the updated shipping method (same shape as POST 201).

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `SHIPPING_METHOD_NOT_FOUND` | 404 | Not found in facility |
| `SHIPPING_METHOD_NAME_EXISTS` | 409 | New name conflicts with existing method |
| `VALIDATION_ERROR` | 422 | Invalid field values |

---

## PATCH /api/v1/admin/shipping-methods/:id/deactivate

Deactivate a shipping method. Existing orders referencing this method are unaffected (snapshot stored on order).

**Auth**: Required (JWT + `shipping-methods.manage` permission)

### Request Body
```json
{}
```

### Response `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "isActive": false,
    "...other fields..."
  }
}
```

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `SHIPPING_METHOD_NOT_FOUND` | 404 | |
| `SHIPPING_METHOD_ALREADY_INACTIVE` | 422 | Already inactive |

---

## Error Response Shape
```json
{
  "error": {
    "code": "SHIPPING_METHOD_NAME_EXISTS",
    "message": "A shipping method named 'Express Shipping' already exists",
    "statusCode": 409
  }
}
```

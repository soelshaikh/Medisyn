# API Contract: Coupons

**Base path**: `/api/v1/catalogue/coupons`
**Auth**: All coupon management endpoints require authentication + `coupons.manage`. The validation endpoint (used by checkout) requires authentication only (no special permission — it is an internal service-to-service call from the checkout flow).

---

## GET /api/v1/catalogue/coupons

List all coupons (active and inactive) for the facility.

**Auth required**: `coupons.manage`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `active` | boolean | — | Filter by isActive status |
| `search` | string | — | Search by code (partial match) |

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "SAVE20",
      "type": "PERCENTAGE",
      "discountValue": "20.00",
      "maxDiscountAmount": "100.00",
      "minOrderTotal": "50.00",
      "totalUsageLimit": 500,
      "perCustomerUsageLimit": 1,
      "totalRedemptionCount": 47,
      "startsAt": "2026-10-01T00:00:00Z",
      "endsAt": "2026-12-31T23:59:59Z",
      "isActive": true,
      "createdAt": "2026-10-09T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

Note: `internalNotes` is included in management listing responses. It must NEVER appear in the validation endpoint response.

---

## POST /api/v1/catalogue/coupons

Create a new coupon.

**Auth required**: `coupons.manage`

**Request Body**
```json
{
  "code": "SAVE20",
  "type": "PERCENTAGE",
  "discountValue": "20.00",
  "maxDiscountAmount": "100.00 (optional — PERCENTAGE only)",
  "minOrderTotal": "50.00 (optional)",
  "totalUsageLimit": 500,
  "perCustomerUsageLimit": 1,
  "applicableProductIds": ["uuid", "uuid"],
  "applicableCategoryIds": [],
  "startsAt": "2026-10-01T00:00:00Z (optional)",
  "endsAt": "2026-12-31T23:59:59Z (optional)",
  "isActive": true,
  "internalNotes": "Q4 promotional campaign (optional)"
}
```

Code is normalized to UPPERCASE on write. `type` must be `PERCENTAGE` or `FIXED_AMOUNT`. For `PERCENTAGE`, `discountValue` must be 1–100.

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "code": "SAVE20",
    "type": "PERCENTAGE",
    "isActive": true,
    "createdAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `VALIDATION_ERROR` | 422 | Missing required field, invalid type, percentage out of range |
| `COUPON_CODE_CONFLICT` | 409 | Code already exists in this facility (case-insensitive) |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Missing `coupons.manage` permission |

---

## GET /api/v1/catalogue/coupons/:id

Fetch a single coupon by ID (management view — includes internalNotes).

**Auth required**: `coupons.manage`

**Response 200**: Full coupon record including `internalNotes`, `applicableProductIds`, `applicableCategoryIds`.

---

## PATCH /api/v1/catalogue/coupons/:id

Update a coupon (partial update). `code` and `type` cannot be changed after creation.

**Auth required**: `coupons.manage`

**Request Body**: Any subset of POST fields except `code` and `type`.

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "updatedAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `COUPON_NOT_FOUND` | 404 | Coupon not found |
| `IMMUTABLE_FIELD` | 422 | Attempt to change `code` or `type` |

---

## POST /api/v1/catalogue/coupons/validate

Validate a coupon code for use at checkout. This is an internal endpoint called by the Phase 4 checkout service. It does NOT increment `totalRedemptionCount` — that happens at order completion.

**Auth required**: Any valid session (no specific permission — checkout flow is authenticated)

**Request Body**
```json
{
  "code": "SAVE20",
  "orderTotal": "75.00"
}
```

**Response 200 — valid coupon**
```json
{
  "data": {
    "valid": true,
    "couponId": "uuid",
    "type": "PERCENTAGE",
    "discountValue": "20.00",
    "maxDiscountAmount": "100.00",
    "effectiveDiscount": "15.00",
    "applicableProductIds": null,
    "applicableCategoryIds": null
  }
}
```

`effectiveDiscount` is the computed discount given the `orderTotal` and coupon rules (capped at `maxDiscountAmount` for percentage coupons). The checkout flow uses this value to apply the discount.

**Response 200 — invalid coupon**
```json
{
  "data": {
    "valid": false,
    "reason": "EXPIRED",
    "message": "This coupon has expired."
  }
}
```

Valid `reason` values: `EXPIRED`, `INACTIVE`, `USAGE_LIMIT_REACHED`, `MINIMUM_NOT_MET`, `INVALID_CODE`

Note: `internalNotes` is NEVER included in this response.

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `VALIDATION_ERROR` | 422 | Missing `code` or `orderTotal` |
| `UNAUTHORIZED` | 401 | Not authenticated |

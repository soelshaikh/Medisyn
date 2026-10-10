# API Contract: Inventory

**Base path**: `/api/v1/catalogue/inventory`
**Auth**: All inventory endpoints require authentication. View requires `inventory.read`. Adjustments require `inventory.adjust`.

---

## GET /api/v1/catalogue/inventory/products/:productId

Get the current inventory record(s) for a product. Returns one record if the product has no variants, or one record per active variant.

**Auth required**: `inventory.read`

**Response 200 — product without variants**
```json
{
  "data": {
    "productId": "uuid",
    "productName": "Aspirin 81mg",
    "variantId": null,
    "variantDimensionValue": null,
    "quantity": 48,
    "lowStockThreshold": 10,
    "isLowStock": false,
    "allowNegative": false,
    "updatedAt": "2026-10-09T00:00:00Z"
  }
}
```

**Response 200 — product with variants**
```json
{
  "data": [
    {
      "productId": "uuid",
      "productName": "Vitamin C",
      "variantId": "uuid",
      "variantDimensionValue": "500mg",
      "quantity": 42,
      "lowStockThreshold": 5,
      "isLowStock": false,
      "allowNegative": false,
      "updatedAt": "2026-10-09T00:00:00Z"
    },
    {
      "productId": "uuid",
      "productName": "Vitamin C",
      "variantId": "uuid",
      "variantDimensionValue": "1000mg",
      "quantity": 3,
      "lowStockThreshold": 5,
      "isLowStock": true,
      "allowNegative": false,
      "updatedAt": "2026-10-09T00:00:00Z"
    }
  ]
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `PRODUCT_NOT_FOUND` | 404 | Product not found in this facility |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Missing `inventory.read` permission |

---

## GET /api/v1/catalogue/inventory/low-stock

List all products (or variants) where `quantity <= low_stock_threshold`.

**Auth required**: `inventory.read`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 200) |

**Response 200**
```json
{
  "data": [
    {
      "productId": "uuid",
      "productName": "Vitamin C",
      "variantId": "uuid",
      "variantDimensionValue": "1000mg",
      "quantity": 3,
      "lowStockThreshold": 5
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 7, "totalPages": 1 }
}
```

---

## POST /api/v1/catalogue/inventory/products/:productId/adjust

Apply a stock adjustment to a product (or variant).

**Auth required**: `inventory.adjust`

**Request Body**
```json
{
  "variantId": "uuid (optional — required if product has variants)",
  "quantityDelta": -5,
  "reason": "DAMAGED",
  "note": "Shelf damage during delivery (optional)"
}
```

Valid `reason` values: `RESTOCK`, `DAMAGED`, `MANUAL_ADJUSTMENT`, `RETURN`, `WRITE_OFF`, `OTHER`

**Response 200**
```json
{
  "data": {
    "inventoryRecordId": "uuid",
    "productId": "uuid",
    "variantId": "uuid or null",
    "previousQuantity": 48,
    "quantityDelta": -5,
    "resultingBalance": 43,
    "reason": "DAMAGED",
    "note": "Shelf damage during delivery",
    "actorId": "uuid",
    "createdAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `PRODUCT_NOT_FOUND` | 404 | Product not found |
| `VARIANT_NOT_FOUND` | 404 | variantId provided but not found for this product |
| `VARIANT_REQUIRED` | 422 | Product has variants but no variantId provided |
| `INSUFFICIENT_STOCK` | 409 | Resulting balance would be negative and `allowNegative` is false |
| `VALIDATION_ERROR` | 422 | Invalid reason, zero delta |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Missing `inventory.adjust` permission |

---

## GET /api/v1/catalogue/inventory/products/:productId/history

Retrieve the adjustment history for a product (or variant) in reverse-chronological order.

**Auth required**: `inventory.read`

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `variant_id` | uuid | — | Filter to a specific variant |
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 200) |

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "quantityDelta": -5,
      "resultingBalance": 43,
      "reason": "DAMAGED",
      "note": "Shelf damage during delivery",
      "actorId": "uuid",
      "actorName": "Jane Smith",
      "variantId": "uuid or null",
      "variantDimensionValue": "1000mg or null",
      "createdAt": "2026-10-09T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 23, "totalPages": 1 }
}
```

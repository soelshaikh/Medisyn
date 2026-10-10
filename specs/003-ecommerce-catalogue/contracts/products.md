# API Contract: Products

**Base path**: `/api/v1/catalogue/products`
**Auth**: Public GET endpoints require `X-Facility-ID` header. Admin write endpoints require `Authorization: Bearer <access_token>` + `X-Facility-ID` + permission `products.manage`.

---

## GET /api/v1/catalogue/products

List active products with optional filtering, sorting, and pagination.

**Headers (required)**
```
X-Facility-ID: <uuid>
```

**Query Parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max 100) |
| `category_id` | uuid | — | Filter by category (includes subcategories recursively) |
| `brand` | string | — | Exact brand match (case-insensitive) |
| `price_min` | decimal | — | Minimum price (inclusive) |
| `price_max` | decimal | — | Maximum price (inclusive) |
| `in_stock` | boolean | — | true = only in-stock items |
| `featured` | boolean | — | true = only featured items |
| `search` | string | — | Keyword search across name and description |
| `sort` | string | `created_desc` | One of: `created_desc`, `price_asc`, `price_desc`, `name_asc`, `name_desc` |

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "sku": "VITC-500",
      "name": "Vitamin C 500mg",
      "slug": "vitamin-c-500mg",
      "shortDescription": "Immune support supplement",
      "brand": "Jamieson",
      "categoryId": "uuid",
      "price": "12.99",
      "compareAtPrice": "15.99",
      "images": ["https://cdn.example.com/vitc.jpg"],
      "isFeatured": false,
      "variantDimensionLabel": null,
      "stockStatus": "in_stock",
      "createdAt": "2026-10-09T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `MISSING_FACILITY_ID` | 400 | `X-Facility-ID` header absent or not a valid UUID |
| `FACILITY_NOT_FOUND` | 404 | No facility with that ID exists |
| `FACILITY_SUSPENDED` | 403 | Facility is suspended or deactivated |
| `VALIDATION_ERROR` | 422 | Invalid query param (e.g., negative price, unknown sort value) |

---

## GET /api/v1/catalogue/products/:id

Fetch full product details including all variants and stock availability.

**Headers (required)**
```
X-Facility-ID: <uuid>
```

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "sku": "VITC-500",
    "name": "Vitamin C 500mg",
    "slug": "vitamin-c-500mg",
    "description": "Full product description...",
    "shortDescription": "Immune support supplement",
    "brand": "Jamieson",
    "categoryId": "uuid",
    "price": "12.99",
    "compareAtPrice": "15.99",
    "images": ["https://cdn.example.com/vitc.jpg"],
    "isFeatured": false,
    "variantDimensionLabel": "Strength",
    "variants": [
      {
        "id": "uuid",
        "sku": "VITC-500MG",
        "dimensionValue": "500mg",
        "price": "12.99",
        "compareAtPrice": null,
        "isActive": true,
        "stockStatus": "in_stock",
        "quantity": 42
      },
      {
        "id": "uuid",
        "sku": "VITC-1000MG",
        "dimensionValue": "1000mg",
        "price": "18.99",
        "compareAtPrice": null,
        "isActive": true,
        "stockStatus": "low_stock",
        "quantity": 3
      }
    ],
    "stockStatus": null,
    "quantity": null,
    "createdAt": "2026-10-09T00:00:00Z",
    "updatedAt": "2026-10-09T00:00:00Z"
  }
}
```

Note: `stockStatus` and `quantity` at the product level are `null` when the product has variants — use the per-variant values instead.

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `MISSING_FACILITY_ID` | 400 | `X-Facility-ID` absent |
| `PRODUCT_NOT_FOUND` | 404 | No active product with that ID in this facility |

---

## POST /api/v1/catalogue/products

Create a new product.

**Auth required**: `products.manage`

**Headers**
```
Authorization: Bearer <token>
X-Facility-ID: <uuid>
Content-Type: application/json
```

**Request Body**
```json
{
  "sku": "VITC-500",
  "name": "Vitamin C 500mg",
  "slug": "vitamin-c-500mg",
  "description": "Full description (optional)",
  "shortDescription": "Short description (optional)",
  "brand": "Jamieson",
  "categoryId": "uuid (optional)",
  "price": "12.99",
  "compareAtPrice": "15.99 (optional)",
  "images": ["https://cdn.example.com/vitc.jpg"],
  "variantDimensionLabel": "Strength (optional — null if no variants)",
  "lowStockThreshold": 5,
  "isFeatured": false,
  "isActive": true,
  "variants": [
    {
      "sku": "VITC-500MG",
      "dimensionValue": "500mg",
      "price": "12.99",
      "compareAtPrice": null
    }
  ]
}
```

`variants` is optional. If provided and non-empty, `variantDimensionLabel` must also be set.

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "sku": "VITC-500",
    "slug": "vitamin-c-500mg",
    "name": "Vitamin C 500mg",
    "createdAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `VALIDATION_ERROR` | 422 | Missing required field, invalid price format |
| `SKU_CONFLICT` | 409 | SKU already exists in this facility |
| `SLUG_CONFLICT` | 409 | Slug already exists (only if slug was explicitly provided) |
| `CATEGORY_NOT_FOUND` | 404 | categoryId provided but not found in this facility |
| `VARIANT_SKU_CONFLICT` | 409 | Duplicate variant SKU within the same facility |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Missing `products.manage` permission |

---

## PATCH /api/v1/catalogue/products/:id

Update a product (partial update — only provided fields are changed).

**Auth required**: `products.manage`

**Request Body**: Same fields as POST, all optional. `variants` field follows same rules. To add/update/deactivate a specific variant use the variant sub-resource endpoint.

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
| `PRODUCT_NOT_FOUND` | 404 | Product not found in this facility |
| `SKU_CONFLICT` | 409 | Updated SKU conflicts with existing product |
| `VALIDATION_ERROR` | 422 | Invalid field value |

---

## DELETE /api/v1/catalogue/products/:id

Deactivate a product (soft delete — sets `isActive = false`). Product is not removed from the database.

**Auth required**: `products.manage`

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "isActive": false,
    "updatedAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `PRODUCT_NOT_FOUND` | 404 | Product not found |
| `PRODUCT_ALREADY_INACTIVE` | 409 | Product is already inactive |

---

## POST /api/v1/catalogue/products/:id/variants

Add a variant to an existing product.

**Auth required**: `products.manage`

**Request Body**
```json
{
  "sku": "VITC-2000MG",
  "dimensionValue": "2000mg",
  "price": "24.99",
  "compareAtPrice": null
}
```

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "sku": "VITC-2000MG",
    "dimensionValue": "2000mg",
    "price": "24.99",
    "createdAt": "2026-10-09T00:00:00Z"
  }
}
```

---

## PATCH /api/v1/catalogue/products/:id/variants/:variantId

Update a variant (partial update).

**Auth required**: `products.manage`

**Response 200**: Returns updated variant fields.

---

## DELETE /api/v1/catalogue/products/:id/variants/:variantId

Deactivate a variant (soft delete).

**Auth required**: `products.manage`

**Response 200**: Returns `{ "data": { "id": "uuid", "isActive": false } }`.

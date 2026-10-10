# Contract: Checkout API

Base path: `/api/v1/checkout`

All checkout endpoints require authentication (JWT). Guest checkout is NOT supported — user must be logged in.

---

## POST /api/v1/checkout/preview

Compute the order totals for the current cart without creating any database records. Used by the checkout UI to show the user exactly what they will pay before they confirm.

**Auth**: Required (JWT)

### Request Body
```json
{
  "shippingAddressId": "uuid | null",
  "shippingAddress": {
    "street": "123 Main St",
    "unit": "Apt 4B",
    "city": "Toronto",
    "province": "ON",
    "postalCode": "M5V 2T6",
    "country": "CA"
  },
  "shippingMethodId": "uuid"
}
```

**Notes**:
- Provide EITHER `shippingAddressId` (saved address) OR inline `shippingAddress` object, not both.
- `province` must be a valid 2-letter Canadian province/territory code.

**Validation**:
- Cart must be non-empty
- All cart items must still be active products with sufficient stock
- `shippingMethodId`: required, must be an active shipping method in the facility
- `shippingAddress.province`: required, must be a valid Canadian province code (see tax-rates.ts)

### Response `200 OK`
```json
{
  "data": {
    "previewToken": "eyJhbGciOiJIUzI1NiJ9...",
    "previewTokenExpiresAt": "2026-10-09T18:00:00.000Z",
    "cart": {
      "itemCount": 2,
      "items": [
        {
          "productId": "uuid",
          "variantId": "uuid | null",
          "productName": "Vitamin D 1000IU",
          "variantLabel": "90 Capsules",
          "quantity": 2,
          "unitPrice": "12.99",
          "lineTotal": "25.98"
        }
      ]
    },
    "shippingAddress": {
      "street": "123 Main St",
      "unit": "Apt 4B",
      "city": "Toronto",
      "province": "ON",
      "postalCode": "M5V 2T6",
      "country": "CA"
    },
    "shippingMethod": {
      "id": "uuid",
      "name": "Standard Shipping",
      "flatRate": "9.99",
      "estimatedDaysMin": 3,
      "estimatedDaysMax": 7
    },
    "breakdown": {
      "subtotal": "25.98",
      "taxBreakdown": [
        { "type": "HST", "rate": "0.13", "amount": "3.38" }
      ],
      "taxTotal": "3.38",
      "shippingCost": "9.99",
      "total": "39.35"
    }
  }
}
```

**Notes**:
- `previewToken`: short-lived JWT (15 minutes) signed with server secret. Contains hash of computed totals. Required for `POST /checkout/place`.
- Tax calculated on `subtotal` only (not shipping). Province determines tax type (GST/HST/PST/QST).
- This endpoint performs stock checks but does NOT reserve stock.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `CART_EMPTY` | 422 | Cart has no items |
| `INSUFFICIENT_STOCK` | 422 | One or more items have insufficient stock. Body includes `outOfStockItems: [productId]` |
| `PRODUCT_NOT_FOUND` | 422 | Cart contains a product that is no longer active |
| `SHIPPING_METHOD_NOT_FOUND` | 404 | shippingMethodId not found or inactive |
| `INVALID_PROVINCE` | 422 | Province code not recognized |

---

## POST /api/v1/checkout/place

Place the order. Re-calculates all totals server-side from scratch, locks stock with SELECT FOR UPDATE, creates order + items + initial status history entry, clears cart.

**Auth**: Required (JWT)

**IMPORTANT**: The `previewToken` is required but its computed totals are NOT trusted. The server re-calculates everything independently. The preview token is only used to confirm the user was shown a checkout summary before placing.

### Request Body
```json
{
  "previewToken": "eyJhbGciOiJIUzI1NiJ9...",
  "shippingAddressId": "uuid | null",
  "shippingAddress": {
    "street": "123 Main St",
    "unit": "Apt 4B",
    "city": "Toronto",
    "province": "ON",
    "postalCode": "M5V 2T6",
    "country": "CA"
  },
  "shippingMethodId": "uuid",
  "notes": "Leave at door"
}
```

**Notes**:
- `previewToken` is validated (not expired, valid signature). If the computed totals differ from the preview by more than 1 cent, the server still proceeds and the order uses the newly computed values — the frontend must re-show the updated totals on the confirmation screen.
- `notes` is stored as internal notes, never shown to the patient.
- Address resolution: same as preview (EITHER `shippingAddressId` OR inline).

### Response `201 Created`
```json
{
  "data": {
    "orderId": "uuid",
    "orderNumber": "ORD-00001",
    "status": "pending",
    "breakdown": {
      "subtotal": "25.98",
      "taxBreakdown": [
        { "type": "HST", "rate": "0.13", "amount": "3.38" }
      ],
      "taxTotal": "3.38",
      "shippingCost": "9.99",
      "total": "39.35"
    },
    "estimatedDelivery": {
      "min": "2026-10-12",
      "max": "2026-10-16"
    }
  }
}
```

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `PREVIEW_TOKEN_REQUIRED` | 422 | previewToken missing |
| `PREVIEW_TOKEN_EXPIRED` | 422 | previewToken older than 15 minutes |
| `PREVIEW_TOKEN_INVALID` | 422 | previewToken signature invalid or malformed |
| `CART_EMPTY` | 422 | Cart is empty at placement time |
| `INSUFFICIENT_STOCK` | 422 | Stock insufficient after SELECT FOR UPDATE lock. Includes `outOfStockItems`. Cart is NOT cleared. |
| `SHIPPING_METHOD_NOT_FOUND` | 404 | Shipping method deleted or deactivated between preview and place |

---

## Error Response Shape
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Vitamin D 1000IU is out of stock",
    "statusCode": 422,
    "outOfStockItems": ["uuid"]
  }
}
```

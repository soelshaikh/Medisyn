# Contract: Cart API

Base path: `/api/v1/cart`

---

## GET /api/v1/cart

Retrieve the current cart (guest or authenticated).

**Auth**: Optional (guest uses `cart_token` cookie; authenticated user uses JWT)

**Guest resolution**: Reads `medisyn_cart` HttpOnly cookie → looks up `carts.cart_token` within facility.  
**Auth resolution**: Looks up `carts.user_id` within facility.  
**Facility resolution**: `X-Facility-ID` header (required for all cart endpoints).

### Response `200 OK`
```json
{
  "data": {
    "id": "uuid",
    "facilityId": "uuid",
    "itemCount": 3,
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "variantId": "uuid | null",
        "productName": "Vitamin D 1000IU",
        "variantLabel": "90 Capsules",
        "quantity": 2,
        "priceSnapshot": "12.99",
        "lineTotal": "25.98",
        "product": {
          "id": "uuid",
          "name": "Vitamin D 1000IU",
          "slug": "vitamin-d-1000iu",
          "currentPrice": "12.99",
          "stockQuantity": 45,
          "isActive": true
        }
      }
    ],
    "subtotal": "25.98",
    "expiresAt": "2026-11-08T00:00:00.000Z | null"
  }
}
```

**Note**: `priceSnapshot` is the display price captured when the item was added. `product.currentPrice` is the live current price (may differ). The UI should warn users if these diverge.

### When cart does not exist
Returns an empty cart structure (does NOT create a cart row):
```json
{
  "data": {
    "id": null,
    "facilityId": "uuid",
    "itemCount": 0,
    "items": [],
    "subtotal": "0.00",
    "expiresAt": null
  }
}
```

---

## POST /api/v1/cart/items

Add an item to the cart, or increment quantity if the same (productId, variantId) pair already exists.

**Auth**: Optional  
**Creates cart on first add** if no cart exists.

### Request Body
```json
{
  "productId": "uuid",
  "variantId": "uuid | null",
  "quantity": 1
}
```

**Validation**:
- `productId`: required, valid UUID, product must exist and be active in the facility
- `variantId`: optional UUID; if provided, must belong to productId
- `quantity`: required, integer 1–99

**Business rules**:
- Product must be active (`isActive = true`)
- Product must have sufficient stock (`stockQuantity >= quantity`)
- Cart may not exceed 50 distinct line items (throws `CART_ITEM_LIMIT_EXCEEDED` 422)
- Total quantity for a line item may not exceed `stockQuantity` (throws `INSUFFICIENT_STOCK` 422)

### Response `201 Created`
Returns the updated cart (same shape as `GET /cart`).

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `PRODUCT_NOT_FOUND` | 404 | productId not found or inactive |
| `VARIANT_NOT_FOUND` | 404 | variantId not found or not under productId |
| `INSUFFICIENT_STOCK` | 422 | Requested quantity exceeds available stock |
| `CART_ITEM_LIMIT_EXCEEDED` | 422 | Cart already has 50 distinct items |
| `FACILITY_REQUIRED` | 400 | X-Facility-ID header missing |

---

## PATCH /api/v1/cart/items/:itemId

Update the quantity of an existing cart item.

**Auth**: Optional

### Request Body
```json
{
  "quantity": 3
}
```

**Validation**:
- `quantity`: required, integer 1–99. Setting to 0 is not allowed — use DELETE instead.

**Business rules**:
- Item must belong to the caller's cart
- New quantity must not exceed current stock

### Response `200 OK`
Returns the updated cart.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `CART_ITEM_NOT_FOUND` | 404 | Item not in caller's cart |
| `INSUFFICIENT_STOCK` | 422 | Requested quantity exceeds available stock |

---

## DELETE /api/v1/cart/items/:itemId

Remove a single line item from the cart.

**Auth**: Optional

### Response `200 OK`
Returns the updated cart.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `CART_ITEM_NOT_FOUND` | 404 | Item not in caller's cart |

---

## DELETE /api/v1/cart

Clear all items from the cart (does NOT delete the cart row itself).

**Auth**: Optional

### Response `200 OK`
Returns the updated (empty) cart.

---

## POST /api/v1/cart/merge

Merge a guest cart into the authenticated user's cart. Called by the frontend immediately after successful login if a guest cart cookie exists.

**Auth**: Required (JWT)

### Request Body
```json
{
  "cartToken": "uuid"
}
```

**Merge rules**:
- Same (productId, variantId): keep `max(guestQty, authQty)`, capped at `stockQuantity`
- Items only in guest cart: added to auth cart directly
- Items only in auth cart: unchanged
- After merge: guest cart row is deleted and `Set-Cookie: medisyn_cart=; Max-Age=0` is returned

### Response `200 OK`
Returns the merged authenticated cart.

**Errors**:
| Code | HTTP | Condition |
|------|------|-----------|
| `CART_TOKEN_NOT_FOUND` | 404 | Guest cart with given token not found |

---

## Error Response Shape (all endpoints)
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 3 units available",
    "statusCode": 422
  }
}
```

---

## Cookie: `medisyn_cart`
- Type: HttpOnly, Secure, SameSite=Strict
- Value: UUID v4 (the `cart_token`)
- Max-Age: 30 days (guest only; cleared on merge)
- Set automatically on first `POST /cart/items` by a guest user

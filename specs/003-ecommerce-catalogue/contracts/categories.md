# API Contract: Categories

**Base path**: `/api/v1/catalogue/categories`
**Auth**: Public GET endpoints require `X-Facility-ID` header. Admin write endpoints require `Authorization: Bearer <access_token>` + `X-Facility-ID` + permission `categories.manage`.

---

## GET /api/v1/catalogue/categories

Return all active categories as a hierarchical tree.

**Headers (required)**
```
X-Facility-ID: <uuid>
```

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Vitamins & Supplements",
      "slug": "vitamins-supplements",
      "description": null,
      "imageUrl": null,
      "displayOrder": 0,
      "children": [
        {
          "id": "uuid",
          "name": "Vitamin C",
          "slug": "vitamin-c",
          "description": null,
          "imageUrl": null,
          "displayOrder": 0,
          "children": []
        },
        {
          "id": "uuid",
          "name": "Vitamin D",
          "slug": "vitamin-d",
          "description": null,
          "imageUrl": null,
          "displayOrder": 1,
          "children": []
        }
      ]
    },
    {
      "id": "uuid",
      "name": "Cold & Flu",
      "slug": "cold-flu",
      "description": null,
      "imageUrl": null,
      "displayOrder": 1,
      "children": []
    }
  ]
}
```

The response is an array of root categories (no parent), each with a recursive `children` array. Inactive categories are excluded. The tree is returned in a single request.

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `MISSING_FACILITY_ID` | 400 | `X-Facility-ID` absent or invalid |
| `FACILITY_NOT_FOUND` | 404 | Facility not found |
| `FACILITY_SUSPENDED` | 403 | Facility suspended |

---

## GET /api/v1/catalogue/categories/:id

Fetch a single category with its direct children (not full recursive tree).

**Headers (required)**
```
X-Facility-ID: <uuid>
```

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "name": "Vitamins & Supplements",
    "slug": "vitamins-supplements",
    "description": "All vitamins and dietary supplements",
    "imageUrl": "https://cdn.example.com/vitamins.jpg",
    "displayOrder": 0,
    "parentId": null,
    "isActive": true,
    "children": [
      { "id": "uuid", "name": "Vitamin C", "slug": "vitamin-c", "isActive": true }
    ],
    "createdAt": "2026-10-09T00:00:00Z",
    "updatedAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `CATEGORY_NOT_FOUND` | 404 | Category not found in this facility |

---

## POST /api/v1/catalogue/categories

Create a new category.

**Auth required**: `categories.manage`

**Request Body**
```json
{
  "name": "Vitamins & Supplements",
  "slug": "vitamins-supplements",
  "description": "Optional description",
  "imageUrl": "https://cdn.example.com/vitamins.jpg (optional)",
  "parentId": "uuid (optional — omit for root category)",
  "displayOrder": 0,
  "isActive": true
}
```

`slug` is optional — auto-generated from `name` if absent.

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "name": "Vitamins & Supplements",
    "slug": "vitamins-supplements",
    "parentId": null,
    "createdAt": "2026-10-09T00:00:00Z"
  }
}
```

**Errors**

| Code | Status | Condition |
|------|--------|-----------|
| `VALIDATION_ERROR` | 422 | Missing name |
| `SLUG_CONFLICT` | 409 | Slug already exists in this facility |
| `PARENT_NOT_FOUND` | 404 | parentId provided but not found in this facility |
| `CYCLE_DETECTED` | 409 | Would create a circular parent-child reference |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Missing `categories.manage` permission |

---

## PATCH /api/v1/catalogue/categories/:id

Update a category (partial update).

**Auth required**: `categories.manage`

**Request Body**: Any subset of POST fields. Reparenting (changing `parentId`) triggers cycle detection.

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
| `CATEGORY_NOT_FOUND` | 404 | Category not found |
| `CYCLE_DETECTED` | 409 | New parentId would create a cycle |
| `SLUG_CONFLICT` | 409 | Updated slug conflicts |

---

## DELETE /api/v1/catalogue/categories/:id

Deactivate a category (soft delete). Does NOT deactivate products assigned to it.

**Auth required**: `categories.manage`

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
| `CATEGORY_NOT_FOUND` | 404 | Category not found |
| `CATEGORY_HAS_ACTIVE_CHILDREN` | 409 | Category has active subcategories — deactivate children first |

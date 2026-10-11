# Data Model: Admin Reports & Dashboard

**Feature**: 008-admin-reports-dashboard
**Date**: 2026-10-11

No new tables are created in this phase. All report queries run against existing tables listed below.

---

## Existing Tables Used

### orders (`backend/src/db/schema/commerce.ts`)

Key columns for reports:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | RLS anchor |
| `patient_id` | uuid | FK → users.id |
| `order_number` | text | Human-readable |
| `status` | text | `pending \| confirmed \| processing \| ready \| shipped \| delivered \| cancelled \| refunded` |
| `subtotal` | numeric(10,2) | Pre-tax, pre-shipping |
| `tax_total` | numeric(10,2) | |
| `shipping_cost` | numeric(10,2) | |
| `total` | numeric(10,2) | Revenue source — exact decimal, not integer cents |
| `created_at` | timestamptz | Bucket by this for trend series |
| `updated_at` | timestamptz | |

**Revenue filter**: Include only `status IN ('shipped', 'delivered')`.

**Existing indexes relevant to reports**:
- `orders_facility_status_idx` on `(facility_id, status)`
- `orders_created_at_idx` on `(facility_id, created_at)`

---

### order_items (`backend/src/db/schema/commerce.ts`)

Key columns for top-products sub-report:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `order_id` | uuid | FK → orders.id |
| `facility_id` | uuid | RLS anchor (denormalised) |
| `product_id` | uuid | FK → products.id (nullable — survives product deletion) |
| `product_name` | text | Snapshot at order time |
| `sku` | text | Snapshot |
| `quantity` | integer | Units sold |
| `unit_price` | numeric(10,2) | Snapshot at order time |
| `line_total` | numeric(10,2) | unit_price × quantity, snapshot |

**Top products**: `SUM(line_total)` grouped by `product_id, product_name`. Use `product_name` for display (survives deletion of product row).

---

### order_status_history (`backend/src/db/schema/commerce.ts`)

Used to calculate fulfillment time (placed → shipped):
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `order_id` | uuid | FK → orders.id |
| `facility_id` | uuid | RLS anchor |
| `previous_status` | text | Nullable |
| `new_status` | text | |
| `created_at` | timestamptz | Timestamp of this status transition |

**Fulfillment time**: JOIN orders on `osh.new_status = 'shipped'`, compute `EXTRACT(EPOCH FROM (osh.created_at - o.created_at)) / 3600.0` in hours.

---

### users (`backend/src/db/schema/core.ts`)

Used for patient report new registrations + top spenders display:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `email` | text | Unique (not returned in reports) |
| `first_name` | text | Returned in top-patients list |
| `last_name` | text | Returned in top-patients list |
| `created_at` | timestamptz | New patient registration timestamp |

---

### facility_users (`backend/src/db/schema/rbac.ts`)

Identifies patients within the facility:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | RLS anchor |
| `user_id` | uuid | FK → users.id |
| `role_id` | uuid | FK → facility_roles.id |
| `is_active` | boolean | |
| `joined_at` | timestamptz | |

**Patient filter**: JOIN `facility_roles fr ON fr.id = fu.role_id WHERE fr.name = 'patient'`.

---

### facility_roles (`backend/src/db/schema/rbac.ts`)

Used to identify the patient system role by name:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | |
| `name` | text | e.g., `'patient'`, `'pharmacist'`, `'staff'` |
| `is_system_role` | boolean | Patient role: `true` |

---

### prescription_requests (`backend/src/db/schema/healthcare.ts`)

Dashboard: pending prescription count:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | RLS anchor |
| `status` | text | `submitted \| under_review \| approved \| declined` |
| `created_at` | timestamptz | |

**Pending count**: `status IN ('submitted', 'under_review')`.

---

### pharmacist_conversations (`backend/src/db/schema/healthcare.ts`)

Dashboard: open (unread) ask-pharmacist count:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | RLS anchor |
| `status` | text | `open \| in_progress \| resolved \| closed` |
| `created_at` | timestamptz | |

**Unread proxy**: `status = 'open'` — conversations awaiting staff attention.

---

### inventory_records (`backend/src/db/schema/catalogue.ts`)

Dashboard: low-stock count:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | RLS anchor |
| `product_id` | uuid | FK → products.id |
| `variant_id` | uuid | FK → product_variants.id (nullable) |
| `quantity` | integer | Current stock on hand |

---

### products (`backend/src/db/schema/catalogue.ts`)

Provides `low_stock_threshold` for low-stock count:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `facility_id` | uuid | RLS anchor |
| `name` | text | Product display name |
| `low_stock_threshold` | integer | 0 = no threshold configured (exclude from low-stock count) |
| `is_active` | boolean | Only count active products |

**Low-stock query**: `inventory_records ir JOIN products p ON p.id = ir.product_id WHERE ir.quantity <= p.low_stock_threshold AND p.low_stock_threshold > 0 AND p.is_active = true`.

---

## No New Migrations Required

All Phase 8 work is additive source code only (new module + seed). No database schema changes.

# Data Model: Cart, Checkout & Orders

## New Tables

### `facility_sequences`
Per-facility counter for human-readable identifiers. Locked with SELECT FOR UPDATE inside order creation transaction.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE CASCADE | |
| resource_type | TEXT | NOT NULL | e.g. 'order' |
| next_val | INTEGER | NOT NULL, default 1 | Incremented atomically on each use |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique**: `(facility_id, resource_type)`
**RLS**: `facility_id = current_facility_id()`
**Grants**: SELECT, UPDATE to `app_user` and `app_super_admin`

---

### `shipping_methods`
Admin-configured flat-rate shipping options per facility.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE CASCADE | |
| name | TEXT | NOT NULL | e.g. "Standard Shipping" |
| description | TEXT | | Optional display text |
| flat_rate | NUMERIC(10,2) | NOT NULL, CHECK >= 0 | 0.00 = free shipping |
| estimated_days_min | INTEGER | NOT NULL, CHECK >= 0 | |
| estimated_days_max | INTEGER | NOT NULL, CHECK >= estimated_days_min | |
| is_active | BOOLEAN | NOT NULL, default true | |
| display_order | INTEGER | NOT NULL, default 0 | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique**: `(facility_id, name)`
**RLS**: `facility_id = current_facility_id()`
**Grants**: SELECT, INSERT, UPDATE, DELETE to `app_user` and `app_super_admin`

---

### `carts`
One cart per guest session or authenticated user per facility.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE CASCADE | |
| user_id | UUID | nullable, FK → users.id ON DELETE SET NULL | NULL for guest carts |
| cart_token | UUID | nullable | Guest cart identifier (from cookie) |
| expires_at | TIMESTAMPTZ | | NULL = no expiry (authenticated); 30 days for guests |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique**: `(facility_id, user_id)` where user_id IS NOT NULL (one cart per auth user per facility)
**Unique**: `(facility_id, cart_token)` where cart_token IS NOT NULL (one guest cart per token per facility)
**Index**: `(cart_token)` for fast guest lookups
**Index**: `(user_id, facility_id)` for auth user lookups
**RLS**: `facility_id = current_facility_id()`
**Note**: Guest cart reads use `resolveFacility` middleware (X-Facility-ID header) + raw cart_token lookup. No `withTenantContext` required for guest read since no authenticated user.
**Grants**: SELECT, INSERT, UPDATE, DELETE to `app_user` and `app_super_admin`

---

### `cart_items`
Line items within a cart. Max 50 items per cart enforced at service layer.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| cart_id | UUID | NOT NULL, FK → carts.id ON DELETE CASCADE | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE CASCADE | Denormalised for RLS |
| product_id | UUID | NOT NULL, FK → products.id ON DELETE CASCADE | |
| variant_id | UUID | nullable, FK → product_variants.id ON DELETE CASCADE | |
| quantity | INTEGER | NOT NULL, CHECK > 0 | |
| price_snapshot | NUMERIC(10,2) | NOT NULL | Price at time of addition (display only) |
| product_name_snapshot | TEXT | NOT NULL | Product name at time of addition |
| variant_label_snapshot | TEXT | nullable | e.g. "500mg" |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique NULLS NOT DISTINCT**: `(cart_id, product_id, variant_id)` — prevents duplicate line items
**RLS**: `facility_id = current_facility_id()`
**Grants**: SELECT, INSERT, UPDATE, DELETE to `app_user` and `app_super_admin`

---

### `orders`
Immutable purchase record. All financial fields are snapshots — never recalculated after creation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE RESTRICT | Never cascade-delete orders |
| patient_id | UUID | NOT NULL, FK → users.id ON DELETE RESTRICT | |
| order_number | TEXT | NOT NULL | e.g. "ORD-00001" |
| status | TEXT | NOT NULL, default 'pending' | See status lifecycle |
| shipping_address | JSONB | NOT NULL | Snapshot: {street, unit, city, province, postalCode, country} |
| shipping_method_id | UUID | nullable, FK → shipping_methods.id ON DELETE SET NULL | Preserved even if method deleted |
| shipping_method_snapshot | JSONB | NOT NULL | Snapshot: {name, flatRate, estimatedDaysMin, estimatedDaysMax} |
| subtotal | NUMERIC(10,2) | NOT NULL | Sum of line totals before tax/shipping |
| tax_breakdown | JSONB | NOT NULL | [{type:'GST', rate:0.05, amount:'5.00'}, ...] |
| tax_total | NUMERIC(10,2) | NOT NULL | Sum of all tax amounts |
| shipping_cost | NUMERIC(10,2) | NOT NULL | |
| total | NUMERIC(10,2) | NOT NULL | subtotal + tax_total + shipping_cost |
| notes | TEXT | | Internal admin notes (never exposed to patient) |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique**: `(facility_id, order_number)`
**Index**: `(facility_id, status)` for admin filtering
**Index**: `(facility_id, patient_id)` for patient order list
**Index**: `(facility_id, created_at DESC)` for default sort
**RLS**: `facility_id = current_facility_id()`
**Grants**: SELECT, INSERT, UPDATE to `app_user`; all to `app_super_admin`
**Note**: DELETE is not granted — orders are never deleted

---

### `order_items`
Immutable line items. All values are snapshots from the moment of order placement.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| order_id | UUID | NOT NULL, FK → orders.id ON DELETE CASCADE | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE RESTRICT | Denormalised for RLS |
| product_id | UUID | nullable, FK → products.id ON DELETE SET NULL | Preserved as snapshot even if product deleted |
| variant_id | UUID | nullable, FK → product_variants.id ON DELETE SET NULL | |
| product_name | TEXT | NOT NULL | Snapshot |
| variant_label | TEXT | nullable | Snapshot e.g. "500mg" |
| sku | TEXT | NOT NULL | Snapshot |
| quantity | INTEGER | NOT NULL, CHECK > 0 | |
| unit_price | NUMERIC(10,2) | NOT NULL | Snapshot — price at order placement |
| line_total | NUMERIC(10,2) | NOT NULL | quantity × unit_price |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |

**RLS**: `facility_id = current_facility_id()`
**Grants**: SELECT, INSERT to `app_user`; all to `app_super_admin`
**Note**: No UPDATE or DELETE granted — order items are immutable

---

### `order_status_history`
Append-only log of every order status transition.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, default random | |
| order_id | UUID | NOT NULL, FK → orders.id ON DELETE CASCADE | |
| facility_id | UUID | NOT NULL, FK → facilities.id ON DELETE RESTRICT | |
| previous_status | TEXT | nullable | NULL for initial 'pending' entry |
| new_status | TEXT | NOT NULL | |
| changed_by_id | UUID | nullable, FK → users.id ON DELETE SET NULL | NULL if system-initiated |
| note | TEXT | | Optional admin note |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Index**: `(order_id, created_at DESC)` for history queries
**RLS**: `facility_id = current_facility_id()`
**Grants**: SELECT, INSERT to `app_user`; all to `app_super_admin`
**Note**: No UPDATE or DELETE granted — append-only

---

## Migration SQL Additions (beyond Drizzle output)

```sql
-- UNIQUE NULLS NOT DISTINCT for cart_items (PG16)
ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_cart_product_variant_unique
  UNIQUE NULLS NOT DISTINCT (cart_id, product_id, variant_id);

-- UNIQUE NULLS NOT DISTINCT for carts user_id (one authenticated cart per user per facility)
ALTER TABLE carts
  ADD CONSTRAINT carts_facility_user_unique
  UNIQUE NULLS NOT DISTINCT (facility_id, user_id);

-- UNIQUE NULLS NOT DISTINCT for carts cart_token (one guest cart per token per facility)
ALTER TABLE carts
  ADD CONSTRAINT carts_facility_token_unique
  UNIQUE NULLS NOT DISTINCT (facility_id, cart_token);

-- RLS on all new tables
ALTER TABLE facility_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as existing tables)
CREATE POLICY facility_isolation ON facility_sequences
  USING (facility_id = current_facility_id())
  WITH CHECK (facility_id = current_facility_id());
-- (repeat for each table)

-- Append-only enforcement (same pattern as inventory_transactions and audit_log)
REVOKE UPDATE, DELETE ON order_items FROM app_user;
REVOKE UPDATE, DELETE ON order_items FROM app_super_admin;
REVOKE UPDATE, DELETE ON order_status_history FROM app_user;
REVOKE UPDATE, DELETE ON order_status_history FROM app_super_admin;
REVOKE DELETE ON orders FROM app_user;
REVOKE DELETE ON orders FROM app_super_admin;

-- Grants
GRANT SELECT, INSERT, UPDATE ON facility_sequences TO app_user, app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipping_methods TO app_user, app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON carts TO app_user, app_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO app_user, app_super_admin;
GRANT SELECT, INSERT, UPDATE ON orders TO app_user, app_super_admin;
GRANT SELECT, INSERT ON order_items TO app_user, app_super_admin;
GRANT SELECT, INSERT ON order_status_history TO app_user, app_super_admin;
```

---

## State Machine: Order Status

```
pending ──→ confirmed ──→ processing ──→ ready ──→ shipped ──→ delivered ──→ refunded
   │              │
   └──────────────┴──→ cancelled  (terminal)
                                         refunded  (terminal)
```

**Valid transitions**:
| From | To (allowed) |
|------|-------------|
| pending | confirmed, cancelled |
| confirmed | processing, cancelled |
| processing | ready |
| ready | shipped |
| shipped | delivered |
| delivered | refunded |
| cancelled | *(none — terminal)* |
| refunded | *(none — terminal)* |

**Who can cancel**:
- `pending`: patient (self-service) OR admin (`orders.manage`)
- `confirmed`: admin only (`orders.manage`)

**Stock restoration on cancel**: All order line items trigger inventory adjustments (reason: `RETURN`, quantity: +line_item.quantity) within the same cancellation transaction.

---

## Tax Rate Constants

Defined in `backend/src/lib/tax-rates.ts` (not in DB):

```typescript
// Province → named tax breakdown
// Rates as of 2026 (CRA-published)
AB, NT, NU, YT → GST 5%
BC             → GST 5% + PST 7%
MB             → GST 5% + PST 7%
ON             → HST 13%
QC             → GST 5% + QST 9.975% (additive, applied to pre-GST subtotal)
SK             → GST 5% + PST 6%
NS, NB, PEI, NL → HST 15%
```

---

## Relationships Summary

```
facilities ──< shipping_methods
facilities ──< carts ──< cart_items >── products
                                  └──── product_variants
facilities ──< facility_sequences
facilities ──< orders ──< order_items >── products / product_variants
                    └──< order_status_history
           >── shipping_methods (snapshot FK)
           >── users (patient_id)
```

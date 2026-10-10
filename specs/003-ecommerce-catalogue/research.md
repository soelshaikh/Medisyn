# Research: Ecommerce Catalogue

**Feature**: Phase 3 — Ecommerce Catalogue
**Date**: 2026-10-09
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1 — Facility identification for public (unauthenticated) endpoints

**Context**: Public product/category listing endpoints are not authenticated but must still scope queries to a specific facility so `withTenantContext()` can be called with a valid `facility_id`.

**Decision**: Accept `X-Facility-ID` header (UUID) on all `/api/v1/catalogue/` public endpoints. The middleware resolves it, verifies the facility is active, and passes it to `withTenantContext()`. A missing or invalid `X-Facility-ID` returns `400 BAD_REQUEST`. An inactive facility returns `403 FACILITY_SUSPENDED`.

**Rationale**: Headers are a clean, conventional way for a frontend to identify a tenant without putting the facility UUID in every URL path segment. The header is required — there is no "browse all facilities" view. The frontend (Next.js) will send this header on every catalogue request. This is consistent with how the frontend will be built (a Zustand `facilityId` store populated from the facility slug).

**Alternatives considered**:
- Facility slug in URL path (`/api/v1/facilities/:slug/catalogue/products`): Clean but makes all URLs long; routing becomes complex. Rejected.
- Facility UUID in query param (`?facility_id=...`): Works but query params can end up in logs. Header is cleaner for tenant identification. Rejected.
- Sub-domain detection: Requires DNS/CORS configuration outside the API's responsibility. Deferred to a future ops concern.

---

## Decision 2 — Product keyword search strategy

**Context**: FR-005 requires free-text keyword search across product name and description. SC-003 requires results under 1 second. The spec explicitly notes "basic text matching" for Phase 3 with full-text/relevance-ranked search deferred.

**Decision**: Use PostgreSQL `ILIKE '%keyword%'` search on `name` and `description` columns, with a `pg_trgm` GIN index on each column to keep performance acceptable for the 10k-product scale target.

**Rationale**: `pg_trgm` trigram indexes make `ILIKE` queries with `%keyword%` patterns fast (sub-100ms) at the 10k row scale. This avoids introducing `tsvector` columns, triggers, and `to_tsquery` complexity in Phase 3 while meeting SC-003. Relevance ranking can be added on top of tsvectors in a future phase without a breaking schema change — the plain `text` columns are the prerequisite.

**Alternatives considered**:
- `tsvector` columns with `websearch_to_tsquery`: Better relevance ranking, supports stemming. More complex to set up (trigger or generated column, query rewriting). Deferred.
- External search (Typesense, Elasticsearch): Out of scope for this phase.
- Simple `ILIKE` without trigram index: Acceptable at <1k rows but sequential scan at 10k. Rejected.

---

## Decision 3 — Category hierarchy representation

**Context**: FR-012 requires hierarchical categories with at least 3 levels of depth. FR-013 requires cycle detection. The constitution prohibits speculative over-engineering — use the simplest model that satisfies the spec.

**Decision**: Adjacency list — `parent_id UUID REFERENCES categories(id)` on the `categories` table. Cycle prevention enforced by a recursive CTE check before any parent update. Category tree queries use a recursive CTE (`WITH RECURSIVE`).

**Rationale**: Adjacency list is the simplest model. At the scale of a pharmacy's product catalogue (tens to low hundreds of categories), recursive CTE tree queries are fast. The spec caps practical depth at 5 levels. Materialized path and nested sets add write complexity that isn't justified by the read patterns here.

**Alternatives considered**:
- Materialized path (`path` column like `"/root/child/grandchild"`): Faster tree reads but complicates reparenting. Rejected.
- Nested sets (lft/rgt integers): Very fast reads but slow writes. Rejected for a catalogue that is frequently edited.
- `ltree` extension: Clean but adds a PostgreSQL extension dependency. Rejected — `pg_trgm` is already required; adding another extension needs justification.

---

## Decision 4 — Inventory concurrency model

**Context**: FR-023 and SC-004 require that concurrent inventory adjustments to the same product result in a correct final balance. Oversell prevention (negative stock) is also enforced (FR-020).

**Decision**: Pessimistic locking via `SELECT ... FOR UPDATE` on the `inventory_records` row within the `withTenantContext()` transaction. The adjustment is a single SQL update: `UPDATE inventory_records SET quantity = quantity + $delta WHERE id = $id RETURNING quantity`. If the result would be negative, reject before committing.

**Implementation pattern**:
```sql
-- Inside withTenantContext() transaction:
SELECT id, quantity FROM inventory_records
  WHERE product_id = $productId AND variant_id IS NOT DISTINCT FROM $variantId
  FOR UPDATE;  -- locks the row

-- Check if result would go negative:
-- if (current + delta) < 0 AND !allowNegative → reject

UPDATE inventory_records
  SET quantity = quantity + $delta, updated_at = NOW()
  WHERE id = $recordId
  RETURNING quantity AS resulting_balance;

INSERT INTO inventory_transactions (...) VALUES (...);
```

**Rationale**: For a single-facility pharmacy catalogue, pessimistic locking is the correct choice. Contention on any single inventory row is extremely low (a pharmacist restocking an item). Optimistic locking (version counter + retry) adds retry complexity for negligible gain. The `SELECT FOR UPDATE` is confined to one row per adjustment, so it doesn't block unrelated products.

**Alternatives considered**:
- Optimistic locking (version field + compare-and-swap + retry): Cleaner for high-contention scenarios but adds retry loop complexity. Rejected.
- Advisory locks (`pg_try_advisory_xact_lock`): More granular but less obvious and less integrated with RLS/transaction model. Rejected.

---

## Decision 5 — Money representation

**Context**: Products have `price` and `compare_at_price`. Coupons have `discount_value`, `min_order_total`, `max_discount_amount`.

**Decision**: Store all money values as `NUMERIC(10, 2)` in PostgreSQL. In Drizzle, use `numeric('price', { precision: 10, scale: 2 })`. Return as strings from the DB driver (postgres.js returns numeric as string by default) and parse to `Decimal` in the service layer for arithmetic. Never use JavaScript `number` for money arithmetic.

**Rationale**: `NUMERIC` avoids floating-point rounding errors. At 10 digits, the max storable value is $99,999,999.99 — sufficient for any pharmacy product. All monetary display and comparison is done on strings/Decimal objects, not floats.

**Alternatives considered**:
- Integer cents (`price_cents INTEGER`): Avoids all float issues but requires divide-by-100 in every display path. Rejected — pharmacy prices have fractional cents in some jurisdictions but the spec implies dollar values. Can migrate to cents later if needed.
- `float8` / `DOUBLE PRECISION`: Precise enough for display but incorrect for tax/coupon arithmetic. Rejected.

---

## Decision 6 — Images

**Context**: FR-001 allows an ordered list of image URLs. Phase 9 handles upload infrastructure; Phase 3 stores URLs only.

**Decision**: Store images as `TEXT[]` (PostgreSQL array). Drizzle: `.array()` on a `text` column. The array preserves insertion order. An empty array `[]` represents no images.

**Rationale**: A PostgreSQL text array is the simplest model for an ordered list of strings. No join table needed at this stage. If image metadata (alt text, CDN variant URLs) is needed later, migrate to a `product_images` join table.

**Alternatives considered**:
- `JSONB` column: More flexible but array is sufficient and avoids JSONB query complexity.
- Separate `product_images` table: Correct long-term model but premature for Phase 3 where we're storing URLs only.

---

## Decision 7 — Slug generation

**Context**: FR-004 requires URL-safe slugs that are unique within a facility. If none is provided, derive from name.

**Decision**: Generate slugs in the service layer using a `slugify` utility: lowercase the name, replace spaces and special chars with hyphens, collapse consecutive hyphens, strip leading/trailing hyphens. If the resulting slug conflicts with an existing one in the same facility, append a 4-character hex suffix (e.g., `vitamin-c-a3f2`). No npm library needed — a simple 3-line regex function.

**Rationale**: Keeping slug generation in the service layer (not a DB trigger or extension) keeps the logic testable and portable. The uniqueness check uses a DB SELECT before INSERT; this is safe because slug conflicts are extremely rare and the facility context is set.

---

## Decision 8 — Coupon code normalization

**Context**: FR-025 requires case-insensitive uniqueness on coupon codes.

**Decision**: Normalize all coupon codes to UPPERCASE on write (in the service layer before INSERT). Store and compare as uppercase. The unique constraint is on the uppercased `code` column.

**Rationale**: Simpler than a case-insensitive unique index (`LOWER(code)`). The service always uppercases before write and lookup. Consistent display to admins.

---

## Decision 9 — Variant model

**Context**: FR-002 specifies a single dimension label (e.g., "Strength") with variant values. Variants have their own SKU, price, and inventory.

**Decision**: Store variants in a `product_variants` table with columns `product_id`, `dimension_value` (e.g., "500mg"), `sku`, `price`, `compare_at_price`, `is_active`. The parent `products` table stores `variant_dimension_label` (nullable, e.g., "Strength"). If a product has no variants, `variant_dimension_label` is NULL and inventory is tracked on the product directly. If a product has variants, the product-level `price` is a display/fallback price; variant prices take precedence.

**Rationale**: Keeps the product table clean. Variants only exist as a child table when needed. The `variant_dimension_label` on the product communicates what the dimension represents (so the UI can render "Select Strength: [ ] 500mg [ ] 1000mg").

---

## Decision 10 — Inventory record scoping

**Context**: Products may or may not have variants. Inventory must be tracked per product/variant.

**Decision**: `inventory_records` has columns `product_id` (NOT NULL) and `variant_id` (NULLABLE). The pair `(product_id, variant_id)` is unique — one record per product if no variants, one record per variant if variants exist. Constraint: `UNIQUE (product_id, variant_id)` with `variant_id` treated as NULL-safe (PostgreSQL's standard unique index treats NULLs as distinct — use `UNIQUE NULLS NOT DISTINCT` in PG15+ or a conditional unique index).

**Note**: PostgreSQL 15+ supports `UNIQUE NULLS NOT DISTINCT`. This project uses PostgreSQL 16 (confirmed from docker-compose.yml), so this syntax is available.

---

## Resolved: No NEEDS CLARIFICATION markers

All specification gaps resolved via the above decisions. No items require user input before implementation begins.

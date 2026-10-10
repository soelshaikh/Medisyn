# Feature Specification: Ecommerce Catalogue

**Feature Directory**: `specs/003-ecommerce-catalogue`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Phase 3 — Ecommerce Catalogue. Products with variants (size/strength), categories (hierarchical), inventory tracking per facility, coupons (fixed/percent, usage limits, expiry). Admin CRUD for all. Uses Phase 1 foundation: Express + PostgreSQL + RLS + JWT auth.

---

## Scope Note

Phase 3 builds the **catalogue layer only** — the data and management APIs for products, categories, inventory, and coupons. Cart, checkout, and orders (which consume this catalogue) are Phase 4. Coupon validation rules are defined here; coupon enforcement at checkout is Phase 4.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Product Catalogue Browsing (Priority: P1)

A patient or visitor browses the pharmacy's product catalogue. They can filter by category, search by keyword, narrow by price range or brand, and view the full details of any product including its available variants and current stock status.

**Why this priority**: The public product listing is the commercial storefront. Nothing in Phases 4–9 is useful without a browsable, searchable catalogue.

**Independent Test**: A visitor can request the product list and receive paginated, filtered results that reflect only active products at the active facility.

**Acceptance Scenarios**:

1. **Given** an active pharmacy with active products, **When** a visitor requests the product listing without filters, **Then** a paginated list of active products is returned with names, prices, and stock availability.
2. **Given** products across multiple categories, **When** a visitor filters by a specific category, **Then** only products assigned to that category (or its subcategories) are returned.
3. **Given** a keyword search for "vitamin c", **When** submitted, **Then** products with matching terms in their name or description are returned.
4. **Given** a price range filter (e.g., $10–$50), **When** applied, **Then** only products with a current price within that range appear.
5. **Given** a product detail request, **When** fetched by its identifier, **Then** the full product information is returned: name, description, images, price, compare-at price, brand, category, available variants, and stock availability per variant.
6. **Given** a deactivated product, **When** a visitor requests the product listing or searches, **Then** the product does not appear.
7. **Given** an out-of-stock product (zero inventory), **When** listed, **Then** it appears with an out-of-stock indicator but is not hidden from the listing.

---

### User Story 2 — Product Management (Priority: P1)

Admin and staff users with the products permission create and maintain the product catalogue. They can add new products, edit pricing and descriptions, manage variant definitions, and deactivate products that are no longer offered.

**Why this priority**: Without product management, the catalogue cannot be built. P1 alongside browsing.

**Independent Test**: An admin user can create a product, observe it appear in the public listing, update its price, and deactivate it — with each change immediately reflected.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they submit a new product with all required fields (SKU, name, price, category), **Then** the product is created, assigned a URL-safe slug, and appears in the public catalogue.
2. **Given** a product creation with a duplicate SKU, **When** submitted, **Then** the request is rejected with a conflict error.
3. **Given** an existing product, **When** an admin updates its price and description, **Then** the changes are immediately visible in the public listing.
4. **Given** an admin deactivating a product, **When** completed, **Then** the product disappears from public listings but all historical references (e.g., future order history) remain intact.
5. **Given** a product with variants (e.g., strength: 500mg, 1000mg), **When** created, **Then** each variant has its own SKU, price, and inventory balance tracked independently.
6. **Given** a user without the products permission, **When** they attempt to create or update a product, **Then** the request is rejected with a permissions error.

---

### User Story 3 — Category Management (Priority: P1)

Admin users maintain a hierarchical category tree that organises the product catalogue for browsing. Categories can have subcategories. Products are assigned to exactly one category leaf.

**Why this priority**: Category structure is required for filtered browsing (User Story 1). Creating it in this phase enables the public listing to work correctly.

**Independent Test**: An admin user can create a root category, a subcategory under it, assign a product to the subcategory, and a visitor filtering by the root category receives that product in the results.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they create a root category with a name and slug, **Then** it appears in the public category listing.
2. **Given** an existing root category, **When** a subcategory is created with it as the parent, **Then** the parent-child relationship is established and returned in the category tree.
3. **Given** a category assignment that would create a circular reference (Category A → Category B → Category A), **When** submitted, **Then** the request is rejected.
4. **Given** a category listing request, **When** fetched, **Then** the full category hierarchy is returned in a tree structure.
5. **Given** a category with assigned products that is deactivated, **When** deactivated, **Then** the products in that category are NOT automatically deactivated — they retain their own active status.

---

### User Story 4 — Inventory Management (Priority: P2)

Staff with inventory permissions can view current stock levels for any product, make adjustments with a required reason and optional note, and review the full chronological adjustment history.

**Why this priority**: Inventory accuracy is critical for Phase 4 checkout (preventing oversell), but the public catalogue can launch without the admin management UI being complete.

**Independent Test**: An admin user can increase stock by 20 units with reason RESTOCK, and the new balance appears immediately. The adjustment is recorded with the actor's identity, reason, and timestamp.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they submit a stock adjustment of +20 with reason RESTOCK, **Then** the current balance increases by 20 and the adjustment record is created with the actor, reason, quantity delta, resulting balance, and timestamp.
2. **Given** a product with 5 units in stock, **When** an adjustment of −10 is submitted, **Then** the request is rejected because the result would be negative stock.
3. **Given** a product's inventory history request, **When** fetched, **Then** all past adjustments are returned in reverse-chronological order with full details.
4. **Given** a product whose current quantity is at or below its low-stock threshold, **When** an admin lists products with the low-stock filter, **Then** that product appears in the results.
5. **Given** two concurrent adjustment requests for the same product, **When** both complete, **Then** the final balance equals the sum of both adjustments — no quantity is lost or duplicated.

---

### User Story 5 — Coupon Management (Priority: P2)

Admin users create and manage discount coupons that customers will apply at checkout (Phase 4). Coupons define the discount type, valid period, usage constraints, and minimum order requirements. The management API created here is consumed by Phase 4 checkout.

**Why this priority**: Coupons enhance Phase 4 but are not required for the first checkout to function. P2 because the data model and management API are needed before Phase 4 begins.

**Independent Test**: An admin user can create a percentage coupon, retrieve it by code, update its active status, and a lookup by code returns the correct coupon details.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they create a PERCENTAGE coupon (code: SAVE20, 20% off, min order $50, max discount $100, 500 total uses, 1 per customer, valid 30 days), **Then** the coupon is created and retrievable by code.
2. **Given** an admin user, **When** they create a FIXED_AMOUNT coupon ($15 off, no minimum), **Then** it is created and available for checkout validation.
3. **Given** a duplicate coupon code (case-insensitive), **When** a creation attempt is made, **Then** the request is rejected with a conflict error.
4. **Given** an admin user deactivating a coupon, **When** completed, **Then** a checkout validation request for that code returns a "coupon inactive" rejection.
5. **Given** a coupon whose end date has passed, **When** a checkout validates it, **Then** the validation returns a "coupon expired" rejection.
6. **Given** a coupon that has reached its total usage limit, **When** validated at checkout, **Then** the validation returns a "usage limit reached" rejection.

---

### Edge Cases

- A product's category is deactivated: the product remains visible in the catalogue by direct ID lookup and in non-category-filtered listing, but does not appear in category-filtered browsing for that category.
- Two admin users concurrently update the same product's price: the last write wins. No partial-write state should be possible.
- Two concurrent inventory adjustments to the same product: both must complete atomically. The final balance must equal the mathematically correct sum.
- A coupon's per-customer limit (1 use) conflicts with total usage limit (500 uses): both are enforced independently. Whichever constraint is hit first blocks the application. (Phase 4 concern, but the data model must represent both.)
- A product's price is updated while customers have it in their carts: the cart records the price at time of checkout, not time of add-to-cart. The catalogue price change takes effect for future checkouts immediately. (Cart and checkout are Phase 4.)
- A variant is deactivated while the parent product is active: the variant becomes unavailable for selection. The parent product remains listed.

---

## Requirements *(mandatory)*

### Functional Requirements

**Products**

- **FR-001**: The system MUST allow authorised users to create a product with: SKU (unique within the facility), name, slug (unique within the facility, auto-generated from name if not provided), description, short description (optional), brand (optional), category assignment, base price, compare-at price (optional), images as URL references (optional, ordered list), low-stock threshold (optional, default 0), active status (default active), and featured flag (default false).
- **FR-002**: The system MUST allow products to have optional variants defined by a single dimension label (e.g., "Strength" or "Size"). Each variant has its own SKU (unique within the facility), price, compare-at price (optional), and independent inventory.
- **FR-003**: The system MUST enforce that product SKUs are unique within a facility. Duplicate SKU creation requests MUST be rejected.
- **FR-004**: The system MUST enforce that product slugs are unique within a facility. If no slug is provided, a URL-safe slug is derived from the product name.
- **FR-005**: The system MUST provide a public product listing endpoint supporting: pagination (page and limit), filtering by category (including subcategories), filtering by brand, filtering by price range (min/max), filtering by availability (in-stock / all), filtering by featured flag, sorting by newest, price ascending, price descending, name ascending, name descending, and free-text keyword search across name and description.
- **FR-006**: The system MUST provide a public product detail endpoint returning the full product record including all variants, current prices, and per-variant stock availability.
- **FR-007**: The system MUST exclude deactivated products from all public listing and search endpoints.
- **FR-008**: The system MUST allow authorised users to update any field of an existing product.
- **FR-009**: The system MUST allow authorised users to deactivate a product. Deactivated products must not be deleted; all historical data and references are preserved.
- **FR-010**: The system MUST record the identity of the actor who created and last modified each product.

**Categories**

- **FR-011**: The system MUST allow authorised users to create a category with: name, slug (unique within the facility), description (optional), parent category (optional — omit for root categories), display order (optional, default 0), image URL (optional), and active status (default active).
- **FR-012**: The system MUST support hierarchical categories by allowing any non-root category to reference a parent category. The system MUST support at least three levels of depth (root → child → grandchild).
- **FR-013**: The system MUST prevent circular parent-child assignments. Any request that would create a cycle in the category hierarchy MUST be rejected.
- **FR-014**: The system MUST provide a category listing endpoint that returns all active categories in a hierarchical tree structure.
- **FR-015**: The system MUST allow authorised users to update category fields including reassigning the parent category (subject to cycle prevention).
- **FR-016**: The system MUST allow authorised users to deactivate a category. Deactivating a category MUST NOT automatically deactivate products assigned to it.

**Inventory**

- **FR-017**: The system MUST maintain a current stock quantity for each product (or each variant, if variants are defined) scoped to the facility.
- **FR-018**: The system MUST require a reason code for every inventory adjustment. Valid reason codes: RESTOCK, DAMAGED, MANUAL_ADJUSTMENT, RETURN, WRITE_OFF, OTHER.
- **FR-019**: The system MUST record every inventory adjustment as an immutable entry containing: product ID, variant ID (if applicable), quantity delta (positive or negative), resulting balance after adjustment, reason code, free-text note (optional), actor identity, and timestamp.
- **FR-020**: The system MUST reject an inventory adjustment whose result would produce a negative balance, unless the facility is explicitly configured to allow negative stock.
- **FR-021**: The system MUST provide an inventory adjustment history endpoint for any product (or variant), returning all past adjustments paginated in reverse-chronological order.
- **FR-022**: The system MUST flag a product (or variant) as "low stock" when its current balance is at or below the product's configured low-stock threshold.
- **FR-023**: Inventory adjustments MUST be concurrency-safe. Concurrent adjustments to the same product/variant MUST NOT result in an incorrect final balance.

**Coupons**

- **FR-024**: The system MUST allow authorised users to create a coupon with: code (unique, case-insensitive), discount type (PERCENTAGE or FIXED_AMOUNT), discount value, start date (optional — if absent, active immediately), end date (optional), minimum order total (optional), maximum discount cap in dollars (optional — only applies to PERCENTAGE coupons), total usage limit (optional — if absent, unlimited), per-customer usage limit (optional), applicable product IDs (optional — if absent, applies to all products), applicable category IDs (optional — if absent, applies to all categories), and active flag.
- **FR-025**: The system MUST enforce case-insensitive uniqueness on coupon codes. Duplicate code creation MUST be rejected.
- **FR-026**: The system MUST allow authorised users to update a coupon's fields including toggling its active status.
- **FR-027**: The system MUST provide a coupon validation endpoint (used by Phase 4 checkout) that accepts a code and returns either the coupon's applicable discount details or a structured rejection reason (EXPIRED, INACTIVE, USAGE_LIMIT_REACHED, MINIMUM_NOT_MET, INVALID_CODE).
- **FR-028**: The system MUST track the total redemption count per coupon to support usage limit enforcement at checkout.
- **FR-029**: Coupon internal notes and management metadata MUST NOT be exposed to customers via the validation endpoint or any public endpoint.

**Access Control**

- **FR-030**: Product create, update, and deactivate operations MUST require the `products.manage` permission.
- **FR-031**: Category create, update, and deactivate operations MUST require the `categories.manage` permission.
- **FR-032**: Inventory view operations MUST require the `inventory.read` permission. Inventory adjustment operations MUST require the `inventory.adjust` permission.
- **FR-033**: Coupon create, update, deactivate, and management listing operations MUST require the `coupons.manage` permission. The coupon validation endpoint used at checkout is internal and must be authenticated.
- **FR-034**: All catalogue data (products, categories, inventory, coupons) MUST be scoped to the facility. One facility's staff MUST NOT be able to view or modify another facility's catalogue.

### Key Entities

- **Product**: A saleable item in the pharmacy's catalogue. Has pricing, category assignment, stock configuration, and optional variants. Scoped to a facility.
- **ProductVariant**: An optional sub-item of a Product representing a distinct option (e.g., 500mg vs 1000mg Vitamin C). Has its own SKU, price, and inventory tracked separately.
- **Category**: A hierarchical organisational unit for products. Can have one parent and many children. Scoped to a facility.
- **InventoryRecord**: The current stock balance for a product (or variant). Updated atomically on each adjustment.
- **InventoryTransaction**: An immutable audit record of every stock quantity change. Never updated — append-only.
- **Coupon**: A discount code with configurable discount type, value, validity window, and usage constraints. Consumed by the checkout flow in Phase 4.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff user creates a new product and it appears in the public product listing within 3 seconds of saving — no manual cache refresh required.
- **SC-002**: The public product listing returns paginated results for a catalogue of up to 10,000 products in under 1 second under normal operating conditions.
- **SC-003**: Keyword search across the product catalogue returns the first page of relevant results in under 1 second.
- **SC-004**: A concurrent stress test of 100 simultaneous inventory adjustments (50 additions and 50 subtractions of equal size) to the same product results in a final balance exactly equal to the initial balance, with all 100 adjustment records preserved.
- **SC-005**: Coupon code validation returns a result (approved or rejected with reason) in under 500ms.
- **SC-006**: Every inventory adjustment in the system has a complete record: actor identity, reason code, quantity delta, resulting balance, and timestamp. Zero adjustments exist without this metadata.
- **SC-007**: All product, category, inventory adjustment, and coupon write operations require an authenticated session with the appropriate permission. Unauthenticated or under-privileged requests receive 401 or 403 responses — never a 200 or 500.
- **SC-008**: A category tree query returns the full hierarchy in a single response without requiring the client to make additional requests per level.

---

## Assumptions

- Catalogue data (products, categories, inventory, coupons) is fully scoped per facility. Multi-facility browsing (e.g., searching across all pharmacies) is out of scope.
- Product variants use a single dimension only (e.g., "Strength" with values 500mg / 1000mg). Multiple variant axes (e.g., both size and colour) are deferred to a future phase.
- Category hierarchy depth is not artificially limited but should be kept reasonable (≤ 5 levels) in practice. The system enforces cycle prevention; depth enforcement is an operational concern.
- By default, negative inventory is not permitted. If a facility requires it (e.g., back-order scenarios), it is a per-facility configuration flag.
- Product images are referenced by URL (e.g., a CDN or public S3 path). Image upload infrastructure is deferred to Phase 9 (File Storage). Phase 3 stores and returns image URLs only.
- Coupon applicability scoping (restricting a coupon to specific products or categories) is modelled in the data but enforcement is a Phase 4 checkout responsibility.
- Coupon stacking (applying more than one coupon to a single order) is not supported — one coupon per order.
- Tax and shipping calculations are out of scope for this phase. They are handled in Phase 4 checkout.
- Online payment is out of scope for the entire project at this time. No payment gateway integration exists in this phase or Phase 4.
- Controlled substance handling (narcotics, restricted medications) is not modelled in Phase 3. No special product flags or regulatory workflows are required at this stage — this is deferred pending compliance guidance.
- Product search in Phase 3 uses basic text matching across name and description fields. Full-text or relevance-ranked search can be introduced as an enhancement in a later phase.
- The admin roles and permission bundles (which specific staff roles receive `products.manage`, `inventory.adjust`, etc.) are defined outside this feature and inherited from the RBAC system built in Phase 1.

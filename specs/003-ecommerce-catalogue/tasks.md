# Tasks: Ecommerce Catalogue

**Input**: Design documents from `specs/003-ecommerce-catalogue/`

**Prerequisites**: plan.md âœ…, spec.md âœ…, research.md âœ…, data-model.md âœ…, contracts/ âœ…, quickstart.md âœ…

**Tests**: Integration tests included â€” consistent with Phase 1 and Phase 2 conventions.

**Organization**: Tasks grouped by user story. Each story is independently implementable and testable.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in the same phase)
- **[Story]**: Which user story this task belongs to (US1â€“US5)
- Exact file paths included in all task descriptions

## Path Conventions

All source paths are relative to the repo root: `backend/src/`, `backend/tests/`, `backend/drizzle/`.

---

## Phase 1: Setup (Database Layer)

**Purpose**: Schema files, migration, database verification, permissions seed. No user story work begins until Phase 1 is complete.

- [X] T001 Create module directory skeleton at `backend/src/modules/catalogue/` with subdirectories `products/`, `categories/`, `inventory/`, `coupons/`
- [X] T002 [P] Create `backend/src/db/schema/catalogue.ts` with all 6 table definitions from `specs/003-ecommerce-catalogue/data-model.md Â§Table Definitions`: `categories`, `products`, `product_variants`, `inventory_records`, `inventory_transactions`, `coupons` â€” use `numeric('col', { precision: 10, scale: 2 })` for all money columns; `text('images').array().notNull().default([])` for product images; `variantDimensionLabel` nullable text
- [X] T003 Update `backend/src/db/index.ts`: add `import * as catalogueSchema from './schema/catalogue'` and spread `...catalogueSchema` into the `schema` object used by both `db` and `superAdminDb` drizzle instances
- [X] T004 Generate the Drizzle migration with `npm run db:generate`, then manually append the SQL block from `specs/003-ecommerce-catalogue/data-model.md Â§Migration SQL` to the generated file â€” covering: (1) self-referential FK `categories.parent_id â†’ categories.id`, (2) `UNIQUE NULLS NOT DISTINCT (product_id, variant_id)` on `inventory_records`, (3) `CREATE EXTENSION IF NOT EXISTS pg_trgm` + two GIN trigram indexes on `products.name` and `products.description`, (4) four check constraints (price â‰¥ 0, discount_value > 0, percentage range 1â€“100, inventory quantity floor), (5) `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING (facility_id = current_facility_id()) WITH CHECK (...)` for all 6 tables, (6) `REVOKE UPDATE, DELETE ON inventory_transactions FROM app_user; REVOKE UPDATE, DELETE ON inventory_transactions FROM app_super_admin`, (7) GRANT SELECT/INSERT/UPDATE/DELETE on `categories`, `products`, `product_variants`, `inventory_records`, `coupons` to both `app_user` and `app_super_admin`; GRANT SELECT/INSERT only on `inventory_transactions` to both roles
- [X] T005 Run `npm run db:migrate` against the running Docker PostgreSQL instance and verify: (a) `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('categories','products','product_variants','inventory_records','inventory_transactions','coupons')` returns 6, (b) `SELECT relrowsecurity FROM pg_class WHERE relname='inventory_transactions'` returns `t`, (c) `SELECT has_table_privilege('app_user','inventory_transactions','UPDATE')` returns `f`
- [X] T006 [P] Create `backend/src/db/seeds/catalogue-permissions.ts`: insert 5 permission rows â€” `products.manage`, `categories.manage`, `inventory.read`, `inventory.adjust`, `coupons.manage` â€” all with `moduleId` set to the ecommerce platform module UUID (query it from `platform_modules` where `slug = 'ecommerce'`); use `ON CONFLICT (key) DO NOTHING`
- [X] T007 Add the catalogue-permissions seed to the seed runner (`backend/src/db/seeds/index.ts` or equivalent entry point) and run `npm run db:seed`; confirm all 5 permission rows exist in the `permissions` table
- [X] T008 Run `npm run typecheck` â€” zero TypeScript errors with the new schema imports wired into `db/index.ts`

**Checkpoint**: 6 tables with RLS exist; 5 catalogue permissions seeded; `npm run typecheck` passes.

---

## Phase 2: Foundational Utilities

**Purpose**: Shared utilities and test fixtures that every user story depends on. Must be complete before any user story phase begins.

- [X] T009 [P] Create `backend/src/lib/slugify.ts`: export `slugify(input: string): string` â€” lowercase, replace `/[^a-z0-9]+/g` with `'-'`, strip leading/trailing hyphens with `/^-+|-+$/g`; export `uniqueSlug(base: string, existingSlugs: string[]): string` â€” appends a 4-char lowercase hex suffix (e.g., `vitamin-c-a3f2`) when base conflicts with an existing slug; no npm dependencies
- [X] T010 [P] Create `backend/src/middleware/resolve-facility.ts`: export `resolveFacility` as an Express `RequestHandler` â€” reads `X-Facility-ID` header, validates as UUID format (`/^[0-9a-f-]{36}$/i`), queries `facilities` table via `superAdminDb` (no `withTenantContext` â€” this is a super-admin cross-facility lookup), checks `facility.status === 'active'`; attaches `facilityId` to `res.locals.facilityId`; errors: 400 `MISSING_FACILITY_ID` (header absent), 400 `INVALID_FACILITY_ID` (not a UUID), 404 `FACILITY_NOT_FOUND`, 403 `FACILITY_SUSPENDED`
- [X] T011 [P] Create `backend/src/modules/catalogue/catalogue.types.ts`: export `InventoryReason = 'RESTOCK' | 'DAMAGED' | 'MANUAL_ADJUSTMENT' | 'RETURN' | 'WRITE_OFF' | 'OTHER'`; `INVENTORY_REASONS: readonly InventoryReason[]` (array for Zod `.enum()`); `CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT'`; `CouponValidationRejectionReason = 'EXPIRED' | 'INACTIVE' | 'USAGE_LIMIT_REACHED' | 'MINIMUM_NOT_MET' | 'INVALID_CODE'`; `StockStatus = 'in_stock' | 'out_of_stock' | 'low_stock'`
- [X] T012 [P] Create `backend/tests/setup/catalogue-fixtures.ts`: export `createTestCategory(facilityId: string, overrides?: Partial<{name, slug, parentId, isActive}>): Promise<{id: string, slug: string, name: string}>` â€” inserts via `superAdminDb` bypassing RLS; export `createTestProduct(facilityId: string, overrides?: Partial<{sku, name, categoryId, price, isActive, variantDimensionLabel}>): Promise<{id: string, sku: string, slug: string, name: string, inventoryRecordId: string}>` â€” inserts product + one `inventory_records` row (quantity: 0) via `superAdminDb`; export `createTestVariant(productId: string, facilityId: string, overrides?: Partial<{sku, dimensionValue, price}>): Promise<{id: string, sku: string, inventoryRecordId: string}>` â€” inserts variant + one `inventory_records` row; export `setInventoryQuantity(inventoryRecordId: string, quantity: number): Promise<void>` â€” direct UPDATE via `superAdminDb` for test setup
- [X] T013 Create `backend/src/modules/catalogue/catalogue.router.ts` as the parent catalogue router: placeholder file that will import and mount child routers as each phase completes; export `catalogueRouter = Router()`
- [X] T014 Register catalogue router in `backend/src/app.ts`: add `import { catalogueRouter } from './modules/catalogue/catalogue.router'` and `app.use('/api/v1/catalogue', catalogueRouter)` before the error handler; confirm server starts with `npm run dev` and `/api/v1/catalogue/nonexistent` returns 404 (not 500)
- [X] T015 Run `npm run typecheck` and `npm run lint` â€” zero errors across all new files from Phases 1 and 2

**Checkpoint**: Shared utilities exist; catalogue router mounted; fixtures available for tests; zero TS/lint errors.

---

## Phase 3: User Story 2 â€” Product Management (Priority: P1)

**Goal**: Admin users can create products (with optional variants), update pricing/descriptions, deactivate products, and manage variants. Each product gets a unique slug; SKU conflicts are rejected with a 409. Inventory records are auto-created with `quantity: 0` on product and variant creation.

**Independent Test**: `POST /api/v1/catalogue/products` creates a product + inventory record â†’ `PATCH` updates its price â†’ `DELETE` deactivates it. Without `products.manage` permission, write operations return 403.

- [X] T016 [P] [US2] Create `backend/src/modules/catalogue/products/product.types.ts`: `CreateProductInput` (sku required, name required, price required string, categoryId optional uuid, compareAtPrice optional string, shortDescription optional, brand optional, images optional string[], variantDimensionLabel optional, lowStockThreshold optional integer default 0, isFeatured optional boolean default false, isActive optional boolean default true, variants optional `CreateVariantInput[]`); `UpdateProductInput` (all optional); `CreateVariantInput` (sku required, dimensionValue required, price required string, compareAtPrice optional); `UpdateVariantInput` (all optional); `ProductRow`; `VariantRow`
- [X] T017 [P] [US2] Create `backend/src/modules/catalogue/products/product.validator.ts`: `CreateProductBodySchema` (Zod) â€” price and compareAtPrice validated as `/^\d+(\.\d{1,2})?$/`; sku max 100 chars; name required max 255 chars; images array max 20 items; `UpdateProductBodySchema` (all fields optional, same validation rules); `CreateVariantBodySchema`; `UpdateVariantBodySchema`
- [X] T018 [P] [US2] Create `backend/src/modules/catalogue/products/product.queries.ts` (write and admin-read queries): `insertProduct(tx, facilityId, actorId, data): Promise<ProductRow>`; `insertVariant(tx, facilityId, productId, actorId, data): Promise<VariantRow>`; `insertInventoryRecord(tx, facilityId, productId, variantId: string | null): Promise<{id: string}>`; `findProductById(tx, id): Promise<ProductRow | null>`; `findVariantById(tx, variantId): Promise<VariantRow | null>`; `findVariantsByProductId(tx, productId): Promise<VariantRow[]>`; `updateProduct(tx, id, actorId, data): Promise<ProductRow>`; `updateVariant(tx, id, data): Promise<VariantRow>`; `checkSkuExists(tx, facilityId, sku, excludeId?: string): Promise<boolean>`; `checkVariantSkuExists(tx, facilityId, sku, excludeId?: string): Promise<boolean>`; `checkSlugExists(tx, facilityId, slug, excludeProductId?: string): Promise<boolean>`
- [X] T019 [US2] Create `backend/src/modules/catalogue/products/product.service.ts` â€” implement `createProduct(tx, facilityId, actorId, input: CreateProductInput): Promise<{id, sku, slug}>`: (1) `checkSkuExists` â†’ throw 409 `SKU_CONFLICT` if true; (2) if slug provided: `checkSlugExists` â†’ throw 409 `SLUG_CONFLICT`; else: `slugify(name)` â†’ `uniqueSlug` to resolve conflicts; (3) if `variants` provided and non-empty: require `variantDimensionLabel` to be set, validate each variant SKU unique via `checkVariantSkuExists`; (4) `insertProduct`; (5) if variants: insert each variant + `insertInventoryRecord(tx, facilityId, productId, variant.id)` per variant; (6) if no variants: `insertInventoryRecord(tx, facilityId, productId, null)`; (7) write `audit_log` entry with action `'product.created'`, actorId, facilityId, metadata `{productId, sku}`
- [X] T020 [US2] Add to `product.service.ts` â€” `updateProduct(tx, facilityId, actorId, productId, input: UpdateProductInput)`: find product â†’ if SKU changed: `checkSkuExists` â†’ throw `SKU_CONFLICT`; if slug provided and changed: `checkSlugExists` â†’ throw `SLUG_CONFLICT`; `updateProduct` query; write `audit_log` `'product.updated'`; return `{id, updatedAt}`
- [X] T021 [US2] Add to `product.service.ts` â€” `deactivateProduct(tx, facilityId, actorId, productId)`: `findProductById` â†’ throw 404 `PRODUCT_NOT_FOUND` if absent; throw 409 `PRODUCT_ALREADY_INACTIVE` if `isActive=false`; `updateProduct(tx, id, actorId, {isActive: false})`; write `audit_log` `'product.deactivated'`; return `{id, isActive: false, updatedAt}`
- [X] T022 [US2] Add to `product.service.ts` â€” `addVariant(tx, facilityId, actorId, productId, input: CreateVariantInput)`: `findProductById` â†’ 404 if absent; throw 422 `VARIANT_DIMENSION_REQUIRED` if `product.variantDimensionLabel` is null; `checkVariantSkuExists` â†’ 409 `VARIANT_SKU_CONFLICT`; `insertVariant`; `insertInventoryRecord(tx, facilityId, productId, variant.id)`; write `audit_log` `'product.variant_added'`
- [X] T023 [US2] Add to `product.service.ts` â€” `updateVariant(tx, facilityId, actorId, productId, variantId, input)`: find variant, verify `variant.productId === productId` â†’ 404 if mismatch; if SKU changed: `checkVariantSkuExists`; `updateVariant` query; write `audit_log` `'product.variant_updated'`; `deactivateVariant(tx, facilityId, actorId, productId, variantId)`: same find+verify â†’ `updateVariant(tx, id, {isActive: false})`; write `audit_log` `'product.variant_deactivated'`
- [X] T024 [US2] Create `backend/src/modules/catalogue/products/product.router.ts` with all 6 write endpoints â€” each uses `authMiddleware` + `requirePermission('products.manage')` + `withTenantContext(res.locals.facilityId || req.facilityId)` + service call: `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`, `POST /products/:id/variants`, `PATCH /products/:id/variants/:variantId`, `DELETE /products/:id/variants/:variantId`; all responses follow contracts/products.md structure
- [X] T025 [US2] Mount `productRouter` in `catalogue.router.ts`: `catalogueRouter.use('/', productRouter)`
- [X] T026 [US2] Write `backend/tests/catalogue/products.test.ts` covering ACC scenarios US2-1 through US2-6: US2-1 create product â†’ 201 + auto-slug; US2-2 duplicate SKU â†’ 409 `SKU_CONFLICT`; US2-3 update price â†’ 200, new price returned; US2-4 deactivate â†’ 200 `isActive=false`; US2-5 create with variants â†’ each variant has own inventory_record row with `quantity=0`; US2-6 no permission â†’ 403 `FORBIDDEN`; run: `npm run test -- tests/catalogue/products.test.ts`

**Checkpoint**: All products.test.ts tests pass. `POST /products`, `PATCH`, `DELETE`, and variant endpoints are functional.

---

## Phase 4: User Story 3 â€” Category Management (Priority: P1)

**Goal**: Admin users create root and subcategories, update them, deactivate them. A recursive CTE prevents circular parentage. Deactivating a category does NOT deactivate its assigned products.

**Independent Test**: `POST /catalogue/categories` â†’ 201 with auto-slug; `POST` subcategory â†’ parent-child linked; `PATCH` with cycle-creating parentId â†’ 409; `DELETE` category â†’ products in it still have `isActive=true`.

- [X] T027 [P] [US3] Create `backend/src/modules/catalogue/categories/category.types.ts`: `CreateCategoryInput` (name required, slug optional, parentId optional uuid, description optional, imageUrl optional, displayOrder optional integer â‰¥ 0, isActive optional boolean); `UpdateCategoryInput` (all optional); `CategoryRow`; `CategoryTreeNode` (id, name, slug, description, imageUrl, displayOrder, children: CategoryTreeNode[])
- [X] T028 [P] [US3] Create `backend/src/modules/catalogue/categories/category.validator.ts`: `CreateCategoryBodySchema` â€” name required max 255 chars; slug optional max 255 chars validated with `/^[a-z0-9-]+$/`; parentId optional uuid; displayOrder optional `z.number().int().min(0)`; `UpdateCategoryBodySchema` (all optional, same rules)
- [X] T029 [P] [US3] Create `backend/src/modules/catalogue/categories/category.queries.ts`: `insertCategory(tx, facilityId, actorId, data): Promise<CategoryRow>`; `findCategoryById(tx, id): Promise<CategoryRow | null>`; `updateCategory(tx, id, actorId, data): Promise<CategoryRow>`; `checkSlugExists(tx, facilityId, slug, excludeId?: string): Promise<boolean>`; `detectCycle(tx, categoryId: string, proposedParentId: string): Promise<boolean>` â€” recursive CTE: `WITH RECURSIVE ancestors AS (SELECT id, parent_id FROM categories WHERE id = $proposedParentId UNION ALL SELECT c.id, c.parent_id FROM categories c JOIN ancestors a ON c.id = a.parent_id) SELECT 1 FROM ancestors WHERE id = $categoryId LIMIT 1` â€” returns true if categoryId appears in the ancestor chain; `getActiveChildren(tx, parentId): Promise<{id: string}[]>` â€” SELECT where parent_id = parentId AND is_active = true
- [X] T030 [US3] Create `backend/src/modules/catalogue/categories/category.service.ts`: `createCategory(tx, facilityId, actorId, input)`: generate slug from name if not provided (`uniqueSlug`) â†’ `checkSlugExists` â†’ if parentId: `findCategoryById(parentId)` â†’ 404 `PARENT_NOT_FOUND` if absent â†’ `insertCategory` â†’ write `audit_log` `'category.created'`; `updateCategory(tx, facilityId, actorId, id, input)`: find category â†’ if slug changed: check uniqueness â†’ if parentId changed: `detectCycle(id, newParentId)` â†’ 409 `CYCLE_DETECTED` if true â†’ `updateCategory` â†’ write `'category.updated'`; `deactivateCategory(tx, facilityId, actorId, id)`: find category â†’ `getActiveChildren` â†’ 409 `CATEGORY_HAS_ACTIVE_CHILDREN` if any â†’ set `isActive=false` â†’ write `'category.deactivated'` â€” products assigned to this category are NOT deactivated (per FR-016; service explicitly does NOT touch the `products` table)
- [X] T031 [US3] Create `backend/src/modules/catalogue/categories/category.router.ts`: `POST /categories` (`authMiddleware + requirePermission('categories.manage')`); `PATCH /categories/:id` (same); `DELETE /categories/:id` (same); also stub `GET /categories` and `GET /categories/:id` routes (service functions to be added in Phase 5)
- [X] T032 [US3] Mount `categoryRouter` in `catalogue.router.ts`: `catalogueRouter.use('/', categoryRouter)`
- [X] T033 [US3] Write `backend/tests/catalogue/categories.test.ts` covering ACC scenarios US3-1 through US3-5: US3-1 create root category â†’ 201 auto-slug; US3-2 create subcategory with parentId â†’ parent-child in tree query; US3-3 PATCH parentId to create cycle â†’ 409 `CYCLE_DETECTED`; US3-4 GET /catalogue/categories â†’ returns tree array with `children` (exercised after Phase 5 completes GET endpoint â€” mark this test as requiring Phase 5); US3-5 DELETE category â†’ products in it still `isActive=true` (verify via direct superAdminDb query in test); run: `npm run test -- tests/catalogue/categories.test.ts`

**Checkpoint**: Category management tests pass. Hierarchical CRUD works; cycle detection proven.

---

## Phase 5: User Story 1 â€” Product Catalogue Browsing (Priority: P1)

**Goal**: Public GET endpoints for product listing (filters, sorting, pagination, search), product detail (with variants + stockStatus), and category tree. All require `X-Facility-ID` header; no authentication required.

**Independent Test**: `GET /api/v1/catalogue/products` with `X-Facility-ID` header returns paginated active products. `GET /api/v1/catalogue/products?search=vitamin` returns matching products. `GET /api/v1/catalogue/categories` returns full tree in one request.

- [X] T034 [P] [US1] Add `listProducts` query to `backend/src/modules/catalogue/products/product.queries.ts`: `listProducts(tx, facilityId, filters: ListProductsFilters): Promise<{rows: ProductListRow[], total: number}>` â€” `ListProductsFilters`: `{categoryId?: string, brand?: string, priceMin?: string, priceMax?: string, inStock?: boolean, featured?: boolean, search?: string, sort?: 'created_desc'|'price_asc'|'price_desc'|'name_asc'|'name_desc', page: number, limit: number}`; WHERE clause: always filter `is_active = true`; `categoryId` filter: recursive CTE to collect all descendant category IDs then `category_id IN (...)` ; `search` filter: `name ILIKE $1 OR description ILIKE $1` where `$1 = '%' + term + '%'` â€” use parameterized query, never string interpolation; `priceMin`/`priceMax`: `price >= $2 AND price <= $3`; `inStock=true`: LEFT JOIN inventory_records on product, filter sum of quantity > 0; ORDER BY: map sort values to SQL; pagination: LIMIT/OFFSET; count total separately with `COUNT(*) OVER()`
- [X] T035 [P] [US1] Add `getProductDetail` query to `backend/src/modules/catalogue/products/product.queries.ts`: `getProductDetail(tx, id): Promise<ProductDetailRow | null>` â€” fetches product + all active variants + per-variant inventory quantity; compute `stockStatus` per variant: `quantity <= 0 â†’ 'out_of_stock'`; `0 < quantity <= product.lowStockThreshold â†’ 'low_stock'`; `quantity > lowStockThreshold â†’ 'in_stock'`; for products without variants: compute stockStatus at product level from the single inventory_records row; return null if product not found or `isActive=false`
- [X] T036 [P] [US1] Add to `backend/src/modules/catalogue/categories/category.queries.ts`: `getCategoryTree(tx, facilityId): Promise<CategoryTreeNode[]>` â€” fetch all `isActive=true` categories for the facility ordered by `display_order ASC`; build tree in-memory: separate root categories (parentId IS NULL), recursively attach children; return array of `CategoryTreeNode`; `getCategoryById(tx, id): Promise<(CategoryRow & {children: {id, name, slug, isActive}[]}) | null>` â€” fetch category + its direct children only (one level, not recursive)
- [X] T037 [US1] Add `GET /products` endpoint to `backend/src/modules/catalogue/products/product.router.ts`: `resolveFacility` middleware + `withTenantContext(res.locals.facilityId)` â†’ `listProducts(tx, facilityId, parsedFilters)` â†’ 200 paginated response; validate all query params with Zod inline (page â‰¥ 1, limit 1â€“100 default 20, priceMin/priceMax as optional numeric strings, sort one of 5 valid values, categoryId optional UUID, brand optional string, inStock optional boolean, featured optional boolean, search optional string)
- [X] T038 [US1] Add `GET /products/:id` endpoint to `backend/src/modules/catalogue/products/product.router.ts`: `resolveFacility` + `withTenantContext` â†’ `getProductDetail(tx, id)` â†’ 404 `PRODUCT_NOT_FOUND` if null â†’ 200 full detail response including `variants[]` each with `{id, sku, dimensionValue, price, compareAtPrice, isActive, stockStatus, quantity}`; for products without variants: `stockStatus` and `quantity` are at the product level (not in a variants array)
- [X] T039 [US1] Add `GET /categories` endpoint to `backend/src/modules/catalogue/categories/category.router.ts`: `resolveFacility` + `withTenantContext` â†’ `getCategoryTree(tx, facilityId)` â†’ 200 tree response; categories sorted by `displayOrder ASC` within each level
- [X] T040 [US1] Add `GET /categories/:id` endpoint to `category.router.ts`: `resolveFacility` + `withTenantContext` â†’ `getCategoryById(tx, id)` â†’ 404 `CATEGORY_NOT_FOUND` if null or inactive â†’ 200 with category fields + `children[]` (direct children only)
- [X] T041 [US1] Write `backend/tests/catalogue/browsing.test.ts` covering ACC scenarios US1-1 through US1-7: US1-1 GET products no filters â†’ paginated list, each item has `stockStatus`; US1-2 GET products `?category_id=<root>` â†’ includes products in subcategories (recursive); US1-3 GET products `?search=vitamin+c` â†’ matching products returned; US1-4 GET products `?price_min=10&price_max=50` â†’ only products in range; US1-5 GET products `/:id` â†’ full detail with variants and per-variant stockStatus; US1-6 GET products after deactivation â†’ deactivated product absent; US1-7 GET products for out-of-stock product â†’ present with `stockStatus:'out_of_stock'`; run: `npm run test -- tests/catalogue/browsing.test.ts`
- [X] T042 [US1] Verify SC-002 and SC-003 response time targets: after test fixtures create 100+ products across multiple categories, assert `GET /api/v1/catalogue/products` and `GET /api/v1/catalogue/products?search=vitamin` respond within 1000ms (use `performance.now()` timing in the test, or manually time and record in a comment)

**Checkpoint**: browsing.test.ts passes. Full public product browsing and category tree work end-to-end. Phase 3 (all P1 stories) is complete.

---

## Phase 6: User Story 4 â€” Inventory Management (Priority: P2)

**Goal**: Staff can view current stock, make `SELECT FOR UPDATE`-protected adjustments (with mandatory reason), and review the append-only adjustment history. Negative stock blocked unless `allowNegative=true`.

**Independent Test**: `POST /catalogue/inventory/products/:id/adjust` with `reason=RESTOCK, delta=+20` â†’ resultingBalance=20; `POST` with `delta=-999` on 5-unit stock â†’ 409 `INSUFFICIENT_STOCK`; `GET /history` â†’ one record with complete metadata (actor, reason, delta, balance, timestamp).

- [X] T043 [P] [US4] Create `backend/src/modules/catalogue/inventory/inventory.types.ts`: `AdjustInput` (variantId optional uuid, quantityDelta non-zero integer, reason `InventoryReason`, note optional string max 500 chars); `InventoryRecordRow`; `InventoryTransactionRow`; `InventoryHistoryRow` (extends transaction with actorName from users join); `LowStockRow` (productId, productName, variantId, variantDimensionValue, quantity, lowStockThreshold)
- [X] T044 [P] [US4] Create `backend/src/modules/catalogue/inventory/inventory.validator.ts`: `AdjustBodySchema` â€” `variantId` optional UUID; `quantityDelta` `z.number().int().refine(n => n !== 0, {message: 'quantityDelta cannot be zero'})`; `reason` `z.enum(INVENTORY_REASONS as [string, ...string[]])`; `note` optional `z.string().max(500)`; pagination query params schema for history/low-stock endpoints
- [X] T045 [P] [US4] Create `backend/src/modules/catalogue/inventory/inventory.queries.ts`: `lockInventoryRecord(tx, productId, variantId: string | null): Promise<InventoryRecordRow>` â€” `SELECT id, quantity, allow_negative FROM inventory_records WHERE product_id = $1 AND variant_id IS NOT DISTINCT FROM $2 FOR UPDATE` â€” throw 404 `INVENTORY_RECORD_NOT_FOUND` if no row; `updateInventoryQuantity(tx, id, newQuantity): Promise<{resultingBalance: number}>`; `insertInventoryTransaction(tx, data): Promise<InventoryTransactionRow>`; `getInventoryForProduct(tx, productId): Promise<InventoryRecordRow[]>` â€” joins to product_variants for `dimension_value`; `getLowStockProducts(tx, facilityId, page, limit): Promise<{rows: LowStockRow[], total: number}>` â€” JOIN inventory_records + products + product_variants, WHERE `quantity <= low_stock_threshold`; `getInventoryHistory(tx, inventoryRecordId, variantId: string | null | undefined, page, limit): Promise<{rows: InventoryHistoryRow[], total: number}>` â€” ORDER BY created_at DESC, JOIN users for actorName
- [X] T046 [US4] Create `backend/src/modules/catalogue/inventory/inventory.service.ts` â€” `adjustInventory(tx, facilityId, actorId, productId, input: AdjustInput): Promise<InventoryTransactionRow>`: (1) if `variantId` provided: `findVariantById(tx, variantId)` â†’ verify `variant.productId === productId` â†’ 404 `VARIANT_NOT_FOUND`; (2) `lockInventoryRecord(tx, productId, input.variantId ?? null)` â€” acquires `FOR UPDATE` row lock; (3) `const newQuantity = record.quantity + input.quantityDelta`; (4) if `newQuantity < 0 && !record.allowNegative` â†’ throw 409 `INSUFFICIENT_STOCK` with `{currentQuantity: record.quantity, requestedDelta: input.quantityDelta}`; (5) `updateInventoryQuantity(tx, record.id, newQuantity)`; (6) `insertInventoryTransaction(tx, {facilityId, inventoryRecordId: record.id, productId, variantId: input.variantId ?? null, quantityDelta: input.quantityDelta, resultingBalance: newQuantity, reason: input.reason, note: input.note ?? null, actorId})`; (7) write `audit_log` `'inventory.adjusted'`; (8) return transaction record
- [X] T047 [US4] Create `backend/src/modules/catalogue/inventory/inventory.router.ts`: `GET /inventory/products/:productId` (`authMiddleware + requirePermission('inventory.read')` + `getInventoryForProduct`); `GET /inventory/low-stock` (`inventory.read` + `getLowStockProducts` paginated); `POST /inventory/products/:productId/adjust` (`authMiddleware + requirePermission('inventory.adjust')` + `withTenantContext` + `adjustInventory`); `GET /inventory/products/:productId/history` (`inventory.read` + `getInventoryHistory` paginated + optional `?variant_id` query param)
- [X] T048 [US4] Mount `inventoryRouter` in `catalogue.router.ts`: `catalogueRouter.use('/', inventoryRouter)`
- [X] T049 [US4] Write `backend/tests/catalogue/inventory.test.ts` covering ACC scenarios US4-1 through US4-5: US4-1 POST adjust +20 RESTOCK â†’ 200 `resultingBalance=20`; history record has actor, reason, delta, balance, timestamp all populated; US4-2 POST adjust -10 on 5-unit stock â†’ 409 `INSUFFICIENT_STOCK`; balance unchanged at 5; US4-3 GET history â†’ reverse-chronological, each record complete; US4-4 GET low-stock â†’ product with quantity â‰¤ threshold appears; US4-5 concurrency test: `setInventoryQuantity(id, 0)` then `Promise.all([...10 concurrent POST adjust +1 RESTOCK])` â†’ final balance === 10 (no lost updates â€” verifies SELECT FOR UPDATE); run: `npm run test -- tests/catalogue/inventory.test.ts`

**Checkpoint**: inventory.test.ts passes including the concurrency test.

---

## Phase 7: User Story 5 â€” Coupon Management (Priority: P2)

**Goal**: Admin can create, update, deactivate coupons. Validate endpoint (used by Phase 4 checkout) returns correct approval or rejection reason. `internalNotes` is NEVER included in the validation response.

**Independent Test**: `POST /catalogue/coupons` with `code:'save20'` â†’ stored as `'SAVE20'` (uppercased); `POST /catalogue/coupons/validate` with valid code and sufficient orderTotal â†’ `{valid:true, effectiveDiscount:'15.00'}`; deactivate coupon â†’ validate returns `{valid:false, reason:'INACTIVE'}`.

- [X] T050 [P] [US5] Create `backend/src/modules/catalogue/coupons/coupon.types.ts`: `CreateCouponInput` (code, type `CouponType`, discountValue string, maxDiscountAmount optional string, minOrderTotal optional string, totalUsageLimit optional integer, perCustomerUsageLimit optional integer, applicableProductIds optional uuid[], applicableCategoryIds optional uuid[], startsAt optional Date, endsAt optional Date, isActive boolean, internalNotes optional string); `UpdateCouponInput` (all optional, explicitly excludes `code` and `type`); `ValidateCouponInput` ({code: string, orderTotal: string}); `CouponValidationSuccess`; `CouponValidationFailure`; `CouponRow`
- [X] T051 [P] [US5] Create `backend/src/modules/catalogue/coupons/coupon.validator.ts`: `CreateCouponBodySchema` â€” code `z.string().min(1).max(50)`; type `z.enum(['PERCENTAGE', 'FIXED_AMOUNT'])`; discountValue numeric string; superRefine: if `type=PERCENTAGE`, discountValue must be â‰¤ 100; `maxDiscountAmount` only valid for PERCENTAGE; `UpdateCouponBodySchema` â€” all optional, omit `code` and `type` fields; `ValidateCouponBodySchema` â€” code string, orderTotal numeric string matching `/^\d+(\.\d{1,2})?$/`
- [X] T052 [P] [US5] Create `backend/src/modules/catalogue/coupons/coupon.queries.ts`: `insertCoupon(tx, facilityId, actorId, data): Promise<CouponRow>`; `findCouponById(tx, id): Promise<CouponRow | null>`; `findCouponByCode(tx, facilityId, code: string): Promise<CouponRow | null>` â€” code is uppercased before query; `checkCodeExists(tx, facilityId, code: string): Promise<boolean>`; `updateCoupon(tx, id, actorId, data): Promise<CouponRow>`; `listCoupons(tx, facilityId, filters: {active?: boolean, search?: string, page: number, limit: number}): Promise<{rows: CouponRow[], total: number}>`
- [X] T053 [US5] Create `backend/src/modules/catalogue/coupons/coupon.service.ts`: `createCoupon(tx, facilityId, actorId, input)`: normalize `code.toUpperCase()` â†’ `checkCodeExists` â†’ 409 `COUPON_CODE_CONFLICT` if true â†’ `insertCoupon` â†’ write `audit_log` `'coupon.created'`; `updateCoupon(tx, facilityId, actorId, id, input)`: find coupon â†’ `insertCoupon` â†’ write `'coupon.updated'`; `deactivateCoupon(tx, facilityId, actorId, id)`: find coupon â†’ `updateCoupon(tx, id, actorId, {isActive: false})` â†’ write `'coupon.deactivated'`; `validateCoupon(tx, facilityId, input)`: `findCouponByCode` â†’ `{valid:false, reason:'INVALID_CODE'}` if null â†’ check `isActive` â†’ `'INACTIVE'` â†’ check `startsAt`/`endsAt` vs `new Date()` â†’ `'EXPIRED'` â†’ check `totalRedemptionCount >= totalUsageLimit` (only if `totalUsageLimit` is set) â†’ `'USAGE_LIMIT_REACHED'` â†’ check `orderTotal >= minOrderTotal` (only if `minOrderTotal` is set) â†’ `'MINIMUM_NOT_MET'` â†’ compute `effectiveDiscount`: PERCENTAGE = `(parseFloat(orderTotal) Ã— discountValue/100)` capped at `maxDiscountAmount`; FIXED_AMOUNT = `discountValue`; return `CouponValidationSuccess` â€” **internalNotes MUST NOT be included in the return value**
- [X] T054 [US5] Create `backend/src/modules/catalogue/coupons/coupon.router.ts`: `GET /coupons` (`authMiddleware + requirePermission('coupons.manage')`); `POST /coupons` (same); `GET /coupons/:id` (same); `PATCH /coupons/:id` (same); `DELETE /coupons/:id` (same); `POST /coupons/validate` (`authMiddleware` only â€” no `coupons.manage` required, any authenticated session can validate at checkout)
- [X] T055 [US5] Mount `couponRouter` in `catalogue.router.ts`: `catalogueRouter.use('/', couponRouter)`
- [X] T056 [US5] Write `backend/tests/catalogue/coupons.test.ts` covering ACC scenarios US5-1 through US5-6: US5-1 POST `{code:'save20', type:'PERCENTAGE', discountValue:'20'}` â†’ 201, stored code is `'SAVE20'`; US5-2 POST FIXED_AMOUNT $15 â†’ 201; US5-3 POST same code (case-insensitive) â†’ 409 `COUPON_CODE_CONFLICT`; US5-4 deactivate coupon â†’ POST validate â†’ `{valid:false, reason:'INACTIVE'}`; US5-5 POST validate expired coupon â†’ `{valid:false, reason:'EXPIRED'}`; US5-6 POST validate coupon where `totalRedemptionCount === totalUsageLimit` (set via direct DB update in test setup) â†’ `{valid:false, reason:'USAGE_LIMIT_REACHED'}`; also: POST validate valid PERCENTAGE coupon `orderTotal:'75.00'` â†’ `{valid:true, effectiveDiscount:'15.00'}` and verify `internalNotes` is absent from response; run: `npm run test -- tests/catalogue/coupons.test.ts`

**Checkpoint**: coupons.test.ts passes. All 5 user stories are now independently verified.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration, compliance verification, final validation pass.

- [ ] T057 Run the full catalogue test suite: `npm run test -- tests/catalogue/` â€” all test files pass with zero failures
- [X] T058 Run `npm run typecheck` â€” zero TypeScript errors across all 20+ new files
- [X] T059 [P] Run `npm run lint` â€” zero lint errors; in particular, verify no `superAdminDb` imports appear outside `src/core/super-admin/` and `src/middleware/resolve-facility.ts`
- [ ] T060 [P] Run the quickstart.md validation: execute Steps 1â€“15 of `specs/003-ecommerce-catalogue/quickstart.md` and confirm all 15 expected responses match; document any discrepancies
- [ ] T061 [P] Verify constitution compliance: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('categories','products','product_variants','inventory_records','inventory_transactions','coupons')` â€” all 6 rows return `relrowsecurity=t`; confirm `inventory_transactions` append-only by running `UPDATE inventory_transactions SET note='hack' WHERE false` as `app_user` â€” must raise `permission denied`
- [ ] T062 Verify `internalNotes` never leaks: confirm `coupon.service.ts validateCoupon` return type does not include `internalNotes`; check that `CouponValidationSuccess` type definition in `coupon.types.ts` does not have an `internalNotes` field; run a test POST validate and confirm the response body has no `internalNotes` key
- [ ] T063 Update `RESUME.md`: Phase 3 status â†’ âœ… complete; add Phase 4 (Cart/Checkout) as the new "Phase 4 â€” Start Here" section
- [ ] T064 Write `worklog/YYYY-MM-DD.md` (session date) with full file-level detail and update `worklog.md` with the Phase 3 session entry

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies â€” start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 complete (migration must exist; db/index.ts must be updated)
- **Phases 3, 4 (US2, US3)**: Require Phase 2 complete; US2 and US3 can run in parallel (different files)
- **Phase 5 (US1)**: Requires US2 and US3 complete (public listing reads products and categories created by them)
- **Phases 6, 7 (US4, US5)**: Require Phase 2 complete; independent of US1/US2/US3; can run in parallel with Phase 5
- **Phase 8 (Polish)**: Requires all user story phases complete

### User Story Dependencies

- **US2 (Product Mgmt)**: Can start after Phase 2 â€” no dependency on other user stories
- **US3 (Category Mgmt)**: Can start after Phase 2 â€” no dependency on other user stories
- **US1 (Browsing)**: Requires US2 (products exist) and US3 (categories exist) to be complete
- **US4 (Inventory)**: Can start after Phase 2 â€” independent of US1/US2/US3
- **US5 (Coupons)**: Can start after Phase 2 â€” independent of all other stories

### Within Each Phase

- Tasks marked `[P]` can run in parallel (different files, no intra-phase dependencies)
- Types â†’ Validators â†’ Queries â†’ Service â†’ Router (sequential within a story)
- Mount router in catalogue.router.ts after router file is complete
- Tests run after the service and router are both complete

---

## Parallel Execution Examples

### Phase 1 (Setup) â€” parallel tasks
```
T001 Create module directories
T002 [P] Create catalogue.ts schema
T006 [P] Create permissions seed
```

### Phase 2 (Foundational) â€” parallel tasks
```
T009 [P] Create slugify.ts
T010 [P] Create resolve-facility.ts middleware
T011 [P] Create catalogue.types.ts
T012 [P] Create catalogue-fixtures.ts
```

### Phases 3 + 4 â€” parallel user stories (2 developers)
```
Developer A: T016â€“T026 (US2 Product Management)
Developer B: T027â€“T033 (US3 Category Management)
```

### Phases 5 + 6 + 7 â€” all after foundation
```
Developer A: T034â€“T042 (US1 Browsing â€” requires US2+US3 done)
Developer B: T043â€“T049 (US4 Inventory â€” independent)
Developer C: T050â€“T056 (US5 Coupons â€” independent)
```

---

## Implementation Strategy

### MVP First (US2 + US1 â€” Product Management + Browsing)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US2 â€” Product Management)
4. Complete Phase 5 (US1 â€” Product Browsing)
5. **STOP and VALIDATE**: Phase 5 checkpoint â€” full public product browsing works
6. Add US3 (Categories), US4 (Inventory), US5 (Coupons) incrementally

### Incremental Delivery Order (solo developer)

Phase 1 â†’ Phase 2 â†’ Phase 3 (US2) â†’ Phase 4 (US3) â†’ Phase 5 (US1) â†’ Phase 6 (US4) â†’ Phase 7 (US5) â†’ Phase 8

Each phase adds value without breaking previous work. After Phase 5, the full P1 scope is complete and shippable.

---

## Notes

- `[P]` tasks within a phase are in different files â€” safe to parallelize
- `[Story]` labels trace each task back to a spec user story for review
- All test files use the `supertest` + `vitest` pattern from Phase 2 (`tests/auth/*.test.ts`)
- `withTenantContext(facilityId)` wraps every service call in routers â€” never skip it for facility-scoped tables
- `superAdminDb` is used only in `resolve-facility.ts` middleware (facility lookup) and test fixtures â€” not in business logic
- Money fields are `string` in TypeScript (from postgres.js `numeric` â†’ string); use `parseFloat`/`Decimal` only for arithmetic in service layer
- `inventory_transactions` is append-only â€” no UPDATE/DELETE routes exist for it; tests should verify this




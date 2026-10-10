# Tasks: Cart, Checkout & Orders

**Input**: Design documents from `specs/004-cart-checkout-orders/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

**Organization**: Tasks grouped by user story — each phase is independently testable.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: Error codes and shared middleware that every module depends on.

- [X] T001 Add 13 error codes to `ErrorCode` union in `backend/src/lib/errors.ts`: `'CART_EMPTY'`, `'CART_ITEM_NOT_FOUND'`, `'CART_ITEM_LIMIT_EXCEEDED'`, `'CART_TOKEN_NOT_FOUND'`, `'PREVIEW_TOKEN_REQUIRED'`, `'PREVIEW_TOKEN_EXPIRED'`, `'PREVIEW_TOKEN_INVALID'`, `'INVALID_STATUS_TRANSITION'`, `'ORDER_NOT_FOUND'`, `'INVALID_PROVINCE'`, `'SHIPPING_METHOD_NOT_FOUND'`, `'SHIPPING_METHOD_NAME_EXISTS'`, `'SHIPPING_METHOD_ALREADY_INACTIVE'`
- [X] T002 Create `backend/src/middleware/optional-auth.ts` — middleware that runs the full `parseJwt → checkSession → verifyAuthVersion → checkFacilityStatus` chain if `Authorization: Bearer` header is present, populates `req.auth`, and calls `next()` without error if the header is absent (guest pass-through)

**Checkpoint**: Error codes compiled, optional-auth middleware ready.

---

## Phase 2: Foundational

**Purpose**: Database schema, migration, tax logic, permissions, and test fixtures. MUST complete before any user story begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create `backend/src/db/schema/commerce.ts` — 7 Drizzle table definitions: `facility_sequences` (id UUID PK, facility_id FK→facilities CASCADE, resource_type TEXT, next_val INTEGER default 1, updated_at; UNIQUE facility_id+resource_type), `shipping_methods` (id UUID PK, facility_id FK→facilities CASCADE, name TEXT, description TEXT nullable, flat_rate NUMERIC(10,2) CHECK≥0, estimated_days_min INTEGER CHECK≥0, estimated_days_max INTEGER CHECK≥estimated_days_min, is_active BOOLEAN default true, display_order INTEGER default 0, created_at, updated_at; UNIQUE facility_id+name), `carts` (id UUID PK, facility_id FK→facilities CASCADE, user_id UUID nullable FK→users SET NULL, cart_token UUID nullable, expires_at TIMESTAMPTZ nullable, created_at, updated_at), `cart_items` (id UUID PK, cart_id FK→carts CASCADE, facility_id FK→facilities CASCADE, product_id FK→products CASCADE, variant_id UUID nullable FK→product_variants CASCADE, quantity INTEGER CHECK>0, price_snapshot NUMERIC(10,2), product_name_snapshot TEXT, variant_label_snapshot TEXT nullable, created_at, updated_at), `orders` (id UUID PK, facility_id FK→facilities RESTRICT, patient_id FK→users RESTRICT, order_number TEXT, status TEXT default 'pending', shipping_address JSONB, shipping_method_id UUID nullable FK→shipping_methods SET NULL, shipping_method_snapshot JSONB, subtotal NUMERIC(10,2), tax_breakdown JSONB, tax_total NUMERIC(10,2), shipping_cost NUMERIC(10,2), total NUMERIC(10,2), notes TEXT nullable, created_at, updated_at; UNIQUE facility_id+order_number), `order_items` (id UUID PK, order_id FK→orders CASCADE, facility_id FK→facilities RESTRICT, product_id UUID nullable FK→products SET NULL, variant_id UUID nullable FK→product_variants SET NULL, product_name TEXT, variant_label TEXT nullable, sku TEXT, quantity INTEGER CHECK>0, unit_price NUMERIC(10,2), line_total NUMERIC(10,2), created_at), `order_status_history` (id UUID PK, order_id FK→orders CASCADE, facility_id FK→facilities RESTRICT, previous_status TEXT nullable, new_status TEXT, changed_by_id UUID nullable FK→users SET NULL, note TEXT nullable, created_at)
- [X] T004 [P] Create `backend/src/lib/tax-rates.ts` — export `PROVINCE_TAX_RATES` constant covering all 13 provinces/territories: AB/NT/NU/YT→[{type:'GST',rate:'0.05'}], BC→[{type:'GST',rate:'0.05'},{type:'PST',rate:'0.07'}], MB→[{type:'GST',rate:'0.05'},{type:'PST',rate:'0.07'}], ON→[{type:'HST',rate:'0.13'}], QC→[{type:'GST',rate:'0.05'},{type:'QST',rate:'0.09975'}], SK→[{type:'GST',rate:'0.05'},{type:'PST',rate:'0.06'}], NS/NB/PEI/NL→[{type:'HST',rate:'0.15'}]; export `calculateTax(subtotal: string, province: string): TaxLineItem[]` — uses string arithmetic (no floating point); QST applies rate to subtotal only (additive, not compounded on top of GST); throws `INVALID_PROVINCE` AppError for unknown province codes
- [X] T005 Run `npm run db:generate` in `backend/` to generate Drizzle migration output for commerce.ts schema additions; rename/move generated file to `backend/src/db/migrations/0003_cart_checkout_orders.sql` and update `backend/src/db/migrations/meta/_journal.json` with new entry `{idx:3, tag:'0003_cart_checkout_orders'}`
- [X] T006 Append manual SQL to `backend/src/db/migrations/0003_cart_checkout_orders.sql` after Drizzle-generated DDL: (1) `ALTER TABLE cart_items ADD CONSTRAINT cart_items_cart_product_variant_unique UNIQUE NULLS NOT DISTINCT (cart_id, product_id, variant_id)`, (2) `ALTER TABLE carts ADD CONSTRAINT carts_facility_user_unique UNIQUE NULLS NOT DISTINCT (facility_id, user_id)`, (3) `ALTER TABLE carts ADD CONSTRAINT carts_facility_token_unique UNIQUE NULLS NOT DISTINCT (facility_id, cart_token)`, (4) `ALTER TABLE facility_sequences ENABLE ROW LEVEL SECURITY` + policy + (5–11) same for remaining 6 tables, (12) RLS policy for each table: `CREATE POLICY facility_isolation ON <table> USING (facility_id = current_facility_id()) WITH CHECK (facility_id = current_facility_id())`, (13) REVOKE DELETE ON orders FROM app_user, app_super_admin, (14) REVOKE UPDATE, DELETE ON order_items FROM app_user, app_super_admin, (15) REVOKE UPDATE, DELETE ON order_status_history FROM app_user, app_super_admin, (16) GRANT SELECT,INSERT,UPDATE ON facility_sequences TO app_user, app_super_admin, (17) GRANT SELECT,INSERT,UPDATE,DELETE ON shipping_methods TO app_user, app_super_admin, (18) GRANT SELECT,INSERT,UPDATE,DELETE ON carts TO app_user, app_super_admin, (19) GRANT SELECT,INSERT,UPDATE,DELETE ON cart_items TO app_user, app_super_admin, (20) GRANT SELECT,INSERT,UPDATE ON orders TO app_user, app_super_admin, (21) GRANT SELECT,INSERT ON order_items TO app_user, app_super_admin, (22) GRANT SELECT,INSERT ON order_status_history TO app_user, app_super_admin
- [X] T007 Run `npm run db:migrate` in `backend/` to apply `0003_cart_checkout_orders.sql` against the local Docker PostgreSQL instance; verify all 7 new tables exist
- [X] T008 Create `backend/src/db/seeds/orders-permissions.ts` — seed 3 permissions under the `ecommerce` platform module: `{key:'orders.read', name:'View Orders'}`, `{key:'orders.manage', name:'Manage Orders'}`, `{key:'shipping-methods.manage', name:'Manage Shipping Methods'}`; run `npx tsx src/db/seeds/orders-permissions.ts` to apply
- [X] T009 Create `backend/tests/setup/commerce-fixtures.ts` — export `createTestShippingMethod(facilityId: string, overrides?): Promise<ShippingMethod>` (inserts via superAdminTestDb, defaults: name='Standard Shipping', flatRate='9.99', estimatedDaysMin=3, estimatedDaysMax=7, isActive=true), `createTestOrder(facilityId: string, patientId: string, overrides?): Promise<Order>` (inserts order + 1 order_item + initial status_history row), `deleteTestOrdersByFacility(facilityId: string)` for afterAll cleanup

**Checkpoint**: Schema applied, tax logic ready, permissions seeded, fixtures available.

---

## Phase 3: User Story 1 — Guest & Authenticated Cart Management (Priority: P1) 🎯

**Goal**: Guest and authenticated carts with add/update/remove/clear, price snapshots, and merge-on-login.

**Independent Test**: `GET /api/v1/cart` returns empty cart for new guest. `POST /api/v1/cart/items` creates cart + sets `medisyn_cart` cookie. After auth login, `POST /api/v1/cart/merge` merges guest items into auth cart with max-qty rule.

- [X] T010 [P] [US1] Create `backend/src/modules/cart/cart.types.ts` — `CartItemRow` (DB row shape), `CartItem` (response shape: id, productId, variantId?, productName, variantLabel?, quantity, priceSnapshot, lineTotal, product:{id,name,slug,currentPrice,stockQuantity,isActive}), `Cart` (id|null, facilityId, itemCount, items:CartItem[], subtotal, expiresAt?), `AddItemInput` (productId:string, variantId?:string, quantity:number 1-99), `UpdateItemInput` (quantity:number 1-99), `MergeCartInput` (cartToken:string)
- [X] T011 [P] [US1] Create `backend/src/modules/cart/cart.validator.ts` — `AddItemBodySchema` (productId uuid, variantId optional uuid, quantity int min 1 max 99), `UpdateItemBodySchema` (quantity int min 1 max 99), `MergeCartBodySchema` (cartToken uuid)
- [X] T012 [P] [US1] Create `backend/src/modules/cart/cart.queries.ts` — `findCartByToken(tx, facilityId, cartToken)`, `findCartByUserId(tx, facilityId, userId)`, `createCart(tx, data:{facilityId, userId?, cartToken?, expiresAt?})`, `findCartItemsFull(tx, cartId)` — JOIN products + product_variants for live currentPrice/stockQuantity/isActive/name, `findCartItemById(tx, itemId, cartId)`, `upsertCartItem(tx, data)` — INSERT with ON CONFLICT(cart_id,product_id,variant_id) DO UPDATE SET quantity, `updateCartItemQty(tx, itemId, newQty)`, `deleteCartItem(tx, itemId, cartId)`, `deleteAllCartItems(tx, cartId)`, `deleteCart(tx, cartId)`, `countCartDistinctItems(tx, cartId)`
- [X] T013 [US1] Create `backend/src/modules/cart/cart.service.ts` — `resolveCart(tx, facilityId, userId?, cartToken?): Cart|null` finds existing cart without creating; `getOrCreateCart(tx, facilityId, userId?, cartToken?): {cart, isNew:boolean}` creates if not found (guest cart gets expiresAt = now+30d); `addItem(tx, facilityId, cart, input:AddItemInput)`: fetch product (PRODUCT_NOT_FOUND if inactive), fetch variant if provided (VARIANT_NOT_FOUND), validate stockQuantity >= input.quantity (INSUFFICIENT_STOCK), validate countCartDistinctItems < 50 (CART_ITEM_LIMIT_EXCEEDED), upsertCartItem with priceSnapshot=currentPrice, productNameSnapshot, variantLabelSnapshot; `updateItem(tx, facilityId, cart, itemId, qty)`: findCartItemById (CART_ITEM_NOT_FOUND), re-validate stock; `removeItem(tx, cart, itemId)`: deleteCartItem (CART_ITEM_NOT_FOUND if 0 rows affected); `clearCart(tx, cartId)`; `mergeGuestCart(tx, facilityId, userId, cartToken:string)`: findCartByToken (CART_TOKEN_NOT_FOUND), findCartByUserId or createCart for auth user, for each guest item find matching auth item — set qty = max(guestQty, authQty) capped at stockQty, add non-overlapping items, delete guest cart items + guest cart row; `buildCartResponse(tx, cartId, facilityId): Cart` — calls findCartItemsFull, computes subtotal
- [X] T014 [US1] Create `backend/src/modules/cart/cart.router.ts` — `GET /` (resolveFacility, optionalAuth → resolveCart → buildCartResponse or empty cart if null), `POST /items` (resolveFacility, optionalAuth → getOrCreateCart → addItem → buildCartResponse; if isNew && guest: `res.cookie('medisyn_cart', cart.cartToken, {httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict', maxAge:30*24*60*60*1000})`), `PATCH /items/:id as string` (resolveFacility, optionalAuth → updateItem → buildCartResponse), `DELETE /items/:id as string` (resolveFacility, optionalAuth → removeItem → buildCartResponse), `DELETE /` (resolveFacility, optionalAuth → clearCart → buildCartResponse), `POST /merge` (authMiddleware → mergeGuestCart → buildCartResponse; `res.clearCookie('medisyn_cart')`)

**Checkpoint**: Cart fully functional for guest and authenticated users. Cookie set/cleared correctly.

---

## Phase 4: User Story 2 — Checkout: Address, Shipping & Tax Preview (Priority: P1)

**Goal**: Admin-managed shipping methods and a checkout preview endpoint that returns server-calculated totals including province-correct Canadian tax without creating any DB records.

**Independent Test**: Admin can create a shipping method. `POST /api/v1/checkout/preview` with an ON address returns HST 13% in taxBreakdown. Same with BC returns GST 5% + PST 7% as separate lines. Preview with empty cart returns 422 CART_EMPTY. Preview token present in response.

- [X] T015 [P] [US2] Create `backend/src/modules/shipping-methods/shipping-method.types.ts` — `ShippingMethod` (id, facilityId, name, description?, flatRate:string, estimatedDaysMin, estimatedDaysMax, isActive, displayOrder, createdAt, updatedAt), `CreateShippingMethodInput` (name max 100 chars, description? max 500 chars, flatRate numeric≥0 2dp, estimatedDaysMin≥0, estimatedDaysMax≥estimatedDaysMin, displayOrder? default 0), `UpdateShippingMethodInput` (Partial<CreateShippingMethodInput>)
- [X] T016 [P] [US2] Create `backend/src/modules/shipping-methods/shipping-method.validator.ts` — `CreateShippingMethodBodySchema` (name string min 1 max 100, description optional max 500, flatRate number min 0, estimatedDaysMin int min 0, estimatedDaysMax int min 0, displayOrder optional int default 0 — note: estimatedDaysMax >= estimatedDaysMin validated at service layer not zod), `UpdateShippingMethodBodySchema` (same fields all optional)
- [X] T017 [P] [US2] Create `backend/src/modules/shipping-methods/shipping-method.queries.ts` — `listActiveMethods(tx, facilityId)`: WHERE is_active=true ORDER BY display_order ASC, flat_rate ASC, `listAllMethods(tx, facilityId)`, `findMethodById(tx, id)`, `checkNameExists(tx, facilityId, name, excludeId?:string)`, `insertMethod(tx, data)`, `updateMethod(tx, id, data)`, `setMethodInactive(tx, id)` — UPDATE is_active=false, updated_at=now()
- [X] T018 [US2] Create `backend/src/modules/shipping-methods/shipping-method.service.ts` — `listActive(facilityId)`, `listAll(facilityId)`, `getById(facilityId, id)` (SHIPPING_METHOD_NOT_FOUND), `create(facilityId, input, actorId)`: validate estimatedDaysMax >= estimatedDaysMin (VALIDATION_ERROR), checkNameExists throws SHIPPING_METHOD_NAME_EXISTS on conflict, insertMethod, createAuditEntry; `update(facilityId, id, input, actorId)`: findMethodById (SHIPPING_METHOD_NOT_FOUND), checkNameExists (exclude self), updateMethod; `deactivate(facilityId, id, actorId)`: findMethodById (SHIPPING_METHOD_NOT_FOUND), throw SHIPPING_METHOD_ALREADY_INACTIVE if already inactive, setMethodInactive
- [X] T019 [US2] Create `backend/src/modules/shipping-methods/shipping-method.router.ts` — `GET /shipping-methods` (resolveFacility → listActive, returns `{data:[...]}` sorted by displayOrder+flatRate), `GET /admin/shipping-methods` (authMiddleware + requirePermission('shipping-methods.manage') → listAll), `POST /admin/shipping-methods` → 201, `PATCH /admin/shipping-methods/:id as string`, `PATCH /admin/shipping-methods/:id/deactivate as string`; use `getFacilityId(req)` from resolveFacility for public route
- [X] T020 [P] [US2] Create `backend/src/modules/checkout/checkout.types.ts` — `CANADIAN_PROVINCES` = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'] as const, `CanadianProvince` type, `TaxLineItem` (type:'GST'|'HST'|'PST'|'QST', rate:string, amount:string), `CheckoutAddress` (street:string, unit?:string, city:string, province:CanadianProvince, postalCode:string, country:'CA'), `CheckoutBreakdown` (subtotal, taxBreakdown:TaxLineItem[], taxTotal, shippingCost, total — all string), `CheckoutPreviewInput` (shippingAddress: CheckoutAddress, shippingMethodId: string), `CheckoutPreviewResult` (previewToken:string, previewTokenExpiresAt:string, cart:{itemCount,items}, shippingAddress, shippingMethod:{id,name,flatRate,estimatedDaysMin,estimatedDaysMax}, breakdown:CheckoutBreakdown), `PlaceOrderInput` (previewToken:string, shippingAddress:CheckoutAddress, shippingMethodId:string, notes?:string)
- [X] T021 [P] [US2] Create `backend/src/modules/checkout/checkout.validator.ts` — `CheckoutAddressSchema` (street min 1, unit optional, city min 1, province enum CANADIAN_PROVINCES, postalCode min 1 max 10, country literal 'CA'), `CheckoutPreviewBodySchema` (shippingAddress: CheckoutAddressSchema, shippingMethodId: uuid), `PlaceOrderBodySchema` (previewToken:string min 1, shippingAddress: CheckoutAddressSchema, shippingMethodId: uuid, notes optional max 1000)
- [X] T022 [US2] Create `backend/src/modules/checkout/checkout.service.ts` — `previewCheckout(tx, facilityId, userId, input:CheckoutPreviewInput): CheckoutPreviewResult`: (1) resolveCart → CART_EMPTY if no items, (2) findCartItemsFull — collect any item with stockQuantity < quantity into outOfStockItems → INSUFFICIENT_STOCK with {outOfStockItems:[productId]} if any, (3) findMethodById (SHIPPING_METHOD_NOT_FOUND if inactive or not found), (4) validate province via PROVINCE_TAX_RATES key lookup (INVALID_PROVINCE), (5) subtotal = sum(item.currentPrice × item.quantity) as string arithmetic, (6) taxLines = calculateTax(subtotal, province), (7) taxTotal = sum of taxLines amounts, (8) total = subtotal + taxTotal + method.flatRate, (9) sign preview token: `jwt.sign({sub:userId, facilityId, shippingMethodId, province, subtotal, taxTotal, shippingCost:method.flatRate, total}, JWT_SECRET, {expiresIn:'15m'})`, (10) return full result — NO DB writes
- [X] T023 [US2] Create `backend/src/modules/checkout/checkout.router.ts` — `POST /checkout/preview` (authMiddleware → parse CheckoutPreviewBodySchema → previewCheckout → 200)

**Checkpoint**: Shipping methods CRUD working. Checkout preview returns correct tax for all provinces. Preview token in response.

---

## Phase 5: User Story 3 — Order Placement (Priority: P1)

**Goal**: Transactional order placement with preview token validation, SELECT FOR UPDATE stock locking, sequential order numbers, and cart clearance.

**Independent Test**: `POST /api/v1/checkout/place` with valid preview token creates order with status `pending`, correct snapshots, and clears cart. Second concurrent request for last unit returns 422 INSUFFICIENT_STOCK.

- [X] T024 [P] [US3] Create `backend/src/modules/orders/order.types.ts` — `OrderStatus = 'pending'|'confirmed'|'processing'|'ready'|'shipped'|'delivered'|'cancelled'|'refunded'`, `VALID_TRANSITIONS: Record<OrderStatus,OrderStatus[]> = {pending:['confirmed','cancelled'], confirmed:['processing','cancelled'], processing:['ready'], ready:['shipped'], shipped:['delivered'], delivered:['refunded'], cancelled:[], refunded:[]}`, `OrderItem` (id, orderId, facilityId, productId?, variantId?, productName, variantLabel?, sku, quantity, unitPrice, lineTotal, createdAt), `OrderStatusHistoryEntry` (id, orderId, facilityId, previousStatus:OrderStatus|null, newStatus:OrderStatus, changedById?:string, changedByName?:string, note?:string, createdAt), `Order` (id, facilityId, patientId, orderNumber, status, shippingAddress, shippingMethod, items, breakdown:CheckoutBreakdown, statusHistory, createdAt, updatedAt), `PlaceOrderResult` (orderId, orderNumber, status:'pending', breakdown, estimatedDelivery:{min:string,max:string})
- [X] T025 [P] [US3] Create `backend/src/modules/orders/order.queries.ts` — `ensureSequenceRow(tx, facilityId)`: INSERT INTO facility_sequences(facility_id,resource_type,next_val) VALUES(${facilityId},'order',1) ON CONFLICT DO NOTHING, `lockAndGetSequence(tx, facilityId)`: SELECT next_val FROM facility_sequences WHERE facility_id=${facilityId} AND resource_type='order' FOR UPDATE — returns next_val, `incrementSequence(tx, facilityId)`: UPDATE facility_sequences SET next_val=next_val+1 WHERE facility_id=${facilityId} AND resource_type='order', `formatOrderNumber(val:number)`: \`ORD-\${String(val).padStart(5,'0')}\`, `insertOrder(tx, data)` → returning id, `insertOrderItem(tx, data)`, `insertOrderStatusHistory(tx, entry)`, `findOrderById(tx, id)`
- [X] T026 [US3] Create `backend/src/modules/orders/order.service.ts` with `placeOrder(input:PlaceOrderInput, auth:AuthContext): Promise<PlaceOrderResult>` — full `withTenantContext(auth.facilityId, async(tx) => {...})` transaction: (1) verify previewToken: jwt.verify throws → PREVIEW_TOKEN_REQUIRED/EXPIRED/INVALID, (2) validate claims.sub===auth.userId and claims.facilityId===auth.facilityId, (3) findCartByUserId (CART_EMPTY if null or no items), (4) findCartItemsFull — collect outOfStockItems (INSUFFICIENT_STOCK if any before locking), (5) ensureSequenceRow, (6) lockAndGetSequence SELECT FOR UPDATE, (7) for each cart item: lock inventory_record via existing `lockInventoryRecord(tx, productId, variantId)` from inventory.queries.ts — re-check stock after lock (INSUFFICIENT_STOCK with outOfStockItems if any), (8) compute totals server-side from scratch (same logic as previewCheckout — do not trust preview token amounts), (9) orderNumber = formatOrderNumber(seq.next_val), (10) insertOrder with all snapshots, (11) insertOrderItem for each cart item (sku from product, unitPrice=currentPrice, lineTotal=qty×price), (12) insertOrderStatusHistory (previousStatus:null, newStatus:'pending', changedById:null), (13) for each item INSERT inventory_transaction (reason:'SALE', quantityChange:-qty, actorId:auth.userId) + update inventory_record quantity, (14) incrementSequence, (15) deleteAllCartItems(cartId) + deleteCart(cartId), (16) createAuditEntry({action:'order.placed', resourceType:'order', resourceId:orderId}), (17) return PlaceOrderResult; also export `validateStatusTransition(current:OrderStatus, next:OrderStatus): void` — throws INVALID_STATUS_TRANSITION if VALID_TRANSITIONS[current] does not include next
- [X] T027 [US3] Add `POST /checkout/place` to `backend/src/modules/checkout/checkout.router.ts` — authMiddleware → parse PlaceOrderBodySchema → placeOrder → 201 with PlaceOrderResult

**Checkpoint**: Full order placement working end-to-end. Cart cleared. Order number sequential. Concurrent placement of last unit handled correctly.

---

## Phase 6: User Story 4 — Patient Order History & Self-Service Cancellation (Priority: P2)

**Goal**: Patient can list own orders, view detail, and cancel `pending` orders. No access to other patients' orders.

**Independent Test**: Patient lists 3 orders (all theirs). Cancels the `pending` one. Inventory restored. Cannot cancel `confirmed` order. Cannot access another patient's order ID (returns 404).

- [X] T028 [P] [US4] Add to `backend/src/modules/orders/order.queries.ts` — `listOrdersByPatient(tx, facilityId, patientId, opts:{status?:OrderStatus, page:number, limit:number})`: SELECT id,order_number,status,subtotal,tax_total,shipping_cost,total,created_at WHERE facility_id=current AND patient_id=${patientId} [AND status=${opts.status}] ORDER BY created_at DESC LIMIT/OFFSET, `countOrdersByPatient(tx, facilityId, patientId, status?)`, `findOrderDetailForPatient(tx, facilityId, orderId, patientId)`: full detail JOIN order_items JOIN order_status_history — returns null if not found OR patient_id mismatch (caller throws ORDER_NOT_FOUND in both cases — do not distinguish)
- [X] T029 [US4] Add to `backend/src/modules/orders/order.service.ts` — `listPatientOrders(auth, opts)`, `getPatientOrderDetail(auth, orderId)`: throws ORDER_NOT_FOUND, response MUST NOT include `notes` field — explicitly omit, `cancelPatientOrder(auth, orderId)`: findOrderDetailForPatient (ORDER_NOT_FOUND), validateStatusTransition(current,'cancelled') throws INVALID_STATUS_TRANSITION if current≠'pending', INSERT order_status_history (changedById:auth.userId), for each order_item: INSERT inventory_transaction(reason:'RETURN', +quantity, actorId:auth.userId) + UPDATE inventory_record, UPDATE orders SET status='cancelled', createAuditEntry({action:'order.cancelled_by_patient'})
- [X] T030 [US4] Create `backend/src/modules/orders/order.router.ts` — `GET /orders` (authMiddleware → listPatientOrders, response: {data:[...], pagination}), `GET /orders/:id as string` (authMiddleware → getPatientOrderDetail — strip notes before sending), `POST /orders/:id/cancel as string` (authMiddleware → cancelPatientOrder)

**Checkpoint**: Patient can list, view, and cancel own orders. Other-patient 404. Inventory restored on cancel.

---

## Phase 7: User Story 5 — Admin Order Management (Priority: P2)

**Goal**: Admin can list all facility orders, advance status through lifecycle, cancel pending/confirmed orders, and update internal notes.

**Independent Test**: Admin lists all orders. Advances `pending`→`confirmed`→`processing`. Attempts `processing`→`pending` — rejected INVALID_STATUS_TRANSITION. Cancels `confirmed` order — inventory restored. `delivered`→`refunded` succeeds.

- [X] T031 [P] [US5] Add to `backend/src/modules/orders/order.queries.ts` — `listOrdersForAdmin(tx, facilityId, opts:{status?,patientId?,orderNumber?,dateFrom?,dateTo?,page,limit,sort:'createdAt:asc'|'createdAt:desc'|'total:asc'|'total:desc'})`: JOIN users ON patient_id to get firstName+lastName as patientName; `countOrdersForAdmin(tx, facilityId, opts)`; `findOrderDetailForAdmin(tx, facilityId, orderId)`: full detail including notes, patient firstName+lastName+email, all statusHistory with changedBy user name; `updateOrderStatus(tx, orderId, newStatus, updatedAt)`: UPDATE orders SET status=${newStatus}; `updateOrderNotes(tx, orderId, notes)`: UPDATE orders SET notes=${notes}
- [X] T032 [US5] Add to `backend/src/modules/orders/order.service.ts` — `listAdminOrders(auth, opts)`, `getAdminOrderDetail(auth, orderId)` (ORDER_NOT_FOUND if not in facility — includes notes), `advanceOrderStatus(auth, orderId, newStatus:OrderStatus, note?:string)`: findOrderDetailForAdmin (ORDER_NOT_FOUND), validateStatusTransition(current, newStatus), if newStatus==='cancelled': restore stock (INSERT inventory_transactions RETURN + UPDATE inventory_records for each item), updateOrderStatus, INSERT order_status_history (changedById:auth.userId, note), createAuditEntry({action:'order.status_changed'}); `adminCancelOrder(auth, orderId, note?)`: validate current in ['pending','confirmed'] else INVALID_STATUS_TRANSITION, restore stock, mark cancelled; `updateOrderNotes(auth, orderId, notes)`: updateOrderNotes query, no status change
- [X] T033 [US5] Add admin routes to `backend/src/modules/orders/order.router.ts` — `GET /admin/orders` (authMiddleware + requirePermission('orders.read')), `GET /admin/orders/:id as string` (authMiddleware + requirePermission('orders.read')), `PATCH /admin/orders/:id/status as string` (authMiddleware + requirePermission('orders.manage') → parse {newStatus:OrderStatus, note?:string}), `POST /admin/orders/:id/cancel as string` (authMiddleware + requirePermission('orders.manage') → parse {note?:string}), `PATCH /admin/orders/:id/notes as string` (authMiddleware + requirePermission('orders.manage') → parse {notes:string max 2000})

**Checkpoint**: Admin order management fully operational. Status transitions enforced. Stock restored on cancel.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T034 Create `backend/src/modules/commerce.router.ts` — import cartRouter from `./cart/cart.router`, shippingMethodRouter from `./shipping-methods/shipping-method.router`, checkoutRouter from `./checkout/checkout.router`, orderRouter from `./orders/order.router`; export `commerceRouter` mounting all four; note that routes like `/cart`, `/checkout`, `/orders`, `/shipping-methods`, `/admin/shipping-methods`, `/admin/orders` are all mounted here
- [X] T035 Register `commerceRouter` in `backend/src/app.ts` — `app.use('/api/v1', commerceRouter)` alongside existing routers; import and mount
- [X] T036 Run `npm run typecheck` in `backend/` — fix all TypeScript errors across commerce module files
- [X] T037 Run `npm run lint` in `backend/` — fix all ESLint errors (unused imports, no-restricted-imports, etc.)
- [X] T038 Run `npm test -- tests/commerce/` in `backend/` — verify all commerce tests pass; fix any failures
- [X] T039 Manually run quickstart.md Scenarios 1–8 against running backend to validate end-to-end (Scenario 1: guest cart + merge, Scenario 2: checkout preview→place, Scenario 3: province tax validation for ON/AB/BC/QC/NS, Scenario 4: concurrent stock enforcement, Scenario 5: order status lifecycle, Scenario 6: sequential order numbers, Scenario 7: patient order isolation 404, Scenario 8: shipping methods CRUD)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 error codes needed by all services); migration (T007) must complete before any service tests can run
- **Phase 3 (US1 Cart)**: Depends on Phase 2 complete (schema + tax-rates)
- **Phase 4 (US2 Shipping+Checkout)**: Depends on Phase 2; T022 checkout.service depends on Phase 3 cart.service (resolveCart, findCartItemsFull)
- **Phase 5 (US3 Order Placement)**: Depends on Phase 4 (needs checkout.types for PlaceOrderInput, preview token logic)
- **Phase 6 (US4 Patient Orders)**: Depends on Phase 5 (order.service must exist with placeOrder)
- **Phase 7 (US5 Admin Orders)**: Depends on Phase 5 (same order.service and order.queries)
- **Phase 8 (Polish)**: Depends on all story phases complete

### Within-Phase Parallel Tasks

**Phase 3**: T010, T011, T012 (types, validator, queries) → all [P] → complete all three before T013 (service) → T014 (router)

**Phase 4**: T015, T016, T017 (SM types, validator, queries) → [P] together; T020, T021 (checkout types, validator) → [P] together; T018 (SM service) depends on T015-T017; T022 (checkout service) depends on T020-T021 and Phase 3 cart service

**Phase 5**: T024, T025 (order types, queries) → [P] together → T026 (service) → T027 (router)

**Phase 7**: T031 (admin queries) → [P] with existing order.queries.ts additions → T032 (service additions) → T033 (router additions)

---

## Parallel Execution Examples

```bash
# Phase 3 — start these together:
Task T010: "Create backend/src/modules/cart/cart.types.ts"
Task T011: "Create backend/src/modules/cart/cart.validator.ts"
Task T012: "Create backend/src/modules/cart/cart.queries.ts"

# Phase 4 — shipping method foundation in parallel:
Task T015: "Create backend/src/modules/shipping-methods/shipping-method.types.ts"
Task T016: "Create backend/src/modules/shipping-methods/shipping-method.validator.ts"
Task T017: "Create backend/src/modules/shipping-methods/shipping-method.queries.ts"

# Phase 5 — start together:
Task T024: "Create backend/src/modules/orders/order.types.ts"
Task T025: "Create backend/src/modules/orders/order.queries.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — the purchase flow)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T009) — CRITICAL, blocks all stories
3. Complete Phase 3: US1 Cart (T010–T014)
4. Complete Phase 4: US2 Shipping + Checkout Preview (T015–T023)
5. Complete Phase 5: US3 Order Placement (T024–T027)
6. **STOP and VALIDATE**: Full journey guest cart → checkout → place order → order exists
7. Then add US4 (patient views) and US5 (admin views)

### Incremental Delivery

- After Phase 3: Cart works for guest + auth users
- After Phase 4: Checkout preview with tax working, shipping methods manageable by admin
- After Phase 5: Orders can be placed (purchase flow complete)
- After Phase 6: Patients can view history and self-cancel
- After Phase 7: Admin can manage full order lifecycle

---

## Notes

- `[P]` tasks can run concurrently — they touch different files with no cross-task dependencies
- All services use `withTenantContext` — never import `db` directly (constitution rule)
- `req.params.id` must be cast as `string` (ParamsDictionary has `string | string[]`)
- Register `/validate` style routes BEFORE `/:id` routes to prevent param shadowing (pattern from catalogue)
- Order `notes` field MUST NEVER appear in patient-facing responses — verify at service AND router layer
- Preview token amounts are NEVER trusted at placement — server always recalculates from scratch
- `UNIQUE NULLS NOT DISTINCT` requires PostgreSQL 15+ (confirmed in Docker image)
- Inventory adjustment at cancel uses reason `'RETURN'` matching existing `InventoryReason` enum from Phase 3

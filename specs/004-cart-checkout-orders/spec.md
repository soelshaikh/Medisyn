# Feature Specification: Cart, Checkout & Orders

**Feature Branch**: `004-cart-checkout-orders`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Phase 4 — Cart (guest + authenticated), checkout with province-based GST/HST/PST tax, order creation with server-side totals, detailed order status lifecycle (pending → confirmed → processing → ready → shipped → delivered → cancelled → refunded), order management for patients and admin.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Guest & Authenticated Cart Management (Priority: P1)

A patient browses the pharmacy store and adds products (with or without variants) to a shopping cart. If they are not logged in, the cart is tied to their browser session. If they are logged in, the cart is stored against their account and survives across devices and sessions. When a guest logs in, their in-session guest cart items are merged into their account cart — the account cart takes priority for price but quantity conflicts resolve by taking the higher of the two quantities.

**Why this priority**: A cart is the entry point to all purchasing. Nothing downstream (checkout, orders) can exist without it.

**Independent Test**: A guest can add 2 items, see them in the cart, log in, and the items are present in their account cart. An authenticated user can add items on one device and see them on another session.

**Acceptance Scenarios**:

1. **Given** a guest user with no cart, **When** they add a product to cart, **Then** a cart is created and the item appears with correct quantity and current price.
2. **Given** a guest with 2 items in cart, **When** they log in to an account with 1 overlapping item (quantity 1), **Then** the merged cart has the overlapping item at the higher quantity (guest qty if greater), plus all non-overlapping items.
3. **Given** an authenticated user's cart, **When** a product's price changes in the catalogue, **Then** the cart item still shows the price at time of addition (price snapshot), and checkout recalculates at current price.
4. **Given** an authenticated user's cart, **When** they remove an item, **Then** the item is removed and the cart total updates accordingly.
5. **Given** an authenticated user, **When** they update an item's quantity to 0 or explicitly remove it, **Then** the item is removed from the cart.
6. **Given** an authenticated user's cart, **When** they clear the cart, **Then** all items are removed.
7. **Given** a request to add an item with quantity exceeding available stock, **Then** the request is rejected with a clear out-of-stock or insufficient-stock message.

---

### User Story 2 — Checkout: Address, Shipping & Tax Preview (Priority: P1)

A logged-in patient proceeds to checkout from their cart. They provide a Canadian delivery address (street, city, province, postal code). They select a shipping method from the available options for their facility. Before confirming, they see a full itemized cost breakdown: subtotal (sum of line items), tax breakdown (by tax type — GST, HST, or PST, depending on their province), shipping cost, and grand total. All amounts are calculated server-side.

**Why this priority**: Checkout is the bridge between browsing and purchasing. Tax accuracy is legally required in Canada — showing the wrong total before confirmation is a compliance risk.

**Independent Test**: A logged-in user with a non-empty cart can reach a checkout summary showing the correct subtotal, a province-correct tax breakdown, and a grand total. The total must match server-calculated amounts — frontend display cannot differ from what the order will be created with.

**Acceptance Scenarios**:

1. **Given** a cart with 2 items, an Ontario delivery address, **When** the user requests a checkout preview, **Then** the response includes subtotal, HST at 13%, and grand total = subtotal + HST + shipping.
2. **Given** a cart with 2 items, a British Columbia address, **When** requesting checkout preview, **Then** the response shows GST (5%) and PST (7%) as separate line items, plus grand total.
3. **Given** a cart with 2 items, an Alberta address, **When** requesting checkout preview, **Then** only GST (5%) appears — no PST.
4. **Given** an empty cart, **When** proceeding to checkout, **Then** the request is rejected with a clear "cart is empty" error.
5. **Given** an item in cart that has gone out of stock since it was added, **When** requesting checkout preview, **Then** the preview fails and lists the unavailable item(s) so the user can remove them.
6. **Given** a valid checkout preview, **When** the user selects a different shipping method, **Then** the shipping cost and grand total update accordingly.

---

### User Story 3 — Order Placement (Priority: P1)

A logged-in patient confirms their checkout and places the order. The system performs a final server-side validation (stock check, total recalculation) and creates an order record containing immutable snapshots of all prices, tax amounts, shipping cost, and product details at the time of purchase. The cart is cleared on success. The order starts in `pending` status.

**Why this priority**: Order creation is the core commercial transaction. Immutable price snapshots and server-side total calculation are legal and financial requirements — there is no safe way to partially implement this.

**Independent Test**: A patient places an order. The resulting order record contains the correct line items, tax breakdown, shipping cost, and grand total matching the checkout preview. The patient's cart is empty afterwards.

**Acceptance Scenarios**:

1. **Given** a valid checkout preview (address + shipping method selected), **When** the patient confirms the order, **Then** an order is created with status `pending`, containing immutable line-item snapshots and a correct server-side total.
2. **Given** an order is placed, **Then** the cart is cleared immediately.
3. **Given** an item goes out of stock between checkout preview and order confirmation, **When** the patient confirms, **Then** the order is rejected, the specific unavailable item is identified, and the cart is not cleared.
4. **Given** an order is placed, **Then** the order total matches exactly what was shown in the checkout preview (no rounding differences).
5. **Given** a guest (unauthenticated) user, **When** attempting to place an order, **Then** the request is rejected — guests cannot place orders (they must log in first).

---

### User Story 4 — Patient Order History & Self-Service Cancellation (Priority: P2)

A logged-in patient can view their own order history (paginated list), open an order detail page showing all line items, status, and shipping information, and cancel an order that is still in `pending` status.

**Why this priority**: Post-purchase visibility is expected by customers. Self-service cancellation reduces support load. This is P2 because orders can exist and be managed by admin without this — it is a patient-facing convenience.

**Independent Test**: A patient who has placed 3 orders can list all 3, open each one, and cancel the one that is still `pending`. Cancellation is not possible once the order moves past `pending`.

**Acceptance Scenarios**:

1. **Given** a patient with past orders, **When** they request their order list, **Then** they receive a paginated list of their own orders (newest first) with order number, date, status, and total.
2. **Given** a patient viewing an order, **When** they open the order detail, **Then** they see all line items (product name, variant if applicable, quantity, unit price, line total), shipping address, shipping method, tax breakdown, and grand total.
3. **Given** an order in `pending` status, **When** the patient cancels it, **Then** the order status becomes `cancelled` and stock is restored.
4. **Given** an order in `confirmed` or later status, **When** the patient attempts to cancel, **Then** the request is rejected with a clear "order cannot be cancelled at this stage" message.
5. **Given** a patient attempting to view another patient's order, **Then** the request returns not found (no cross-patient data access).

---

### User Story 5 — Admin Order Management (Priority: P2)

Admin and pharmacy staff can view all orders for their facility, filter by status, view full order detail (including patient info and shipping address), and manually advance an order through its status lifecycle. Admins can cancel any `pending` or `confirmed` order and initiate a refund for delivered orders.

**Why this priority**: Staff need to fulfil and track orders. Without this, placed orders have no operational workflow.

**Independent Test**: An admin can list all orders, filter to `pending` only, open one, advance it to `confirmed`, then `processing`, then `ready`, then `shipped`. A separate admin can mark it `delivered`. Attempting to move directly from `pending` to `shipped` is rejected (invalid transition).

**Acceptance Scenarios**:

1. **Given** an admin, **When** they list orders, **Then** they see all facility orders (paginated, newest first) filterable by status, with patient name, order number, date, and total.
2. **Given** an order in `pending` status, **When** an admin advances it to `confirmed`, **Then** status becomes `confirmed` and a status history entry is created recording who made the change and when.
3. **Given** an order, **When** an admin attempts an invalid status transition (e.g., `pending` → `shipped`), **Then** the request is rejected with a clear invalid-transition error.
4. **Given** an order in `delivered` status, **When** an admin initiates a refund, **Then** status becomes `refunded` and a history entry is created.
5. **Given** an order in `cancelled` or `refunded` status, **When** any status advance is attempted, **Then** the request is rejected — terminal statuses cannot be changed.
6. **Given** a status change, **Then** the admin can optionally attach a note (e.g., "delayed by supplier") that is stored with the history entry.

---

### Edge Cases

- What happens when a product is deactivated while it is in a cart? (Cart items for deactivated products are flagged at checkout but not auto-removed.)
- What if a coupon was applied to the cart and the order total changes (item removed)? (Coupon re-validated against new total at checkout preview and order placement.)
- What if two patients simultaneously attempt to order the last unit of a product? (Stock check at order placement uses SELECT FOR UPDATE — first confirmation wins, second is rejected.)
- What if a patient's session expires mid-checkout? (Guest cart is lost; authenticated cart is preserved — patient must log in again.)
- What if the province in the address is unrecognized? (Checkout preview rejected with an invalid province error — no fallback tax rate assumed.)
- What happens to inventory when an order is cancelled or refunded? (Stock is restored on `cancelled`; stock is restored on `refunded` only if admin marks "items returned".)

---

## Requirements *(mandatory)*

### Functional Requirements

**Cart**

- **FR-001**: The system MUST allow unauthenticated (guest) users to maintain a shopping cart tied to their browser session via a secure, HttpOnly cookie.
- **FR-002**: The system MUST allow authenticated users to maintain a persistent cart stored server-side, accessible across devices and sessions.
- **FR-003**: When a guest logs in, the system MUST merge their guest cart into their account cart. For duplicate items, the quantity is set to the maximum of the guest and account quantities.
- **FR-004**: The system MUST allow adding, updating quantity, and removing individual items from the cart.
- **FR-005**: The system MUST allow clearing the entire cart in a single operation.
- **FR-006**: The system MUST reject adding items with quantity exceeding available stock.
- **FR-007**: The system MUST allow adding a product variant (e.g., 500mg) as a distinct cart item, separate from other variants of the same product.
- **FR-008**: Cart items MUST store the price at time of addition (price snapshot). The live catalogue price is used at checkout, not the snapshot.

**Checkout**

- **FR-009**: The system MUST require an authenticated session to proceed to checkout.
- **FR-010**: The system MUST accept a Canadian delivery address with fields: street address, city, province (2-letter code), postal code, and optionally a unit/apartment number.
- **FR-011**: The system MUST calculate Canadian sales tax based on the delivery province. Supported provinces and their rates: ON: HST 13%; NS/NB/PEI/NL: HST 15%; QC: GST 5% + QST 9.975%; BC: GST 5% + PST 7%; MB: GST 5% + PST 7%; SK: GST 5% + PST 6%; AB/NT/NU/YT: GST 5% only. Tax is applied to the product subtotal (not shipping).
- **FR-012**: The system MUST return a full checkout preview containing: line items (product, variant, quantity, unit price, line total), subtotal, tax breakdown (each tax type as a separate named line), shipping cost, and grand total. All amounts MUST be calculated server-side.
- **FR-013**: The system MUST validate stock availability for all cart items before returning a checkout preview. Items that are out of stock MUST be listed in the error response.
- **FR-014**: The system MUST offer at least one shipping method per facility (configured by admin). Each shipping method has a name, flat rate, and estimated delivery window.
- **FR-015**: An empty cart MUST be rejected at checkout with a clear error.

**Order Placement**

- **FR-016**: The system MUST re-validate stock and recalculate all totals server-side at the moment of order placement, regardless of what the checkout preview showed.
- **FR-017**: The system MUST create an order containing: order number (human-readable, unique per facility), patient ID, facility ID, delivery address snapshot, shipping method snapshot, line items with quantity and unit price snapshots, tax breakdown snapshot, shipping cost snapshot, and grand total.
- **FR-018**: Orders MUST be created with status `pending`.
- **FR-019**: The patient's cart MUST be cleared immediately on successful order placement.
- **FR-020**: If stock is insufficient at order placement, the order MUST NOT be created, the cart MUST NOT be cleared, and the specific unavailable item(s) MUST be identified in the error response.
- **FR-021**: Guests MUST NOT be able to place orders. Authentication is required.
- **FR-022**: Stock MUST be decremented atomically at order placement using row-level locking (SELECT FOR UPDATE) to prevent overselling under concurrent load.

**Order Status Lifecycle**

- **FR-023**: Valid order statuses are: `pending`, `confirmed`, `processing`, `ready`, `shipped`, `delivered`, `cancelled`, `refunded`.
- **FR-024**: Valid forward transitions are: `pending → confirmed`, `confirmed → processing`, `processing → ready`, `ready → shipped`, `shipped → delivered`, `delivered → refunded`. Any other transition MUST be rejected.
- **FR-025**: `cancelled` and `refunded` are terminal statuses — no further transitions are permitted.
- **FR-026**: `pending` orders MAY be cancelled by either the patient (self-service) or an admin. `confirmed` orders MAY be cancelled by admin only.
- **FR-027**: Every status change MUST create an immutable status history entry recording: previous status, new status, changed-by user ID, timestamp, and an optional note.
- **FR-028**: When an order is cancelled (from `pending` or `confirmed`), product stock MUST be restored for each line item.

**Patient Order Access**

- **FR-029**: Authenticated patients MUST be able to retrieve a paginated list of their own orders, ordered newest first.
- **FR-030**: Authenticated patients MUST be able to retrieve the full detail of any of their own orders.
- **FR-031**: Patients MUST NOT be able to access other patients' orders.

**Admin Order Access**

- **FR-032**: Admin users with the `orders.read` permission MUST be able to list all orders for their facility, with optional filtering by status.
- **FR-033**: Admin users with the `orders.manage` permission MUST be able to advance order status, add notes to status history entries, and cancel orders.

### Key Entities

- **Cart**: Belongs to a guest session or an authenticated user. Contains zero or more cart items. Scoped to a facility.
- **CartItem**: One product (and optionally one variant) with a quantity and a price snapshot. Belongs to a cart.
- **ShippingMethod**: Admin-configured option with a name, flat rate, and estimated delivery days. Scoped to a facility.
- **Order**: Immutable record of a completed purchase. Contains all financial snapshots, delivery address snapshot, and current status. Belongs to a patient and a facility.
- **OrderItem**: One line in an order. Stores product/variant identity, product name (snapshot), unit price (snapshot), quantity, and line total.
- **OrderStatusHistory**: Append-only log of every status transition on an order. Records who changed it, when, and an optional note.
- **TaxRule**: Province-code to tax-type/rate mapping. Configurable per province, not per facility (national rates).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A patient can complete the full journey from empty cart to placed order in under 3 minutes on a standard connection.
- **SC-002**: Checkout preview and order placement respond within 2 seconds under normal load.
- **SC-003**: Tax calculations match CRA-published provincial rates with zero rounding errors across all 13 provinces and territories.
- **SC-004**: Concurrent order placement for the last unit of a product results in exactly one success and one "insufficient stock" error — no overselling.
- **SC-005**: 100% of placed orders have a correct, immutable price snapshot — the stored total matches the checkout preview total to the cent.
- **SC-006**: Every order status change appears in the order's status history within the same request — no silent transitions.

---

## Assumptions

- Online payment processing is out of scope for this phase. Order placement creates the order record but does not process payment. Payment will be handled in a future phase.
- All prices are in Canadian dollars (CAD). No multi-currency support.
- Shipping methods are flat-rate (no weight-based or distance-based calculation). Each facility configures its own shipping methods.
- Tax is calculated on the product subtotal only, not on shipping costs (this is standard Canadian practice for most goods).
- Quebec QST (9.975%) is calculated on the pre-GST subtotal, not on top of GST (the "additive" method used in Quebec since 2013).
- Guest carts are identified by a server-issued cookie (`cart_token`). The cookie is HttpOnly, Secure, and SameSite=Strict. Guest carts expire after 30 days of inactivity.
- A patient is scoped to a single facility at a time (as per existing platform architecture). Orders are facility-scoped.
- Product price at checkout is the current catalogue price, not the cart-item price snapshot. The snapshot is for display purposes only.
- Refund initiation records the intent; actual payment reversal is out of scope for this phase.
- A maximum of 50 items per cart is enforced to prevent abuse.
- Order numbers are human-readable (e.g., `ORD-00001`) and unique per facility, generated sequentially.
- "Items returned" flag for stock restoration on refund is not in scope for this phase — stock is not auto-restored on `refunded` status.

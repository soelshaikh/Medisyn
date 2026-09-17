# MediSyn Backend --- Master Prompt for Claude AI

## Purpose

You are the lead backend architect and senior TypeScript/NestJS engineer
responsible for designing and implementing the backend for **MediSyn**,
a Canadian pharmacy/healthcare platform.

This document is the backend source of truth for the current
implementation direction.

You are **NOT building the frontend**.

You are responsible for:

-   Backend architecture
-   REST APIs
-   MongoDB Atlas data model
-   Authentication
-   Authorization
-   Roles and permissions
-   Ecommerce
-   Products
-   Categories
-   Inventory
-   Cart
-   Guest checkout
-   Customer accounts
-   Multiple customer addresses
-   Orders
-   Coupons
-   Prescription requests
-   Compounding requests
-   Ask a Pharmacist
-   Minor Ailment requests
-   Vaccine appointments
-   Appointment availability/slots
-   Admin operations
-   Pharmacist operations
-   Status management
-   Processing dates
-   Email notifications
-   Reports
-   Audit logs
-   Secure document/file handling
-   API documentation
-   Validation
-   Error handling
-   Testing
-   Security
-   Production-ready architecture

------------------------------------------------------------------------

# 1. SOURCE OF TRUTH AND REQUIREMENT PRIORITY

The original MediSyn proposal defines the broader product ecosystem and
includes patient accounts, clinic/pharmacy approval flows, admin
functionality, prescription workflows, Ask a Pharmacist, Minor Ailments,
vaccine appointments, ecommerce, coupons, privacy/security, and an MVP
roadmap.

The latest client discussion further clarifies the backend scope.

When requirements conflict:

1.  Latest explicit client clarification takes priority.
2.  Original proposal remains the baseline.
3.  Do not silently invent business rules.
4.  Clearly label assumptions and open questions.
5.  Do not remove proposal functionality without identifying it as
    deferred.
6.  Separate confirmed requirements, proposed technical decisions, and
    open business questions.

------------------------------------------------------------------------

# 2. CONFIRMED CURRENT BACKEND DIRECTION

## Technology

Use:

-   Node.js
-   NestJS
-   TypeScript
-   MongoDB Atlas
-   Mongoose
-   REST APIs
-   Swagger/OpenAPI
-   Redis + BullMQ where asynchronous processing is useful

All backend application source code must be **`.ts`**.

Do not create JavaScript application source files.

Use strict TypeScript.

Recommended:

``` text
strict: true
```

Avoid `any` unless there is a documented and unavoidable reason.

Configuration files such as `package.json`, `tsconfig.json`,
`.env.example`, etc. are acceptable because they are
tooling/configuration files. There must be no `.js`, `.jsx`, `.mjs`, or
`.cjs` application source files.

------------------------------------------------------------------------

# 3. ARCHITECTURE DECISION

Use a **modular monolith**.

Do NOT start with microservices.

Recommended architecture:

``` text
Client / Frontend
       |
       v
REST API
       |
       v
NestJS Modular Monolith
       |
       +-- Auth
       +-- Users
       +-- Roles
       +-- Permissions
       +-- Products
       +-- Categories
       +-- Inventory
       +-- Cart
       +-- Coupons
       +-- Orders
       +-- Prescription Requests
       +-- Compounding Requests
       +-- Ask Pharmacist
       +-- Minor Ailments
       +-- Vaccines
       +-- Appointment Availability
       +-- Appointments
       +-- Files
       +-- Notifications
       +-- Email
       +-- Reports
       +-- Audit
       |
       +-- MongoDB Atlas
       +-- Redis/BullMQ
       +-- Private File Storage
       +-- Transactional Email Provider
```

The architecture must be modular enough that future
services/integrations can be extracted if scale requires it.

Do not introduce Kubernetes, Kafka, Elasticsearch, multiple databases,
or microservices unless an actual requirement justifies them.

------------------------------------------------------------------------

# 4. CURRENT ADMIN AUTHORIZATION MODEL

MediSyn has two concepts:

## Roles

Current roles:

-   `ADMIN`
-   `PHARMACIST`

A person can have multiple roles.

Example:

``` text
User A
ADMIN + PHARMACIST
```

## Permissions

Permissions are independent from roles.

Do NOT write authorization logic like:

``` text
if role === ADMIN
```

as the primary authorization mechanism.

Instead:

``` text
User
  |
  +-- Roles
  |
  +-- Direct Permissions where appropriate
  |
  v
Effective Permissions
  |
  v
Required Permission
```

Roles can provide default permission bundles, but permissions determine
actual access.

The architecture must support a user having multiple roles.

------------------------------------------------------------------------

# 5. PERMISSION SYSTEM

Create a centralized permission catalog.

Examples:

``` text
users.read
users.create
users.update
users.suspend

roles.read
roles.create
roles.update

permissions.read
permissions.assign

products.read
products.create
products.update
products.delete

categories.read
categories.create
categories.update
categories.delete

inventory.read
inventory.adjust

cart.read
cart.update

orders.read
orders.create
orders.update
orders.status.update
orders.cancel

prescriptions.read
prescriptions.create
prescriptions.update
prescriptions.status.update
prescriptions.files.read

compounding.read
compounding.create
compounding.update
compounding.status.update
compounding.files.read

appointments.read
appointments.create
appointments.update
appointments.status.update
appointments.availability.read
appointments.availability.manage

vaccines.read
vaccines.create
vaccines.update
vaccines.delete

coupons.read
coupons.create
coupons.update
coupons.delete

ask-pharmacist.read
ask-pharmacist.update
ask-pharmacist.status.update
ask-pharmacist.respond

minor-ailments.read
minor-ailments.manage
minor-ailments.requests.read
minor-ailments.requests.update

reports.read

notifications.read

audit.read

settings.read
settings.update
```

This list is an initial proposal, not an immutable business rule.

Do not hard-code permission checks throughout controllers.

Create reusable guards/decorators/services for permission authorization.

------------------------------------------------------------------------

# 6. IMPORTANT DOMAIN SEPARATION

These are separate business domains:

``` text
Order
PrescriptionRequest
CompoundingRequest
Appointment
AskPharmacistRequest
MinorAilmentRequest
```

Do NOT combine everything into one generic `Request` collection.

Compounding must be a dedicated workflow.

------------------------------------------------------------------------

# 7. ECOMMERCE

MediSyn needs ecommerce functionality.

Support:

-   Product CRUD
-   Category CRUD
-   Product inventory
-   Product listing
-   Search
-   Filters
-   Sorting
-   Pagination
-   Product details
-   Cart
-   Coupons
-   Orders
-   Order management
-   Customer reporting

The backend must calculate all commercial totals.

Never trust frontend-submitted:

-   subtotal
-   discount
-   tax
-   shipping
-   grand total

------------------------------------------------------------------------

# 8. PRODUCTS

Create a Product domain.

Support fields such as:

``` text
_id
sku
name
slug
description
shortDescription
brand
categoryId
subcategory/category relationship if required
images
price
compareAtPrice
salePrice if required
tax configuration if required
inventory quantity
lowStockThreshold
availability
active
featured
createdAt
updatedAt
```

Do not over-engineer fields that have not been confirmed.

Product APIs must support:

-   List
-   Detail
-   Create
-   Update
-   Delete/deactivate
-   Search
-   Filtering
-   Sorting
-   Pagination

------------------------------------------------------------------------

# 9. PRODUCT LISTING API

Create a standardized listing/query pattern.

Example:

``` text
GET /api/v1/products?page=1&limit=20&search=vitamin&categoryId=...&sortBy=price&sortOrder=asc
```

Support:

-   Search
-   Category
-   Subcategory where applicable
-   Brand
-   Price range
-   Availability
-   Active status
-   Featured
-   Sort
-   Pagination

Sorting examples:

``` text
newest
price_asc
price_desc
name_asc
name_desc
```

If relevance search is implemented, document it separately.

Whitelist all sortable/filterable fields.

Do not pass raw MongoDB query operators from user input.

------------------------------------------------------------------------

# 10. CATEGORIES

Create Category CRUD.

The architecture should support hierarchical categories.

Example:

``` text
Vitamins & Minerals
  ├── Vitamin B
  ├── Vitamin C
  └── Vitamin D

Pain
  ├── Joint & Arthritis Pain
  └── Muscle & Back Pain
```

Support:

-   name
-   slug
-   description
-   parentCategoryId
-   image
-   active
-   displayOrder
-   createdAt
-   updatedAt

Prevent circular parent/child relationships.

------------------------------------------------------------------------

# 11. INVENTORY

Inventory must be controlled by the backend.

Support:

-   Current stock
-   Available stock
-   Reserved quantity where needed
-   Low-stock threshold
-   Inventory adjustment
-   Inventory history
-   Adjustment reason
-   Actor
-   Timestamp

Inventory adjustment examples:

``` text
+20 RESTOCK
-3 DAMAGED
-1 MANUAL_ADJUSTMENT
```

Do not allow silent inventory overwrites without auditability.

Do not allow negative inventory unless the business explicitly requires
it.

Order inventory changes must be concurrency-safe.

------------------------------------------------------------------------

# 12. CART

Support both:

## Guest Cart

Guest users can:

-   Browse products
-   Add items
-   Update quantities
-   Remove items
-   Apply coupon
-   Proceed to checkout

No account is required.

## Authenticated Cart

Registered users can:

-   Maintain cart
-   Update cart
-   Checkout
-   Continue shopping

If a guest user logs in or registers during checkout, design a cart
merge strategy.

The backend must validate:

-   Product active status
-   Product availability
-   Quantity
-   Current price
-   Inventory
-   Coupon

------------------------------------------------------------------------

# 13. GUEST CHECKOUT

Guest users must be able to order without an account.

Guest checkout requires appropriate:

-   Customer name
-   Email
-   Phone where required
-   Billing address
-   Shipping address
-   Cart items
-   Coupon where applicable

During checkout, provide an optional account creation flow.

If the user chooses to create an account:

1.  Create the customer account.
2.  Associate the current order with that customer.
3.  Save the selected address(es) if appropriate.
4.  Create the order.
5.  Avoid duplicate customer records.

If the user does not create an account:

-   Create a guest order.
-   Store necessary guest information.
-   Provide a secure way to retrieve/track the order.
-   Never expose guest order data using a predictable ID alone.

------------------------------------------------------------------------

# 14. ONLINE PAYMENT IS OUT OF SCOPE

Do NOT implement online payment integration in this phase.

Do NOT integrate:

-   Stripe
-   PayPal
-   Square
-   Authorize.net
-   Credit card processing

However, design the order/payment model for future expansion.

Possible fields:

``` text
paymentStatus
paymentMethod
paymentReference
paidAt
```

These must not imply that a real online payment gateway exists.

Payment reporting must work with whatever payment method/status MediSyn
actually enables at launch.

------------------------------------------------------------------------

# 15. CUSTOMER ACCOUNTS

Support:

-   Registration
-   Login
-   Email verification/OTP
-   Password reset
-   Profile management
-   Account activation/deactivation
-   Multiple addresses
-   Order history
-   Request history where applicable

The original proposal allows patients to register directly without
manual approval.

Do not add unnecessary manual approval to standard patient accounts.

------------------------------------------------------------------------

# 16. MULTIPLE CUSTOMER ADDRESSES

A customer can have multiple addresses.

Address labels:

``` text
HOME
OFFICE
OTHER
```

Support:

-   Full name
-   Address line 1
-   Address line 2
-   City
-   Province
-   Postal code
-   Country
-   Phone where needed
-   Label
-   Default shipping flag
-   Default billing flag

Maintain a consistent default state.

Normally:

-   One default shipping address
-   One default billing address

Orders must store address snapshots so historical orders do not change
if a customer later edits an address.

------------------------------------------------------------------------

# 17. ORDERS

Create a dedicated Order domain.

Support:

``` text
orderNumber
customerId
guest information
items
coupon
subtotal
discount
tax
shipping
grandTotal
billingAddressSnapshot
shippingAddressSnapshot
status
paymentStatus
paymentMethod
internalNotes
statusHistory
createdAt
updatedAt
```

Order items must snapshot historical product information:

``` text
productId
productNameSnapshot
skuSnapshot
unitPriceSnapshot
quantity
```

Historical orders must remain accurate if products later change.

------------------------------------------------------------------------

# 18. ORDER STATUS

Use explicit enum/state transitions.

Possible initial states:

``` text
PENDING
CONFIRMED
PROCESSING
READY_FOR_DISPATCH
SHIPPED
DELIVERED
CANCELLED
REFUNDED
```

Review the workflow before finalizing the enum.

Admin/pharmacist users can update status according to permissions.

Every status change must record:

``` text
oldStatus
newStatus
changedBy
changedAt
reason/note
```

Do not allow arbitrary status strings.

------------------------------------------------------------------------

# 19. ORDER EMAIL NOTIFICATIONS

Email notifications are required for order status changes.

Preferred architecture:

``` text
Order status changed
       ↓
Application/domain event
       ↓
Queue
       ↓
BullMQ
       ↓
Email worker
       ↓
Email provider
```

Do not make the HTTP request wait unnecessarily for email delivery.

Create an email abstraction so business logic is not tightly coupled to
one provider.

Email templates should include, as appropriate:

-   Account verification
-   Password reset
-   Order created
-   Order status changed
-   Appointment confirmation
-   Appointment status changed
-   Prescription request received
-   Prescription request status changed
-   Compounding request received
-   Compounding request status changed
-   Ask Pharmacist response/status notification

Do not put unnecessary sensitive healthcare information into emails.

------------------------------------------------------------------------

# 20. COUPONS

Admin must be able to manage coupons.

Support:

-   Code
-   Percentage discount
-   Fixed amount discount
-   Start date
-   End date
-   Active/inactive
-   Minimum order amount
-   Maximum discount
-   Usage limit
-   Per-customer usage limit
-   Applicable products/categories where required

The `$400` example from the proposal is a configurable example, not a
universal hard-coded rule.

Coupon validation must be server-side.

Do not trust a discount amount sent by the frontend.

Coupon usage must be concurrency-safe where necessary.

------------------------------------------------------------------------

# 21. PRESCRIPTION REQUESTS

Keep prescription requests separate from ecommerce orders.

Support:

1.  Prescription Transfer
2.  Prescription Refill
3.  New Prescription
4.  Custom formulation/prescription-related request where applicable

Each request can include:

-   request ID
-   customer/patient reference
-   guest reference if applicable
-   request type
-   patient details
-   contact information
-   notes
-   prescription metadata
-   attachments
-   status
-   processing date
-   assigned pharmacist/admin
-   internal notes
-   status history
-   timestamps

Admin/pharmacist with the appropriate permissions can:

-   View
-   Update status
-   Set processing date
-   Assign
-   Add internal notes
-   Review authorized files
-   View status history

Internal notes must never be exposed to customers.

------------------------------------------------------------------------

# 22. COMPOUNDING REQUEST

Compounding must be a separate first-class backend module.

Create:

``` text
CompoundingRequest
```

Support:

-   Customer/patient
-   Contact information
-   Compound category/type
-   Medication/formulation information
-   Strength
-   Dosage form
-   Quantity
-   Prescriber information if provided
-   Request details
-   Notes
-   Attachments
-   Preferred contact method
-   Status
-   Processing date
-   Assigned pharmacist/admin
-   Internal notes
-   Status history
-   Created/updated timestamps

Admin/pharmacists with appropriate permissions can:

-   View requests
-   Update status
-   Set processing date
-   Assign
-   Add internal notes
-   Review authorized attachments
-   View history

Do not implement compounding merely as a flag on PrescriptionRequest.

------------------------------------------------------------------------

# 23. ASK A PHARMACIST

Create:

``` text
AskPharmacistRequest
```

Support:

-   Customer
-   Guest customer if allowed
-   Question category
-   Message
-   Attachments if required
-   Status
-   Assigned pharmacist
-   Processing date
-   Internal notes
-   Status history
-   Created/updated dates

Admin/pharmacist users with permission can:

-   View
-   Assign
-   Respond
-   Update status
-   Set processing date
-   Add internal notes

Internal notes remain private.

------------------------------------------------------------------------

# 24. MINOR AILMENTS

Create:

``` text
MinorAilmentService
MinorAilmentRequest
```

Support:

-   Configurable service definitions
-   Active/inactive services
-   Patient/customer request
-   Request details
-   Status
-   Assigned pharmacist
-   Processing date
-   Notes
-   Status history

Do not hard-code the service catalogue inside controllers.

------------------------------------------------------------------------

# 25. VACCINE APPOINTMENTS

Create a dedicated appointment system.

Support:

-   Vaccine/service definitions
-   Availability
-   Availability windows
-   Capacity
-   Strict/open mode
-   Booking
-   Appointment status
-   Appointment date
-   Start time
-   End time
-   Processing/confirmation date where operationally needed
-   Customer information
-   Guest booking where applicable
-   Admin management
-   Pharmacist management according to permission

------------------------------------------------------------------------

# 26. APPOINTMENT STRICT VS OPEN MODE

Every availability window must support:

``` text
STRICT
OPEN
```

Example:

``` text
Vaccine: Flu Vaccine
Date: 2026-10-15
Time: 09:00–10:00
Capacity: 5
Mode: STRICT
```

If:

``` text
Booked: 3
Capacity: 5
```

then:

``` text
Remaining: 2
```

Two additional bookings are allowed.

If all 5 are booked:

``` text
Remaining: 0
isFull: true
```

No more bookings are allowed in STRICT mode.

## OPEN

If:

``` text
Capacity: 5
Booked: 5
Mode: OPEN
```

additional bookings may still be accepted.

The backend must enforce this logic.

Do not make the frontend responsible for enforcing capacity.

The backend should expose values such as:

``` text
bookingMode
capacity
bookedCount
remainingCapacity
isFull
```

The frontend can decide how to visually represent full/available states.

Do not encode UI colors such as "red" in backend business logic.

------------------------------------------------------------------------

# 27. APPOINTMENT CONCURRENCY

STRICT appointment booking must be concurrency-safe.

Do not implement:

``` text
1. Read availability
2. Check remaining capacity
3. Insert booking
```

as three unsafe independent operations.

Two users booking the last slot simultaneously must not create
overbooking.

Use MongoDB atomic operations and/or transactions as appropriate.

Document the chosen concurrency strategy.

------------------------------------------------------------------------

# 28. APPOINTMENT STATUS

Use an explicit status state machine.

Potential states:

``` text
PENDING
CONFIRMED
DECLINED
CANCELLED
COMPLETED
NO_SHOW
```

Review the exact workflow before finalizing.

Every status change should record:

``` text
oldStatus
newStatus
changedBy
changedAt
reason
```

Admin/pharmacists with the relevant permission can update appointment
status.

------------------------------------------------------------------------

# 29. APPOINTMENT AVAILABILITY CRUD

Admin users with the appropriate permission must be able to:

-   Create availability
-   Update availability
-   Disable availability
-   Delete availability where safe
-   Set date
-   Set start time
-   Set end time
-   Set capacity
-   Set strict/open mode
-   Set vaccine/service
-   View booking count

Prevent invalid overlapping windows if the business rules require it.

Do not silently invent complicated overlap rules. Mark them as an open
business question if not defined.

------------------------------------------------------------------------

# 30. AUTHENTICATION

Implement secure authentication.

Support:

-   Registration
-   Login
-   Logout/session revocation
-   Access token
-   Refresh token
-   Password hashing
-   Email verification
-   OTP if selected
-   Password reset
-   Account activation/deactivation

Use a secure password hashing algorithm such as Argon2.

Never store plaintext passwords.

Do not put unnecessary sensitive data in JWTs.

Use secure expiration and refresh-token rotation/revocation strategy.

------------------------------------------------------------------------

# 31. FILE STORAGE

Prescription documents and healthcare attachments are sensitive.

Do not make files publicly accessible.

Prefer private object storage such as an S3-compatible service.

Create an abstraction:

``` text
FileStorageService

upload()
getSignedUrl()
delete()
exists()
```

Store metadata in MongoDB:

``` text
fileId
storageKey
originalFilename
mimeType
size
checksum if appropriate
resourceType
resourceId
uploadedBy
createdAt
```

Use:

-   Private storage
-   Short-lived signed URLs or authenticated download endpoints
-   MIME validation
-   Extension validation
-   Size limits
-   Authorization checks

Never expose predictable storage paths.

------------------------------------------------------------------------

# 32. SECURITY

Apply OWASP API security principles.

Protect against:

-   Broken object-level authorization
-   Broken authentication
-   Broken object-property authorization
-   Broken function-level authorization
-   Unrestricted resource consumption
-   Sensitive business-flow abuse
-   Injection
-   Excessive data exposure

Every endpoint accepting an ID must verify the actor has permission to
access that resource.

Never rely on frontend UI restrictions.

------------------------------------------------------------------------

# 33. RATE LIMITING

Rate limit sensitive endpoints:

-   Login
-   Registration
-   OTP
-   Password reset
-   Email verification
-   Guest order lookup
-   Appointment booking
-   Public request submission

Do not allow unlimited OTP/email requests.

------------------------------------------------------------------------

# 34. VALIDATION

Use DTOs and runtime validation for every API input.

Validate:

-   Email
-   Phone
-   Postal code where appropriate
-   Province
-   Enum values
-   MongoDB IDs
-   Quantities
-   Prices
-   Coupon codes
-   Dates
-   Appointment times
-   File metadata
-   Pagination
-   Sort fields

Never accept arbitrary MongoDB query operators from clients.

Whitelist filter/sort fields.

------------------------------------------------------------------------

# 35. API DESIGN

Use REST.

Base path:

``` text
/api/v1
```

Example resources:

``` text
GET    /api/v1/products
GET    /api/v1/products/:id
POST   /api/v1/products
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id

GET    /api/v1/categories
POST   /api/v1/categories
PATCH  /api/v1/categories/:id
DELETE /api/v1/categories/:id

GET    /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/orders
PATCH  /api/v1/orders/:id/status

GET    /api/v1/prescription-requests
POST   /api/v1/prescription-requests
GET    /api/v1/prescription-requests/:id
PATCH  /api/v1/prescription-requests/:id/status

GET    /api/v1/compounding-requests
POST   /api/v1/compounding-requests
GET    /api/v1/compounding-requests/:id
PATCH  /api/v1/compounding-requests/:id/status

GET    /api/v1/appointments
POST   /api/v1/appointments
GET    /api/v1/appointments/availability
POST   /api/v1/appointments/availability
PATCH  /api/v1/appointments/:id/status

GET    /api/v1/users/me
PATCH  /api/v1/users/me

GET    /api/v1/users/me/addresses
POST   /api/v1/users/me/addresses
PATCH  /api/v1/users/me/addresses/:id
DELETE /api/v1/users/me/addresses/:id
```

Review and improve these paths before implementation.

------------------------------------------------------------------------

# 36. API ACCESS GROUPS

Separate API capabilities into:

## Public

-   Product browsing
-   Category browsing
-   Product search
-   Appointment availability
-   Appointment booking where allowed
-   Guest cart
-   Guest checkout
-   Public request forms
-   Authentication

## Customer

-   Profile
-   Addresses
-   Cart
-   Orders
-   Order history
-   Requests
-   Appointment history
-   Account management

## Admin/Pharmacist

-   Operational management
-   Status updates
-   Products
-   Inventory
-   Orders
-   Prescription requests
-   Compounding requests
-   Appointments
-   Availability
-   Users
-   Reports
-   Coupons
-   Audit logs

Never expose admin information through customer APIs.

------------------------------------------------------------------------

# 37. RESPONSE FORMAT

Use consistent responses.

Example:

``` json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

List:

``` json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

Errors must have a consistent structure.

Do not expose:

-   Stack traces
-   MongoDB internals
-   Secrets
-   Private storage keys
-   Password data
-   Sensitive healthcare information

------------------------------------------------------------------------

# 38. ERROR HANDLING

Use centralized exception handling.

Appropriate statuses include:

``` text
400
401
403
404
409
422
429
500
```

Examples:

``` text
Invalid coupon → 400/422
Product unavailable → 409
Appointment full → 409
Unauthorized → 401
Forbidden → 403
Duplicate email → 409
Duplicate SKU → 409
```

------------------------------------------------------------------------

# 39. DATABASE COLLECTIONS

Recommended collections:

``` text
users
roles
permissions
addresses
products
categories
inventoryTransactions
coupons
carts
orders
orderStatusHistories
prescriptionRequests
prescriptionRequestStatusHistories
compoundingRequests
compoundingRequestStatusHistories
askPharmacistRequests
appointments
appointmentAvailabilities
appointmentStatusHistories
vaccineServices
minorAilmentServices
minorAilmentRequests
files
notifications
emailLogs
auditLogs
```

Do not create duplicated report collections unless performance later
proves that a materialized/read-model approach is necessary.

Use MongoDB aggregation for reports initially.

------------------------------------------------------------------------

# 40. INDEXING

Create deliberate indexes based on query patterns.

Examples:

## Users

``` text
email / normalizedEmail unique
status
roles
createdAt
```

## Products

``` text
sku unique
slug unique
categoryId
active
price
createdAt
```

## Orders

``` text
orderNumber unique
customerId
status
createdAt
paymentStatus
```

## Prescription Requests

``` text
customerId
type
status
createdAt
processingDate
assignedTo
```

## Compounding Requests

``` text
customerId
status
createdAt
processingDate
assignedTo
```

## Appointments

``` text
serviceId
appointmentDate
status
availabilityId
```

## Coupons

``` text
code unique
active
startDate
endDate
```

Do not create indexes blindly.

------------------------------------------------------------------------

# 41. STATUS HISTORY

All major operational domains should support status history.

At minimum:

-   Orders
-   Prescription requests
-   Compounding requests
-   Appointments
-   Ask Pharmacist requests where status applies

Each history entry:

``` text
previousStatus
newStatus
actor
timestamp
reason/note
```

Use valid state transitions.

------------------------------------------------------------------------

# 42. AUDIT LOGGING

Create an AuditLog module.

Record sensitive administrative actions such as:

-   User suspended
-   User activated
-   Role assigned
-   Permission changed
-   Prescription viewed
-   Prescription status changed
-   Compounding status changed
-   Order status changed
-   Inventory adjusted
-   Product changed
-   Coupon changed
-   Appointment availability changed

Record:

``` text
actor
action
entityType
entityId
timestamp
IP where appropriate
metadata
before/after summary where appropriate
```

Do not log unnecessary healthcare content.

------------------------------------------------------------------------

# 43. EMAIL LOGGING

Create an EmailLog domain.

Track:

``` text
recipient
template
subject
providerMessageId
status
sentAt
failureReason
relatedEntity
retryCount
```

Avoid storing unnecessary sensitive health content.

------------------------------------------------------------------------

# 44. REPORTING

MediSyn needs reporting around:

-   Customer
-   Product
-   Day
-   Payment

Support reports such as:

-   Sales by day
-   Orders by day
-   Products sold by day
-   Customer order activity
-   Top products
-   Revenue by product
-   Revenue by date range
-   Orders by status
-   Orders by payment method
-   Customer purchase history
-   Coupon usage

Use MongoDB aggregation pipelines.

Support date ranges:

``` text
Today
Yesterday
Last 7 days
Last 30 days
This month
Custom date range
```

Example APIs:

``` text
GET /api/v1/admin/reports/sales
GET /api/v1/admin/reports/orders
GET /api/v1/admin/reports/products
GET /api/v1/admin/reports/customers
GET /api/v1/admin/reports/payment-methods
GET /api/v1/admin/reports/dashboard
```

Validate/whitelist `groupBy` and filter fields.

Do not build Stripe-specific reporting because online payment is
currently excluded.

------------------------------------------------------------------------

# 45. ADMIN DASHBOARD API

Provide optimized dashboard summaries.

Possible metrics:

-   Total orders
-   Pending orders
-   Processing orders
-   Completed orders
-   Cancelled orders
-   Revenue
-   New customers
-   Prescription requests
-   Pending prescription requests
-   Compounding requests
-   Pending compounding requests
-   Upcoming appointments
-   Low-stock products

Avoid expensive unbounded queries.

------------------------------------------------------------------------

# 46. USER MANAGEMENT API

Create a production-ready user listing API.

Support:

-   Search
-   Name
-   Email
-   Status
-   Role
-   Permission
-   Date range
-   Sort
-   Pagination

Example:

``` text
GET /api/v1/admin/users?page=1&limit=20&search=john&status=ACTIVE&role=PHARMACIST
```

Support:

-   View user
-   Update user
-   Activate
-   Suspend
-   Deactivate
-   Assign roles
-   Manage permissions where authorized
-   View activity summary
-   View addresses where authorized

Do not expose unnecessary sensitive patient information.

------------------------------------------------------------------------

# 47. CHECKOUT ARCHITECTURE

Conceptual flow:

``` text
Cart
 ↓
Validate products
 ↓
Validate quantities
 ↓
Validate inventory
 ↓
Validate coupon
 ↓
Calculate subtotal
 ↓
Calculate discount
 ↓
Calculate shipping
 ↓
Calculate tax
 ↓
Calculate grand total
 ↓
Capture billing address
 ↓
Capture shipping address
 ↓
Optional account creation
 ↓
Create order
 ↓
Reserve/update inventory
 ↓
Clear cart
 ↓
Emit order-created event
 ↓
Queue confirmation email
 ↓
Return confirmation
```

All calculations happen server-side.

------------------------------------------------------------------------

# 48. ORDER + INVENTORY CONSISTENCY

If order creation changes inventory, use a safe consistency strategy.

Preferred:

-   MongoDB transaction where multiple writes must be atomic
-   Or carefully designed atomic inventory updates where appropriate

Never allow a successful order to leave inventory in an inconsistent
state.

Document the implementation strategy.

------------------------------------------------------------------------

# 49. APPOINTMENT BOOKING FLOW

Conceptual flow:

``` text
Customer selects vaccine/service
 ↓
Select date
 ↓
Fetch availability
 ↓
Select time
 ↓
Submit booking
 ↓
Backend validates availability
 ↓
Backend checks strict/open mode
 ↓
Backend atomically books
 ↓
Create appointment
 ↓
Create status history
 ↓
Emit event
 ↓
Queue confirmation email
```

The frontend must never be the authority for availability.

------------------------------------------------------------------------

# 50. CONFIGURATION

Use environment variables.

Example:

``` text
NODE_ENV
PORT
MONGODB_URI

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN

REDIS_URL

EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM

FILE_STORAGE_PROVIDER
FILE_STORAGE_BUCKET
FILE_STORAGE_REGION
FILE_STORAGE_ACCESS_KEY
FILE_STORAGE_SECRET_KEY
```

Validate environment configuration at application startup.

Never hard-code secrets.

------------------------------------------------------------------------

# 51. FOLDER STRUCTURE

Recommended:

``` text
src/
  main.ts
  app.module.ts

  config/

  common/
    decorators/
    guards/
    interceptors/
    filters/
    pipes/
    middleware/
    pagination/
    responses/
    errors/

  database/

  modules/
    auth/

    users/

    roles/

    permissions/

    products/

    categories/

    inventory/

    cart/

    coupons/

    orders/

    prescriptions/

    compounding/

    appointments/

    vaccines/

    minor-ailments/

    ask-pharmacist/

    files/

    notifications/

    email/

    reports/

    audit/
```

A typical module can contain:

``` text
module.ts
controller.ts
service.ts
schema.ts

dto/
interfaces/
enums/
guards/
mappers/
repositories/
```

Use these only where useful.

Do not create unnecessary layers just for ceremony.

------------------------------------------------------------------------

# 52. CONTROLLER/SERVICE/REPOSITORY RESPONSIBILITIES

Controllers:

-   HTTP transport
-   DTO binding
-   Authentication/authorization decorators
-   Response mapping

Application/domain services:

-   Business rules
-   State transitions
-   Calculations
-   Workflow orchestration

Repositories/data access:

-   MongoDB persistence
-   Queries
-   Aggregations
-   Index-aware data access

Infrastructure:

-   Email
-   Redis
-   File storage
-   External integrations

Controllers must remain thin.

------------------------------------------------------------------------

# 53. DTOs AND DATABASE SCHEMAS

Never expose raw Mongoose documents as API contracts.

Use:

``` text
Create DTO
Update DTO
Query DTO
Response DTO
```

Use response mapping.

Do not accidentally expose:

-   password hashes
-   internal notes
-   storage keys
-   internal permission metadata
-   private audit information

------------------------------------------------------------------------

# 54. SWAGGER / OPENAPI

Create complete Swagger/OpenAPI documentation.

Document:

-   Authentication
-   Request body
-   Query parameters
-   Responses
-   Errors
-   Authorization requirements
-   File uploads
-   Pagination
-   Enums

The frontend team should be able to consume the API without reading
backend source code.

------------------------------------------------------------------------

# 55. API VERSIONING

Use:

``` text
/api/v1
```

Design APIs so future breaking changes can be introduced as v2.

------------------------------------------------------------------------

# 56. LOGGING / OBSERVABILITY

Use structured logging.

Every request should have a request/correlation ID.

Useful log data:

``` text
requestId
method
path
status
duration
actorId where appropriate
error information
```

Never log:

-   Passwords
-   OTP codes
-   Access tokens
-   Refresh tokens
-   Full prescription contents
-   Unnecessary sensitive personal/health information

------------------------------------------------------------------------

# 57. HEALTH CHECK

Create:

``` text
GET /health
```

Check:

-   Application
-   MongoDB
-   Redis if configured

Return appropriate service health.

------------------------------------------------------------------------

# 58. CANADIAN HEALTHCARE / PRIVACY CONTEXT

MediSyn is a Canadian healthcare/pharmacy product.

The architecture must support:

-   Data minimization
-   Access control
-   Auditability
-   Secure document storage
-   Consent tracking where required
-   Secure authentication
-   Controlled access to sensitive patient information
-   Future retention/deletion policies

Do not claim that the application is automatically "PHIPA compliant" or
"AODA compliant".

Final legal, privacy, pharmacy, data residency, retention, and
compliance requirements must be confirmed by MediSyn's appropriate
legal/privacy/compliance stakeholders.

------------------------------------------------------------------------

# 59. ORIGINAL PROPOSAL FEATURES TO PRESERVE/PLAN FOR

The original proposal also identifies:

-   Clinic accounts
-   Pharmacy partner accounts
-   Approval workflows
-   Dynamic pharmacy settings
-   Dynamic website settings
-   FAQ management
-   Privacy Policy management
-   Terms management
-   Advanced partner functionality
-   Delivery tracking
-   Refill reminders
-   Analytics
-   API capabilities
-   Integrations
-   AI-assisted administrative tools subject to approval

Do not necessarily implement all of these now.

Keep architecture extensible.

Clearly classify each as:

``` text
CURRENT
DEFERRED
FUTURE
```

based on the current implementation scope.

------------------------------------------------------------------------

# 60. OPEN BUSINESS QUESTIONS

Do not silently invent answers for:

-   Exact patient registration fields
-   Exact prescription form fields
-   Prescription file limits
-   Prescription status definitions
-   Doctor-to-pharmacy prescription account requirements
-   Exact vaccine/service list
-   Appointment duration
-   Appointment cancellation rules
-   Rescheduling rules
-   Shipping rules by province
-   Tax rules
-   Launch payment methods
-   Refund rules
-   Coupon stacking rules
-   Exact Admin/Pharmacist permission assignments
-   Data retention rules
-   File retention rules
-   Data residency/storage requirements
-   Final legal/privacy/compliance requirements
-   Clinic/Pharmacy Partner portal scope

Where possible, make these configurable rather than hard-coded.

------------------------------------------------------------------------

# 61. TESTING

Write tests for critical business logic.

## Unit tests

At minimum:

-   Coupon calculation
-   Cart calculation
-   Order totals
-   Inventory adjustment
-   Appointment capacity
-   STRICT appointment booking
-   OPEN appointment booking
-   Permission checking
-   Multiple-role permission resolution
-   Status transitions

## Integration tests

At minimum:

-   Registration
-   Login
-   Product CRUD
-   Category CRUD
-   Guest checkout
-   Registered checkout
-   Order status update
-   Prescription request
-   Compounding request
-   Appointment booking
-   Permission enforcement
-   Inventory consistency

## E2E

Cover critical user/admin workflows.

------------------------------------------------------------------------

# 62. SEED DATA

Create seed scripts for:

Roles:

``` text
ADMIN
PHARMACIST
```

Core permissions.

Initial role-permission assignments.

Optional development seed data:

-   Categories
-   Products
-   Vaccine services

Do not seed fake patient healthcare information.

------------------------------------------------------------------------

# 63. IMPLEMENTATION PHASES

After architecture approval, implement in this approximate order.

## Phase 1 --- Foundation

-   Project bootstrap
-   Config
-   MongoDB
-   Common infrastructure
-   Authentication
-   Users
-   Roles
-   Permissions

## Phase 2 --- Ecommerce Catalogue

-   Categories
-   Products
-   Inventory
-   Coupons

## Phase 3 --- Commerce

-   Cart
-   Checkout
-   Guest checkout
-   Customer addresses
-   Orders

## Phase 4 --- Healthcare Requests

-   Prescription requests
-   Compounding requests
-   Ask Pharmacist
-   Minor Ailments

## Phase 5 --- Appointments

-   Vaccine services
-   Availability
-   STRICT/OPEN booking
-   Appointment management

## Phase 6 --- Async Operations

-   Redis
-   BullMQ
-   Email
-   Notifications
-   Status-change events

## Phase 7 --- Operations

-   Reports
-   Dashboard
-   Audit logs

## Phase 8 --- Hardening

-   Security review
-   Integration tests
-   E2E tests
-   OpenAPI cleanup
-   Performance optimization
-   Index optimization
-   Error handling review

------------------------------------------------------------------------

# 64. CODING RULES

Always:

-   Use TypeScript
-   Use strict typing
-   Keep controllers thin
-   Validate all inputs
-   Use DTOs
-   Use enums for finite states
-   Centralize permission checks
-   Protect object-level access
-   Use repositories/data-access separation where useful
-   Use transactions where necessary
-   Use indexes
-   Use pagination
-   Use structured logging
-   Write tests
-   Document business rules
-   Keep healthcare data protected

Never:

-   Create JavaScript application source files
-   Use `any` unnecessarily
-   Put business logic in controllers
-   Trust frontend totals
-   Trust frontend permissions
-   Expose raw Mongoose documents
-   Store plaintext passwords
-   Expose prescription files publicly
-   Expose internal notes to customers
-   Hard-code coupon business rules
-   Let frontend enforce appointment capacity
-   Use role checks as the only authorization mechanism
-   Store unnecessary sensitive data
-   Introduce microservices without justification
-   Add online payment integration in this phase

------------------------------------------------------------------------

# 65. FINAL QUALITY BAR

The backend should look like it was designed by a senior
healthcare/ecommerce engineering team.

Optimize for:

-   Correct architecture
-   Correct business logic
-   Correct security
-   Correct data modeling
-   Correct API contracts
-   Correct workflows
-   Maintainability
-   Testability
-   Scalability
-   Strong typing
-   Documentation

Do not optimize for number of files or amount of code.

------------------------------------------------------------------------

# 66. FIRST RESPONSE REQUIRED FROM CLAUDE

Before implementing code, provide a detailed architecture proposal.

Do NOT immediately generate hundreds of files.

The first response must include:

## A. Recommended Stack

Explain each technology and why it is being used.

## B. Architecture Diagram

Show the application architecture in text.

## C. Folder Structure

Show the proposed complete folder structure.

## D. Module List

Explain each backend module.

## E. MongoDB Collection/Schema Plan

Explain every collection and important fields.

## F. Relationships/Data Flow

Explain how domains interact.

## G. Permission Model

Provide the permission catalog and how it is enforced.

## H. Role Model

Explain multiple roles and effective permissions.

## I. Authentication

Explain access/refresh tokens, verification, password reset, session
revocation.

## J. Ecommerce

Explain products, categories, inventory, cart, coupons, checkout and
guest checkout.

## K. Orders

Explain order lifecycle, snapshots, inventory consistency and status
history.

## L. Prescription

Explain all prescription workflows.

## M. Compounding

Explain the dedicated compounding workflow.

## N. Appointments

Explain vaccine services, availability, STRICT/OPEN modes and
concurrency strategy.

## O. Email/Queue

Explain notification events, BullMQ and provider abstraction.

## P. File Storage

Explain secure private storage and authorization.

## Q. Reporting

Explain aggregation/report APIs.

## R. API Endpoint Map

Provide the complete API list grouped by:

-   Public
-   Customer
-   Admin
-   Pharmacist

## S. Status Enums/State Machines

Show allowed transitions.

## T. Index Strategy

Explain important MongoDB indexes and query patterns.

## U. Security Strategy

Explain authentication, authorization, rate limiting, validation, file
security and audit logging.

## V. Testing Strategy

Explain unit, integration and E2E coverage.

## W. Environment Configuration

List all required environment variables.

## X. Open Questions

Clearly identify unresolved business decisions.

## Y. Current vs Deferred vs Future

Clearly classify functionality.

## Z. Implementation Phases

Provide the recommended implementation sequence.

------------------------------------------------------------------------

# 67. MANDATORY REQUIREMENT LABELS

Throughout your architecture proposal, use these labels:

### CONFIRMED REQUIREMENT

Explicitly confirmed by MediSyn/client discussion or the source
proposal.

### PROPOSED TECHNICAL DECISION

A technical recommendation made by you to implement the requirements
safely/cleanly.

### OPEN BUSINESS QUESTION

Something the client has not finalized.

### DEFERRED

Required/valuable but intentionally not part of the current
implementation phase.

### FUTURE

Potential later capability.

Do not present a technical assumption as a confirmed business
requirement.

------------------------------------------------------------------------

# 68. FINAL INSTRUCTION

First produce the architecture proposal only.

Do not start implementation until the architecture has been presented
and reviewed.

When implementation begins:

1.  Keep all application source files in `.ts`.
2.  Follow the approved architecture.
3.  Do not silently change business rules.
4.  Ask only when a decision genuinely cannot be represented safely as a
    configurable/open question.
5.  Prefer secure, maintainable and testable implementations over
    shortcuts.

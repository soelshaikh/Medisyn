# MediSyn — Project Worklog (Overall History)

This file is the cumulative project history. Each session is also recorded in `worklog/YYYY-MM-DD.md`.

---

## Session: 2026-10-02 (E) — Admin Detail Pages Two-Column Redesign + Prescription Service Types

**What was done:**
- `admin/src/app/(dashboard)/prescriptions/[id]/page.tsx` — two-column layout; replaced 2 DetailCards with compact icon+value side-by-side cards (Hash/FileText/Activity/RefreshCw/Calendar/Clock + User/Shield/Phone); AdminThreadPanel sticky right column
- `admin/src/app/(dashboard)/compounding/[id]/page.tsx` — same pattern; compact cards (FileText/Tag/Zap/Hash/Calendar + User/Shield); AdminThreadPanel sticky right
- `admin/src/app/(dashboard)/ask-pharmacist/[id]/page.tsx` — two-column layout (no DetailCard was present); question + response + history on left; AdminThreadPanel sticky right
- `admin/src/app/(dashboard)/appointments/bookings/[id]/page.tsx` — two-column layout; replaced 2 DetailCards with compact side-by-side cards (User/Mail/Phone + Stethoscope/Clock/Calendar/Layers/Users); AdminThreadPanel sticky right; removed ArrowLeft import dependency (use router.back with ← text)
- `frontend/src/components/patient/PrescriptionForm.tsx` — full rewrite with 4 service type selector cards at top (New Prescription, New + Delivery, Refill, Transfer); fields change conditionally per type; Transfer shows previous pharmacy fields + transferAll toggle + rxNumbers tag input; Delivery shows delivery address; Refill hides prescriber; form is now controlled state (not FormData)

**Still pending:** None from this session

---

## Session: 2026-10-02 (D) — Order Detail Redesign + PatientThreadPanel Reusable Component

**What was done:**
- `admin/src/app/(dashboard)/orders/[id]/page.tsx` — full layout redesign: two-column flex (left: order info, right: sticky thread panel); Customer + Shipping replaced with compact icon+value cards side-by-side (User/Mail/Phone/CreditCard/MapPin/Building2/Hash icons); items table padding tightened; removed `max-w-4xl`; `AdminThreadPanel` now always visible on the right column with `defaultOpen` prop
- `frontend/src/components/patient/PatientThreadPanel.tsx` *(new)* — reusable patient messaging component; accepts `entityType`, `entityId`, `title`, `className`; encapsulates query (30s poll), send mutation, auto-scroll, chat bubble UI
- `frontend/src/app/patient/orders/[id]/page.tsx` — replaced inline "Messages from Pharmacy" block with `<PatientThreadPanel entityType="order" entityId={id} />`; removed now-unused imports (useRef, useEffect, MessageCircle, Send, patientThreadsApi)
- `frontend/src/app/patient/prescriptions/page.tsx` — added per-prescription "Messages" toggle button; clicking expands `<PatientThreadPanel entityType="prescription" entityId={rx._id} />` inline below that prescription row; only one open at a time (single state)
- `frontend/src/app/patient/ask-a-pharmacist/page.tsx` — same expandable Messages toggle per request card; `<PatientThreadPanel entityType="ask_pharmacist" entityId={ask._id} title="Chat with Pharmacist" />`
- `frontend/src/app/patient/minor-ailments/page.tsx` — same pattern; `<PatientThreadPanel entityType="minor_ailment" entityId={item._id} title="Messages about this request" />`
- `frontend/src/app/patient/appointments/page.tsx` — same pattern; `<PatientThreadPanel entityType="appointment" entityId={appt._id} title="Messages about this appointment" />`

**PatientThreadPanel coverage (all entity types with patient-facing lists):**
| Page | Entity type | Done |
|---|---|---|
| `/patient/orders/[id]` | `order` | ✅ |
| `/patient/prescriptions` | `prescription` | ✅ |
| `/patient/ask-a-pharmacist` | `ask_pharmacist` | ✅ |
| `/patient/minor-ailments` | `minor_ailment` | ✅ |
| `/patient/appointments` | `appointment` | ✅ |

**Still pending:**
- Patient mark-read for entity thread messages (deferred)
- Thread real-time (WebSocket/SSE) — deferred to async infrastructure phase

---

## Session: 2026-10-02 (C) — Admin UX: System Role Edit + Login Remember Me + Users Split

**What was done:**
- `admin/src/app/(dashboard)/roles/[id]/page.tsx` — removed system-role read-only guards; all roles now fully editable (Save button, checkboxes, group toggles all enabled regardless of `isSystem` flag)
- `admin/src/app/(auth)/login/page.tsx` — full rewrite: eye/EyeOff password toggle; Remember Me checkbox; saved accounts stored in `localStorage["admin_saved_accounts"]` (max 5); suggestions dropdown on email focus filtered by typed input; ArrowDown/ArrowUp/Enter/Escape keyboard nav with `highlightIdx`; mouse hover syncs highlight; ✕ per account to remove; auto-fills credentials on mount if remembered
- `admin/src/components/common/AdminSidebar.tsx` — split "Users" into "Patients" (`/users/patients`) + "Staff Members" (`/users/staff`) under Access Control group
- `admin/src/app/(dashboard)/users/page.tsx` — redirect to `/users/patients`
- `admin/src/app/(dashboard)/users/patients/page.tsx` *(new)* — patients list (hasRoles=false): Name/Email, UHID, Status, Joined
- `admin/src/app/(dashboard)/users/staff/page.tsx` *(new)* — staff list (hasRoles=true): Name/Email, Role badges (colour-cycling), Status, Joined
- `backend/src/modules/users/users.routes.ts` — added `hasRoles` query filter; list response includes populated `roles[]` array

**Still pending:**
- Unread message count badge on AdminThreadPanel tab not persisting across navigation (local state only — no server read tracking for admin)

---

## Session: 2026-10-02 (B) — Users Split: Patients + Staff Members Pages

**What was done:**
- `backend/src/modules/users/users.routes.ts` — added `hasRoles` filter: `hasRoles=true` → users with RBAC roles, `hasRoles=false` → users without
- `admin/src/components/common/AdminSidebar.tsx` — replaced "Users" nav item with "Patients" (`/users/patients`) + "Staff Members" (`/users/staff`) under Access Control
- `admin/src/app/(dashboard)/users/page.tsx` — now redirects to `/users/patients`
- `admin/src/app/(dashboard)/users/patients/page.tsx` *(new)* — patient-focused list: Name/Email, UHID, Status, Joined; filtered `hasRoles=false`
- `admin/src/app/(dashboard)/users/staff/page.tsx` *(new)* — staff-focused list: Name/Email, Roles (coloured badges), Status, Joined; filtered `hasRoles=true`

**Still pending:** None

---

## Session: 2026-10-02 — Order List Customer Fix + Patient Order Messaging

**What was done:**
- `backend/src/modules/orders/orders.service.ts` — `listAdminOrders` now populates `userId` (email, fullName, phone); fixes CUSTOMER column showing "—" for registered users
- `admin/src/app/(dashboard)/orders/page.tsx` — Customer column resolves name/email from `guestInfo` OR populated `userId`; ORDER sub-label (email) same fix
- `backend/src/modules/threads/thread.routes.ts` — Added `POST /threads/:entityType/:entityId/patient/messages` so patients can reply to entity threads
- `frontend/src/api/threads.api.ts` — Added `getEntityMessages` + `postEntityMessage` to `patientThreadsApi`
- `frontend/src/app/patient/orders/[id]/page.tsx` — Added "Messages from Pharmacy" section: chat bubble UI, 30s auto-poll, Ctrl+Enter send, empty state

**Still pending:**
- Patient mark-read for entity thread messages (deferred — not critical)
- Thread real-time (WebSocket/SSE) — deferred to async infrastructure phase

---

## Session: 2026-09-29 (C) — UI Polish + UHID System + Invoice Template Fix + DB Wipe

**What was done:**
- `type="number"` → `type="text"` with `blockNonNumeric` keyboard guard across invoice form + orders page
- Invoice new-form layout: two-column (sticky left: customer+billing / right: items+tax+totals), input padding tightened, whitespace eliminated
- UHID system: `backend/src/lib/counter.ts` (`nextUHID()` → `MED-000001`), `uhid` sparse-unique field on User schema, UHID assigned on every new registration in `auth.service.ts`
- `GET /users/search?q=...` endpoint — searches fullName, email, phone, uhid; returns top 10; requires `users.read`
- Admin `users.api.ts` — `search()` method + `UserSearchResult` type
- Invoice form customer section: separate search box removed; each field (Name, Email, Phone) is now its own autocomplete (`AcField`) with 280ms debounce + shared dropdown + UHID badge on selection
- `/invoices/reports` rewritten as card-grid hub (4 report cards); existing content moved to `/invoices/reports/summary`
- `invoice.template.ts` — fixed all 8 TypeScript compile errors: `inv.items` → `inv.lineItems`, `"void"` → `"cancelled"/"system_cancelled"`, `inv.voidReason` → `inv.cancelReason`, `fmtDate` now accepts `undefined`, `inv.customerPhone` → `addr.phone`; introduced `RenderableInvoice` type
- `invoices.routes.ts` — replaced all `as never` casts with `as RenderableInvoice`
- `backend/src/scripts/wipe-dev-db.ts` *(new)* — full DB wipe with dev-only guard + `--confirm` flag + collection count preview
- Ran wipe (381 docs / 40 collections) + seed — clean database confirmed

**Still pending:**
- `/invoices/reports/revenue`, `/tax`, `/adhoc` sub-pages not built
- UHID not yet displayed on admin user detail or patient post-signup
- Orders detail `ORDER_STATUSES` permission-filter (carried from session B)

**See:** `worklog/2026-09-29c.md` for full detail

---

## Session: 2026-09-29 (B) — Transition Permission & Email Trigger Bug Fixes

**What was done:**
- Fixed P0 Bug: `cancelMyOrder` in `orders.service.ts` captured `prevStatus` before mutation — side effects were incorrectly passing `"cancelled"` as both `fromStatus` and `toStatus`
- Fixed P1 Bug: `checkout` now fires `EmailTriggerService.fire("orders", null, "pending", ...)` instead of `"confirmed"` — seed updated to match (`null → "pending"` row)
- Fixed P1 Bug: Rewrote `EmailTriggerService.resolve()` — replaced non-deterministic `$or [fromStatus, null, "*"]` with exact-then-wildcard two-query approach
- Fixed P1 Bug: `ask-pharmacist.service.ts` — replaced hardcoded `EmailService.sendAskPharmacistRespondedEmail` with `EmailTriggerService.fire`
- Fixed P1 Bug: `appointments.service.ts` — replaced hardcoded `EmailService.sendAppointmentStatusChangedEmail` with `EmailTriggerService.fire`; added `oldStatus` param to `_appointmentStatusSideEffects`
- Fixed P1 UI: `admin/src/app/(dashboard)/prescriptions/[id]/page.tsx` — replaced broken `["active", "expired", "cancelled"]` with `RX_TRANSITIONS` map; modal now shows only valid next states filtered by actor's permissions via `useAdminAuthStore`
- Fixed P3 UI: `admin/src/app/(dashboard)/compounding/[id]/page.tsx` — same pattern; `COMPOUNDING_TRANSITIONS` map with permission filtering
- Created `backend/src/database/migrate-prescription-status.ts` — one-time migration script: `active → received`, `expired → cancelled`

**Still pending:**
- Migration script must be run before any production deployment (not yet executed)
- P2 Bug 5 double-lock: route guard vs. transition permission mismatch (mitigated by seed, proper fix deferred)
- P2 Bug 7: `actorPermissions` optional in service signatures — system callers bypass guard (deferred)
- Available-transitions API endpoint (deferred)
- Orders detail UI: `ORDER_STATUSES` still not permission-filtered (same pattern as prescriptions/compounding fix)

---

## Session: 2026-09-29 — Invoice Refund Lifecycle + Data Reset Script + Billing Report

**What was done:**
- Full refund lifecycle implemented in `payment.service.ts`: pending → completed/failed/cancelled, with `processRefund()` applying financial changes (allocation reversal, invoice.amountPaid decrement, paymentStatus recalculation)
- `financiallySettled` flag prevents double-accounting on auto-refunds created during invoice cancellation
- `statusHistory[]` on every `PaymentTransaction` — full audit trail of who changed what and when
- Routes added: `GET /admin/payments/pending-refunds`, `PATCH .../process-refund`, `.../fail-refund`, `.../cancel-refund`
- `invoiceSummary()` now returns embedded `refunds: RefundReport` — no separate endpoint needed
- `InvoiceSummary` type updated in admin types; `InvoiceSummary.refunds` added
- Missing `paymentsApi` methods added to `admin/src/api/invoices.api.ts`: `listPendingRefunds`, `processRefund`, `failRefund`, `cancelRefund`
- Billing summary page (`/invoices/reports/summary`) expanded into 4 sections: Billing Summary, Payment Status, Refund Report, Refunds by Method — color-coded KPI cards
- Reports index card renamed to "Billing & Refund Report"
- Data reset script created: `backend/src/scripts/reset-dev-data.ts` — deletes invoice/order/user data with `--confirm` guard and production refusal

**Still pending:**
- PDF template reads `invoice.items` (not `lineItems`)
- Admin invoice detail page uses old model
- Invoice number at finalization (not draft creation)
- `systemCancelInvoice` missing auto-refund call
- `invoices.void` → `invoices.cancel` permission rename

---

## Session: 2026-09-19 — Frontend UI Polish + Broken Content Fixes

**What was done:**
- Implemented Aceternity UI components on the public-facing frontend: Spotlight, FlipWords, CardHoverEffect, TracingBeam, BentoGrid
- Implemented VengenceUI-style components: LogoSlider (Canadian insurance logos), ShimmerButton, GlassDock (mobile dock), SpotlightNav (Header)
- Complete audit of all frontend pages and components for broken content
- Fixed all broken files identified in audit

**Broken content fixed:**
- `app/login/page.tsx` — removed `getCurrentUser()` + Drizzle session import; now a simple sync server component
- `app/verify-email/page.tsx` — converted from Server Action to client component using `authApi.verifyEmail()`
- `app/layout.tsx` — added `<Providers>` wrapper (QueryClientProvider was missing — TanStack Query hooks would fail without it)
- `api/auth.api.ts` — fixed wrong endpoint paths: `registerClinic` and `registerPartner` were calling non-existent `/auth/register/clinic` and `/auth/register/pharmacy-partner` — corrected to `/auth/register`
- `components/home/WhyChooseUs.tsx` — removed broken `<Image src="/images/lab-compounding.jpg">`, replaced with brand-gradient placeholder with FlaskConical icon
- `app/about/page.tsx` — removed broken `<Image src="/images/about-team.jpg">`, replaced with brand-gradient placeholder with Users icon
- `components/ContactForm.tsx` — removed broken `/api/contact` fetch call; form now composes a `mailto:` link with pre-filled subject + body, opening user's email client
- `components/NewsletterForm.tsx` — replaced broken `/api/newsletter` fetch with a stub success state (backend newsletter endpoint TBD)
- `components/Footer.tsx` — changed `href="https://facebook.com"` and `href="https://instagram.com"` to `href="#"` (placeholder until real social accounts exist)

**New files created:**
- `app/get-started/page.tsx` — new landing page with 3 paths: New Prescription (→/register), Refill (→/login), Transfer (→/register)
- `app/verify-email/VerifyEmailContent.tsx` — standalone client component for email verification (unused, verify-email/page.tsx handles it inline)

**Pre-existing errors (NOT introduced this session):**
- `src/app/admin/*`, `src/app/clinic/*`, `src/app/patient/*` — old portal pages importing drizzle-orm/@/db/@/actions (to be deleted/migrated in a future cleanup pass)
- `src/app/api/contact/route.ts`, `api/newsletter/route.ts`, `api/health/route.ts` — old Next.js API routes importing @/db (to be cleaned up)
- `src/components/forms/ActionMessage.tsx` — old Server Action helper

**TypeScript:** 0 errors in all new/modified files. Only pre-existing errors in legacy admin/patient/clinic portal pages that predate this session.

---

## Session: 2026-09-17 — Project Kickoff, Stack Decision & Scope Confirmation

**What was done:**
- Reviewed both docs files:
  - `docs/MediSyn_Backend_Master_Prompt_Claude.md` (backend scope, architecture, RBAC, all modules)
  - `docs/MediSyn_Claude_Design_Requirements_Handoff.md` (UX/design requirements, visual direction)
- Audited the complete existing codebase (stack, schema, pages, actions, components)
- Identified all gaps between current implementation and documented requirements
- Produced a comprehensive 8-phase implementation plan
- Created CLAUDE.md, worklog.md, and worklog/2026-09-17.md for persistent project memory

**Key findings:**
- Codebase uses Next.js + PostgreSQL, NOT the Node.js + MongoDB the user wants
- Current auth is flat role strings — full RBAC system needs to be built
- Admin panel exists but has no roles/permissions management
- Compounding, ecommerce, slot-based appointments, file storage, email queue, reports are all missing
- Files stored as base64 in DB (critical issue to fix)

**Decisions confirmed this session:**
- CONFIRMED: Node.js + MongoDB Atlas backend (NestJS explicitly rejected)
- CONFIRMED: Frontend stays Next.js, consumes REST API
- CONFIRMED: Ecommerce is MVP1
- CONFIRMED: Admin access is purely permissions-based (role bundles TBD later)

**Open questions going into next session:**
- Which Node.js framework? (Express.js recommended)
- Monorepo vs separate repo for backend

**Completed:**
- Full Phase 1 built — see worklog/2026-09-17.md for detail
- Pushed to https://github.com/soelshaikh/Medisyn.git

**Next:** Phase 7 — Redis + BullMQ async infrastructure, email queue, notifications

---

## Session: 2026-09-18 — Phase 2 (Admin Panel) + Phase 6 (Appointments) Complete

**What was done:**
- Completed all Phase 2 admin panel pages: dashboard, roles, orders, products, clinics, partners, prescriptions, compounding, ask-pharmacist, audit log, settings (FAQs)
- Built reusable `DetailCard`, `StatusHistory`, `Pagination` components
- Fixed `apiClient` export issue (named → default export)
- Built Phase 6 backend: `VaccineService`, `AppointmentSlot`, `AppointmentBooking` schemas + services + routes
- Concurrency-safe STRICT slot booking via MongoDB atomic `findOneAndUpdate` with `$expr: { $lt: ["$bookedCount", "$capacity"] }`
- Seeded 6 real vaccine services
- Built all Phase 6 admin UI pages: bookings list, booking detail, slots list, slot detail, vaccine services catalog

**Decisions confirmed:**
- STRICT capacity: hard cap, blocks patient booking at API level (409), shown as red in patient UI
- OPEN capacity: soft cap, always allows patient requests
- Cancel and rebook (no reschedule complexity at this stage)
- Admin-created slots only
- No waitlist

**Admin pages completed (Phase 6):**
- `/appointments/bookings` — list with pending count badge, search, status filter
- `/appointments/bookings/[id]` — approve/reject quick actions, slot capacity, eligibility, cancellation info, status history
- `/appointments/slots` — list with capacity bar, STRICT/OPEN badge, create slot modal
- `/appointments/slots/[id]` — slot detail with capacity progress bar, bookings list, edit + cancel actions
- `/appointments/services` — vaccine catalog with create/edit/toggle active modals

**TypeScript:** 0 errors across backend and admin.

---

## Session: 2026-09-18 — Phase 2: Admin Panel Full Management UI

**What was done:**
- Completed all missing admin panel pages to finish Phase 2
- Zero TypeScript errors across the entire admin panel

**Files created:**
- `admin/src/api/prescriptions.api.ts`, `compounding.api.ts`, `ask-pharmacist.api.ts`
- `admin/src/components/ui/Pagination.tsx` — shared pagination component
- `admin/src/components/common/DetailCard.tsx` — shared label/value grid card
- `admin/src/components/common/StatusHistory.tsx` — shared status timeline
- Dashboard page with live KPIs, bar charts, pending approval alerts
- Roles page + permissions editor (group-level and per-permission toggles)
- Orders list + detail (line items, totals, status, notes)
- Products list + detail (edit, inventory adjustment)
- Clinics + Partners list and detail pages with approval workflow
- Prescriptions + Compounding + Ask Pharmacist list and detail pages
- Audit log (auto-refreshes every 30s)
- Settings page with full FAQs management (create/edit/delete/publish)

**Bugs fixed:**
- Added `export default apiClient` to fix TS2613 across all API files
- `AdminOrder.statusHistory` now uses shared `StatusEntry` type

**Next:** Phase 6 — Appointments (vaccine catalog, slots, STRICT/OPEN booking)

---

## Session: 2026-09-18 — Phase 7 (Async Infrastructure) Complete

**What was done:**
- Built complete Phase 7 without Redis — fire-and-forget pattern throughout
- No queue infrastructure needed: `void asyncFn()` makes all side effects non-blocking

**Backend — notifications module:**
- `backend/src/modules/notifications/notifications.schema.ts` — MongoDB schema with compound index `{ userId, read, createdAt }`
- `backend/src/modules/notifications/notifications.service.ts` — `createNotification`, `notifyAdmins` (fan-out to all admin users), `listNotifications`, `getUnreadCount`, `markOneRead`, `markAllRead`
- `backend/src/modules/notifications/notifications.routes.ts` — `GET /`, `GET /unread-count`, `PATCH /:id/read`, `POST /read-all`
- Registered at `/api/v1/notifications` in `app.ts`

**Backend — email templates + side effects:**
- Added 4 new email templates: `orderStatusChanged`, `compoundingStatusChanged`, `appointmentStatusChanged`, `askPharmacistResponded` — all use updated sky-600 primary (#0284C7)
- Added corresponding `EmailService.send*` methods
- `orders.service.ts` — `_orderStatusSideEffects`: fire-and-forget email + patient notification on status change
- `compounding.service.ts` — `_compoundingStatusSideEffects` + `notifyAdmins` on create
- `appointments.service.ts` — `_appointmentStatusSideEffects` + `notifyAdmins` on create
- `ask-pharmacist.service.ts` — `_askPharmacistRespondedSideEffects` + `notifyAdmins` on create

**Admin UI:**
- `admin/src/api/notifications.api.ts` — `notificationsApi` with `list`, `unreadCount`, `markRead`, `markAllRead`
- `admin/src/components/common/AdminTopbar.tsx` — notification bell: Radix Popover, unread badge, polls every 30s, lazy-loads list only when open, mark-one-read on click, mark-all button

**UI improvements (accumulated):**
- Design token primary lightened to sky-600 palette (`#0284C7`)
- `EmptyState.tsx` rewritten with floating SVG illustration + `animate-float` animation
- `ConfirmDialog.tsx` added — Radix AlertDialog with destructive variant
- Sonner `<Toaster>` in providers — toast.success/error on all mutations
- `/appointments/services` rewritten: dnd-kit drag-to-reorder grid, confirm dialogs for toggle, toasts, empty state
- DatePicker fully fixed for react-day-picker v9 API

**TypeScript:** 0 errors in both backend and admin after all Phase 7 changes.

**Next:** Phase 8 — Reports & Analytics dashboard

---

## Session: 2026-09-18 — Phase 8 (Reports & Analytics) Complete

**What was done:**

**Backend — Reports module:**
- `backend/src/modules/reports/reports.routes.ts` — 5 aggregation endpoints:
  - `GET /api/v1/admin/reports/sales` — revenue, order count, AOV, discounts, daily chart
  - `GET /api/v1/admin/reports/orders` — orders by status, daily chart, guest vs registered split
  - `GET /api/v1/admin/reports/products` — top 10 by units sold + top 10 by revenue
  - `GET /api/v1/admin/reports/customers` — new patients by day, all-time total, active buyers count
  - `GET /api/v1/admin/reports/coupons` — orders with/without coupon, top coupons, all-time usage table
- All endpoints accept `preset` (today/yesterday/7d/30d/month) or custom `from`+`to`
- All require `authenticate` + `requirePermission("reports.read")`
- Registered at `/api/v1/admin/reports` in `app.ts`

**Backend — Dashboard enhanced:**
- `dashboard.routes.ts` now includes `healthcare` block:
  - `pendingCompounding` — submitted + reviewing
  - `openAskPharmacist` — open status
  - `pendingAppointments` — pending + confirmed
  - `activePrescriptions` — active status

**Admin UI:**
- `admin/src/types/admin.ts` — `DashboardMetrics.healthcare` field added
- `admin/src/api/reports.api.ts` — full typed API for all 5 report endpoints
- `admin/src/app/(dashboard)/reports/page.tsx` — full reports page:
  - Preset date range selector (Today/Yesterday/7d/30d/Month)
  - 5 tabs: Sales, Orders, Products, Customers, Coupons
  - CSS bar charts (no new library — consistent with dashboard)
  - KPI cards, horizontal bar charts, data tables
- `dashboard/page.tsx` — new healthcare KPI row (4 cards linking to relevant admin pages)

**TypeScript:** 0 errors in both backend and admin.

**Next:** Phase 9 — File Storage (S3/R2 abstraction, migrate file uploads, signed URLs)

---

## Session: 2026-09-18 — Phase 9 (File Storage) Complete

**What was done:**

**Backend — FileStorageService abstraction:**
- Installed `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- `backend/src/modules/files/file-storage.service.ts` — `IFileStorageService` interface + `LocalFileStorage` (dev) + `S3FileStorage` (prod)
  - Factory exports `storageService` singleton based on `FILE_STORAGE_PROVIDER` env var
  - S3 implementation supports AWS S3, Cloudflare R2, MinIO, Backblaze B2 (any S3-compatible)
  - Private paths (`private/...`) → presigned GET URLs (1-hour default)
  - Public paths (`products/...`) → direct CDN/public URL

**Backend — files.routes.ts:**
- `POST /api/v1/files/upload?type=product-image|document` — multer memoryStorage → storageService.upload → returns `{ key, url }`
- `GET /api/v1/files/signed-url?key=...` — returns 1-hour presigned URL for private documents; passes through if key is already an http URL
- Both require `authenticate`

**Backend — product image migration:**
- `products.routes.ts` — switched from `diskStorage` to `memoryStorage`
- `products.controller.ts` — `addImage` now calls `storageService.upload()` instead of relying on multer saving to disk
- `products.service.ts` — `removeProductImage` now calls `storageService.delete()` instead of `fs.unlinkSync`

**Backend — config:**
- `config/index.ts` — added `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` (all optional)
- `.env.example` — full S3 configuration section with Cloudflare R2 and AWS S3 examples

**Admin UI:**
- `admin/src/api/files.api.ts` — `filesApi.getSignedUrl(key)` + `isStorageKey()` helper
- `admin/src/components/common/SecureDocumentLink.tsx` — smart document link: direct href for http URLs, calls signed-url endpoint for storage keys, shows loading spinner
- `ask-pharmacist/[id]/page.tsx` — uses `SecureDocumentLink` instead of raw `<a href>`
- `compounding/[id]/page.tsx` — added "Attached Document" section using `SecureDocumentLink`

**To switch to S3 in production:** set `FILE_STORAGE_PROVIDER=s3` and fill in S3 credentials in `.env`.

**TypeScript:** 0 errors in both backend and admin.

**Next:** Phase 10 — Hardening (rate limiting, security, OpenAPI cleanup, performance)

---

## Session: 2026-09-18 — Phase 10 (Hardening) Complete

**What was done:**

**Security:**
- `express-mongo-sanitize` applied globally — strips `$` and `.` from body/query/params (NoSQL injection prevention)
- Global API rate limiter: 200 req / 15 min per IP on all `/api/v1/*` routes
- Healthcare submission limiter: 20 submissions / hour (compounding, ask-pharmacist)
- Ecommerce mutation limiter: 30 req / min on `/orders/checkout`
- File upload limiter: 10 uploads / hour
- JSON body limit tightened: `10mb` → `1mb` (file uploads go through multer, not JSON body)
- `compression()` middleware for gzip response compression
- Request logging masks Authorization header and Cookie content

**Graceful shutdown (`index.ts`):**
- SIGTERM/SIGINT handlers — closes HTTP server, then closes MongoDB connection
- 15-second force-exit timeout if graceful shutdown hangs
- `unhandledRejection` + `uncaughtException` handlers with proper logging

**OpenAPI/Swagger docs:**
- `swagger-ui-express` serving spec at `GET /api/docs`
- `backend/src/docs/openapi.ts` — OpenAPI 3.0 spec covering all route groups: Auth, Users, Products, Cart, Orders, Compounding, Ask Pharmacist, Appointments, Files, Notifications, Reports, Dashboard, FAQs, Audit
- Bearer auth (JWT) configured in Swagger UI
- All key routes documented with request parameters and response descriptions

**TypeScript:** 0 errors.

**All 10 backend phases complete. Frontend migration is the only remaining work.**

---

## Session: 2026-09-27 — Invoice Module + Commerce Platform Plan + UI Component System

**What was done:**
- Built complete invoice module: backend (schema, counter, numbering, service, HTML template, Playwright PDF, routes) + admin UI (list, detail, new adhoc, reports) + patient frontend (list, detail, order link)
- Invoice format: `MP-{E|A}-{YY}-{YY}-{00001}` (Canadian FY April–March, atomic counter)
- All amounts snapshotted at issuance; `createFromOrder` idempotent; guest token for unauthenticated PDF access
- Created `docs/MediSyn_Commerce_Platform_Plan.md` — multi-tenant subscription API product design
- Built three new reusable UI components: `DateRangePicker`, `FilterPanel` + `FilterField`, `DataGrid`
- Rewrote inventory movements page as first example of new component pattern

**See:** `worklog/2026-09-27.md` for full detail

---

## Session: 2026-09-28 (2) — Permissions Cleanup + Enterprise Thread System

**What was done:**
- Fixed admin invoice list (`ListResponse` bug — `data?.data` was always `[]` at runtime)
- Renamed admin sidebar "Invoices" group → "Billing"
- Added 6 new granular permissions: `inventory.batches.recall`, `inventory.movements.read`, `invoices.reports`, `threads.read`, `threads.reply_patient`, `threads.add_note`
- Updated inventory + invoice routes to enforce new permissions
- Built full enterprise thread system: `Thread` + `ThreadMessage` MongoDB collections (separate, not embedded), cursor pagination, quoted replies (parentMessageId), soft deletes, read tracking, 15-min edit window
- Built `AdminThreadPanel` component: collapsible, two tabs, date dividers, timestamps, hover reply/edit/delete, inline edit form, Ctrl+Enter, load earlier
- Added `AdminThreadPanel` to 7 admin detail pages (orders, prescriptions, ask-pharmacist, compounding, minor-ailments, appointments, patient users)
- Built patient `/messages` page: chat UI with aligned bubbles, date dividers, reply-to, 60s polling
- Added "Messages" to patient portal nav

**Remaining for next session:**
1. Fix `ListResponse` bug across all other admin list pages (orders, prescriptions, etc.)
2. Vaccine detail calendar view (confirmed, never implemented)
3. Thread permission guard in AdminThreadPanel
4. Patient entity thread read view (from patient portal)
5. Admin Messages inbox view
6. Re-run `npm run seed` to register new permissions in DB

**See:** `worklog/2026-09-28.md` (Session 2) for full detail

---

## Session: 2026-09-28 — UI Component Rollout + Invoice PDF Fixes

**What was done:**
- Rewrote near-expiry, invoices list, and invoices reports pages using new FilterPanel + DateRangePicker + DataGrid pattern — removed all native `<select>`, pill buttons, and raw `<input type="date">` elements
- Fixed invoice PDF 401: replaced `pdfUrl()` (bare URL, no auth header) with `downloadPdf()` (axios blob with Bearer token) across 4 files
- Fixed invoice PDF 500: `playwright-core` has no bundled browser — switched to full `playwright` package; requires `npx playwright install chromium` one-time setup
- Diagnosed invoice sidebar not showing: `invoices.read` permission not yet in DB — fixed by re-running `npm run seed`

**See:** `worklog/2026-09-28.md` for full detail

---

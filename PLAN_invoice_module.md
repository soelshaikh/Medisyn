# Invoice Module — Implementation Plan
**Status:** PENDING — not yet started  
**Created:** 2026-09-27  
**Owner:** Soel Shaikh

---

## 0. Prerequisites — Codebase Inspection Checklist

Before Phase 1 coding begins, read and validate each file below. Tick off each item.

| # | File / Area | What to confirm |
|---|---|---|
| 1 | `backend/src/modules/orders/orders.schema.ts` | Exact order fields, status enum, tax structure, amount storage |
| 2 | `backend/src/modules/orders/orders.service.ts` | Where status transitions happen, idempotency safeguards |
| 3 | `backend/src/modules/orders/orders.routes.ts` | Route naming conventions, auth middleware usage |
| 4 | `backend/src/common/middleware/auth.middleware.ts` | How `requireAuth`, `requireAdmin`, guest access work |
| 5 | `backend/src/common/types/express.d.ts` | Extended Request type (req.user shape) |
| 6 | `backend/src/app.ts` | Module registration, error handler, global middleware |
| 7 | `backend/package.json` | Node.js version, existing deps, scripts |
| 8 | `backend/.env.example` | Timezone config, existing env var patterns |
| 9 | `backend/src/lib/` | Shared utilities (pagination, response formatter, validators) |
| 10 | `admin/src/types/admin.ts` | Existing admin TS interfaces |
| 11 | `admin/src/api/orders.api.ts` | API client conventions, response shape |
| 12 | `admin/src/styles/tokens.css` | Design tokens for PDF HTML template |
| 13 | `admin/src/components/ui/` | Reusable components to reuse in invoice UI |
| 14 | `frontend/src/api/orders.api.ts` | Patient API conventions |
| 15 | `frontend/src/app/patient/orders/[id]/page.tsx` | Where to add invoice download button |
| 16 | `backend/tsconfig.json` | TS strict settings, paths |
| 17 | Any test files (`**/*.test.ts`, `**/*.spec.ts`) | Test framework and conventions |

---

## 1. Confirmed Decisions

| # | Decision | Value |
|---|---|---|
| D1 | Invoice number format — ecommerce | `MP-E-26-27-00001` (exactly 16 chars) |
| D2 | Invoice number format — adhoc | `MP-A-26-27-00001` (exactly 16 chars) |
| D3 | Financial year | April 1 → March 31 (Canadian), determined by app timezone |
| D4 | Sequence | 5-digit zero-padded, resets each FY, max 99,999/type/FY |
| D5 | Counters | Separate per `{ type, financialYear }` — atomic `$inc` |
| D6 | PDF storage | Generate on-demand via Playwright — no S3 yet |
| D7 | PDF cache compatibility | `pdfPath` field reserved in schema for Phase 9 S3 |
| D8 | Invoice immutability | All amounts/customer data snapshotted at issuance — never recalculated |
| D9 | Guest invoice access | Secure unguessable token — tied to specific invoice only |
| D10 | Voiding | Admin-only; requires reason; stores voidedBy + voidedAt + reason |
| D11 | Refund independence | Voiding ≠ refund — they are separate operations |
| D12 | Tax display | Subtotal → discount → taxable amount → GST/HST/PST lines → tax total → grand total |
| D13 | Tax amounts | Stored in cents, snapshotted at issuance — never recalculated |
| D14 | Draft invoices | NOT used for ecommerce; SUPPORTED for adhoc (draft → issue flow) |
| D15 | Invoice trigger | Order status reaches `delivered` (verify against actual lifecycle) |
| D16 | Idempotency | One invoice per order — enforced by unique index on `orderId` |
| D17 | Admin notes | Stored in schema — never rendered on customer PDF |
| D18 | Monetary math | 100% integer cents — no floats |

---

## 2. Invoice Number Format — Exact Specification

```
MP - E - 26-27 - 00001
^    ^   ^       ^
|    |   |       └── 5-digit zero-padded sequence  (chars 12–16)
|    |   └────────── Financial year "YY-YY"        (chars 7–11)
|    └────────────── Type code: E or A             (char 4)
└─────────────────── Prefix "MP"                   (chars 1–2)

Separators at positions 3, 5, 10 (hyphens)
Total: 2 + 1 + 1 + 1 + 5 + 1 + 5 = 16 characters exactly
```

Financial year derivation (pseudocode):
```
month = date in app timezone
if month >= April:  FY_start = current year,  FY_end = current year + 1
else:               FY_start = current year - 1, FY_end = current year
series = (FY_start % 100).padStart(2,'0') + '-' + (FY_end % 100).padStart(2,'0')
// 2026-09-27 → "26-27"
// 2027-01-15 → "26-27"
// 2027-04-01 → "27-28"
```

---

## 3. Data Model

### 3a. `invoice_counters` collection

```typescript
{
  _id: ObjectId,
  key: string,          // "E-26-27" | "A-26-27"  — unique index
  seq: number,          // current highest sequence issued
}
```

Increment strategy:
```
findOneAndUpdate(
  { key },
  { $inc: { seq: 1 } },
  { upsert: true, new: true, returnDocument: 'after' }
)
// Returns new seq; if seq > 99999 throw InvoiceSequenceExhaustedError
```

Unique index on `key`.

---

### 3b. `invoices` collection

```typescript
{
  _id: ObjectId,

  // Identification
  invoiceNumber: string,        // "MP-E-26-27-00001" — unique, immutable
  invoiceType: "ecommerce" | "adhoc",
  financialYear: string,        // "26-27"
  status: "draft" | "issued" | "void",

  // References
  orderId: ObjectId | null,     // ref → orders (null for adhoc)
  userId: ObjectId | null,      // ref → users (null for guest)

  // Customer snapshot (immutable after issuance)
  customerSnapshot: {
    fullName: string,
    email: string,
    phone: string | null,
    billingAddress: {
      line1: string,
      line2: string | null,
      city: string,
      province: string,
      postalCode: string,
      country: string,          // default "CA"
    }
  },

  // Guest token (null for authenticated users)
  guestToken: string | null,    // cryptographically random, 32 bytes hex
  guestTokenExpiresAt: Date | null,

  // Line items (immutable after issuance)
  lineItems: Array<{
    description: string,
    quantity: number,           // integer
    unitPrice: number,          // cents
    discountAmount: number,     // cents (0 if none)
    lineSubtotal: number,       // cents = (unitPrice * qty) - discount
    taxLines: Array<{
      label: string,            // "HST (13%)" | "GST (5%)" | "PST (8%)"
      rate: number,             // e.g. 0.13 (stored as-is for display)
      amount: number,           // cents
    }>,
    lineTaxTotal: number,       // cents
    lineTotal: number,          // cents = lineSubtotal + lineTaxTotal
  }>,

  // Totals (immutable after issuance, all in cents)
  subtotal: number,             // sum of lineSubtotal
  discountTotal: number,        // sum of all discountAmount
  taxableAmount: number,        // subtotal - discountTotal (where applicable)
  taxBreakdown: Array<{
    label: string,              // "HST (13%)"
    rate: number,               // 0.13
    amount: number,             // cents
  }>,
  taxTotal: number,             // sum of taxBreakdown amounts
  grandTotal: number,           // subtotal - discountTotal + taxTotal

  // Coupon (ecommerce only)
  couponCode: string | null,
  couponDiscount: number,       // cents (0 if none)

  // Timestamps & audit
  issuedAt: Date | null,
  voidedAt: Date | null,
  voidedBy: ObjectId | null,    // ref → users (admin)
  voidReason: string | null,

  // Internal only — never on PDF
  adminNotes: string,

  // Future S3 compatibility
  pdfPath: string | null,       // null until Phase 9

  createdAt: Date,              // auto
  updatedAt: Date,              // auto
}
```

Indexes:
- `invoiceNumber` — unique
- `orderId` — unique sparse (prevents duplicate invoices per order)
- `userId` + `status`
- `guestToken` — sparse (guest lookups)
- `financialYear` + `invoiceType` + `status`
- `createdAt`

---

## 4. Invoice Lifecycle & State Machine

```
[ecommerce]                        [adhoc]
     │                                │
     ▼                                ▼
  (no draft)                       DRAFT ──────────────────────┐
     │                                │                         │
     │                         admin issues                  admin deletes
     │                                │                         │
     ▼                                ▼                         ▼
  ISSUED ◄──────────────────────── ISSUED                   (deleted)
     │
  admin voids (with reason)
     │
     ▼
   VOID (immutable, preserved forever)
```

Transitions:
| From | To | Who | Trigger |
|---|---|---|---|
| — | issued | system | order → delivered |
| — | draft | admin | adhoc create |
| draft | issued | admin | adhoc issue action |
| draft | deleted | admin | adhoc discard (soft delete only) |
| issued | void | admin | void action + reason |
| void | any | — | NOT ALLOWED |

---

## 5. API Contract

### 5a. Patient APIs

**GET /api/v1/invoices/my**
```
Query: page, limit, status
Auth: requireAuth (patient)
Response: { data: Invoice[], pagination: {...} }
// Only returns: invoiceNumber, invoiceType, issuedAt, grandTotal, status, _id
// Never returns: adminNotes, guestToken, voidedBy details
```

**GET /api/v1/invoices/my/:id**
```
Auth: requireAuth — userId must match invoice.userId
Response: full invoice (minus adminNotes, guestToken, voidedBy)
Error: 404 if not found or not owned by user
```

**GET /api/v1/invoices/my/:id/pdf**
```
Auth: requireAuth — userId must match
Response: application/pdf, Content-Disposition: attachment
Error: 404 | 403 | 503 (browser crash)
```

**GET /api/v1/invoices/guest/pdf?token=:token**
```
Auth: none — token is the secret
Validates: token exists, not expired, matches invoice
Response: application/pdf
Error: 404 (invalid/expired token — do not distinguish)
```

### 5b. Admin APIs

**GET /api/v1/invoices/admin**
```
Auth: requireAdmin (permission: invoices:read)
Query: page, limit, type, financialYear, status, dateFrom, dateTo,
       search (invoiceNumber | customerEmail | orderNumber)
Response: { data: Invoice[], pagination: {...} }
```

**GET /api/v1/invoices/admin/:id**
```
Auth: requireAdmin (permission: invoices:read)
Response: full invoice including adminNotes
```

**GET /api/v1/invoices/admin/:id/pdf**
```
Auth: requireAdmin (permission: invoices:read)
Response: application/pdf
```

**POST /api/v1/invoices/admin/adhoc**
```
Auth: requireAdmin (permission: invoices:create)
Body: {
  customerId?: string,         // existing user _id OR omit for manual entry
  customerInfo?: {             // required if no customerId
    fullName, email, phone, billingAddress
  },
  lineItems: [{
    description, quantity, unitPrice,
    discountAmount?, taxLines?
  }],
  adminNotes?: string,
  issueDraft: boolean          // true = save as draft; false = issue immediately
}
// Server recalculates ALL totals — client totals ignored
Response: { invoice: Invoice }
```

**PATCH /api/v1/invoices/admin/:id/void**
```
Auth: requireAdmin (permission: invoices:void)
Body: { reason: string }       // required, min 10 chars
Validates: invoice.status === "issued"
Response: { invoice: Invoice }
```

### 5c. Reporting

**GET /api/v1/invoices/admin/reports/summary**
```
Auth: requireAdmin (permission: invoices:read)
Query: financialYear (required)
Response: {
  financialYear,
  ecommerce: { issued: n, voided: n, totalCents: n },
  adhoc:     { issued: n, voided: n, totalCents: n },
  monthly:   [{ month: "2026-04", issuedCount: n, totalCents: n }]
}
```

---

## 6. PDF Template Specification

**Layout (A4, portrait):**

```
┌─────────────────────────────────────────────────┐
│  [MediSyn Logo]            INVOICE               │
│  MediSyn Pharmacy          #MP-E-26-27-00001     │
│  123 Health St, Toronto ON │ Date: 2026-09-27    │
│  info@medisyn.ca           │ Status: ISSUED      │
├─────────────────────────────────────────────────┤
│  BILL TO                    ORDER #              │
│  John Doe                   ORD-2026-000123      │
│  john@example.com                                │
│  123 Main St, Toronto ON                         │
├────────────────┬─────┬──────────┬───────────────┤
│ Description    │ Qty │ Price    │ Total          │
├────────────────┼─────┼──────────┼───────────────┤
│ Product Name   │  2  │ $19.99   │ $39.98         │
│ ...            │     │          │                │
├────────────────┴─────┴──────────┼───────────────┤
│                        Subtotal │ $39.98         │
│                        Discount │ -$5.00         │
│                   Taxable Amt   │ $34.98         │
│                       HST (13%) │ $4.55          │
│                      Tax Total  │ $4.55          │
│                   GRAND TOTAL   │ $39.53         │
├─────────────────────────────────────────────────┤
│ This is an official invoice from MediSyn Pharmacy│
│                              Page 1 of N         │
└─────────────────────────────────────────────────┘
```

**Playwright PDF options:**
```typescript
{
  format: 'A4',
  printBackground: true,
  margin: { top: '60px', bottom: '80px', left: '40px', right: '40px' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="font-size:9px;width:100%;text-align:right;
    padding-right:40px">Page <span class="pageNumber"></span> of
    <span class="totalPages"></span></div>`,
}
```

**Security:** All user-controlled strings HTML-escaped before template injection.

---

## 7. Playwright Integration Strategy

**Browser pool** (`backend/src/lib/playwrightPdf.service.ts`):
```
- Singleton browser instance launched at app startup
- Reused across all PDF requests
- Each request: browser.newPage() → setContent() → pdf() → page.close()
- Timeout: 30s per render
- On crash: re-launch browser, return 503
- Graceful shutdown: browser.close() on SIGTERM
```

**Install:**
```bash
cd backend
npm install playwright-core
npx playwright install chromium --with-deps
```

**Node.js version check:** Playwright requires Node 18+. Verify `backend/package.json` engines field.

---

## 8. Phase-by-Phase Task Breakdown

### Phase 1 — Architecture Validation (before any code)
- [ ] Read all files in inspection checklist (Section 0)
- [ ] Confirm order status lifecycle and `delivered` trigger
- [ ] Confirm tax structure in existing order schema
- [ ] Confirm auth middleware shape
- [ ] Confirm API response formatter conventions
- [ ] Confirm Node.js version for Playwright compatibility
- [ ] Identify any conflicts with the plan above
- [ ] Document findings, flag blockers

### Phase 2 — Backend Foundation
- [ ] `backend/src/modules/invoices/invoice.schema.ts`
- [ ] `backend/src/modules/invoices/invoiceCounter.schema.ts`
- [ ] `backend/src/modules/invoices/invoice.numbering.ts` — FY calc + atomic counter
- [ ] `backend/src/modules/invoices/invoice.service.ts` — create/void/get/list
- [ ] Hook into `orders.service.ts` → on `delivered` → `InvoiceService.createFromOrder()`
- [ ] Idempotency: unique sparse index on `orderId`
- [ ] Validation: `backend/src/modules/invoices/invoice.validation.ts`

### Phase 3 — PDF Generation
- [ ] `backend/src/lib/playwrightPdf.service.ts` — browser pool singleton
- [ ] `backend/src/modules/invoices/invoice.template.ts` — HTML builder (escape all fields)
- [ ] Verify Playwright + Node.js version compatibility
- [ ] `npx playwright install chromium` added to deployment notes

### Phase 4 — Backend API Routes
- [ ] `backend/src/modules/invoices/invoices.routes.ts`
- [ ] Patient routes (`/my`, `/my/:id`, `/my/:id/pdf`)
- [ ] Guest route (`/guest/pdf?token=`)
- [ ] Admin routes (list, detail, pdf, adhoc, void, reports)
- [ ] Register module in `backend/src/app.ts`
- [ ] Permission guards (invoices:read, invoices:create, invoices:void)

### Phase 5 — Admin Panel UI
- [ ] `admin/src/api/invoices.api.ts`
- [ ] `admin/src/hooks/useInvoices.ts`
- [ ] `admin/src/types/admin.ts` — add Invoice interfaces
- [ ] `admin/src/app/(dashboard)/invoices/page.tsx` — list + filters
- [ ] `admin/src/app/(dashboard)/invoices/[id]/page.tsx` — detail + void + notes
- [ ] `admin/src/app/(dashboard)/invoices/new/page.tsx` — adhoc invoice form
- [ ] `admin/src/app/(dashboard)/invoices/reports/page.tsx` — summary report
- [ ] Add "Invoices" link to `AdminSidebar.tsx`

### Phase 6 — Patient Portal UI
- [ ] `frontend/src/api/invoices.api.ts`
- [ ] `frontend/src/hooks/useInvoices.ts`
- [ ] `frontend/src/app/patient/invoices/page.tsx` — invoice list
- [ ] `frontend/src/app/patient/invoices/[id]/page.tsx` — invoice detail
- [ ] Modify `frontend/src/app/patient/orders/[id]/page.tsx` — add invoice download button (show only when status=delivered and invoice exists)
- [ ] Add "Invoices" link to patient sidebar/nav

### Phase 7 — Tests & Verification
- [ ] Invoice numbering unit tests (FY boundaries, concurrency, limits)
- [ ] Invoice lifecycle tests (creation trigger, idempotency, void)
- [ ] Authorization tests (own invoice, cross-user, guest token, admin-only)
- [ ] PDF generation tests (content, escaping, headers)
- [ ] Adhoc invoice tests (totals recalc, validation)
- [ ] `npm run build` passes in all three workspaces
- [ ] `tsc --noEmit` passes
- [ ] Regression: existing order tests still pass

---

## 9. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Order service triggers invoice twice on concurrent status updates | HIGH | Unique sparse index on `orderId`; catch duplicate-key error gracefully |
| R2 | FY counter row not yet seeded — first `upsert` race | MEDIUM | MongoDB `findOneAndUpdate` with `upsert:true` is atomic per key |
| R3 | Playwright chromium not available in deployment env | HIGH | Document install step; add to Dockerfile / deployment script |
| R4 | Guest token brute-force | MEDIUM | 32-byte crypto random = 64 hex chars; rate-limit the guest PDF route |
| R5 | Node.js version < 18 (Playwright requires 18+) | MEDIUM | Verify `engines` in package.json before installing |
| R6 | Tax recalculation on PDF re-render silently differs | HIGH | PDF uses stored `taxBreakdown` snapshot — never recalculates |
| R7 | Adhoc invoice totals sent from client trusted | HIGH | Server always recalculates — client totals are display-only |
| R8 | Voided invoice PDF still downloadable | LOW | PDF endpoint checks `status !== 'void'` before rendering (or adds VOIDED watermark) |
| R9 | `adminNotes` leaked in patient-facing API response | HIGH | Separate response serializer per role; explicit field allowlist |
| R10 | FY sequence exceeds 99,999 | LOW | Throw `InvoiceSequenceExhaustedError` with clear message; alert admin |

---

## 10. Deployment & Environment Notes

```bash
# Backend — after npm install
cd backend
npx playwright install chromium --with-deps

# New ENV vars needed (add to .env.example)
APP_TIMEZONE=America/Toronto          # used for FY calculation
INVOICE_GUEST_TOKEN_TTL_DAYS=30       # how long guest download links are valid
```

Indexes to add to MongoDB (will be created by Mongoose on startup):
- `invoices.invoiceNumber` — unique
- `invoices.orderId` — unique sparse
- `invoices.guestToken` — sparse
- `invoice_counters.key` — unique

---

## 11. Files to Create / Modify Summary

### New files
```
backend/src/modules/invoices/
  invoice.schema.ts
  invoiceCounter.schema.ts
  invoice.numbering.ts
  invoice.service.ts
  invoices.routes.ts
  invoice.validation.ts
  invoice.template.ts          ← HTML template for PDF
backend/src/lib/
  playwrightPdf.service.ts     ← browser pool singleton

admin/src/api/invoices.api.ts
admin/src/hooks/useInvoices.ts
admin/src/app/(dashboard)/invoices/page.tsx
admin/src/app/(dashboard)/invoices/[id]/page.tsx
admin/src/app/(dashboard)/invoices/new/page.tsx
admin/src/app/(dashboard)/invoices/reports/page.tsx

frontend/src/api/invoices.api.ts
frontend/src/hooks/useInvoices.ts
frontend/src/app/patient/invoices/page.tsx
frontend/src/app/patient/invoices/[id]/page.tsx
```

### Modified files
```
backend/src/modules/orders/orders.service.ts   ← trigger invoice on delivered
backend/src/app.ts                             ← register invoices module
backend/package.json                           ← add playwright-core
backend/.env.example                           ← add APP_TIMEZONE, TOKEN_TTL

admin/src/types/admin.ts                       ← add Invoice interfaces
admin/src/components/common/AdminSidebar.tsx   ← add Invoices nav item

frontend/src/app/patient/orders/[id]/page.tsx  ← add invoice download button
frontend/src/components/common/ (sidebar)      ← add Invoices nav item
```

---

## 12. Open Questions (None Blocking)

| # | Question | Default if not answered |
|---|---|---|
| OQ1 | Should voided invoices show VOIDED watermark on PDF or return 410 Gone? | Show watermark (preserve access for audit) |
| OQ2 | Guest token TTL — how many days should download links remain valid? | 30 days |
| OQ3 | Should admin be able to regenerate a guest token (if expired)? | Yes, admin-only action |
| OQ4 | Adhoc invoice — should it support partial tax (some items taxable, some not)? | Yes — per-line tax control |
| OQ5 | Invoice email — should customer receive an email with invoice PDF when issued? | No (not in this phase) |
| OQ6 | Payment method shown on invoice face? | Yes — "Pickup" or "Delivery" for ecommerce |

---

*This plan will be updated as implementation progresses. No code is written until Phase 1 inspection is complete.*

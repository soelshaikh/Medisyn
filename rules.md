# MediSyn — Engineering Rules

> Applies to all three workspaces: `frontend/`, `admin/`, `backend/`.
> These are non-negotiable. Violations must be fixed before merge, not deferred.
> When in doubt, ask. Never guess a business rule or security constraint.

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [TypeScript](#2-typescript)
3. [Frontend — Data Fetching & State](#3-frontend--data-fetching--state)
4. [Frontend — UI Components](#4-frontend--ui-components)
5. [Frontend — Styling & Design Tokens](#5-frontend--styling--design-tokens)
6. [Frontend — Forms & Input Validation](#6-frontend--forms--input-validation)
7. [Frontend — File & PDF Downloads](#7-frontend--file--pdf-downloads)
8. [Backend — API Design](#8-backend--api-design)
9. [Backend — Business Logic](#9-backend--business-logic)
10. [Backend — Database](#10-backend--database)
11. [Backend — Security](#11-backend--security)
12. [Backend — Error Handling](#12-backend--error-handling)
13. [Code Quality](#13-code-quality)
14. [Git & PRs](#14-git--prs)
15. [Pre-Merge Checklist](#15-pre-merge-checklist)

---

## 1. Architecture

### 1.1 Three-app separation — never mix concerns

| Workspace | Purpose | What does NOT belong here |
|---|---|---|
| `frontend/` | Patient-facing Next.js UI | No DB code, no Server Actions, no direct Mongoose, no admin-only logic |
| `admin/` | Admin panel Next.js UI | No patient-facing UI, no DB code, no Server Actions |
| `backend/` | Express REST API | No rendering, no Next.js imports, no frontend-specific logic |

### 1.2 Data always flows through the REST API

```
frontend/admin  ──(axios)──►  backend (Express)  ──(Mongoose)──►  MongoDB
```

- Frontend/admin never import from backend source files.
- Backend never imports from frontend/admin source files.
- No shared `src/` folders between workspaces.

### 1.3 Folder structure is fixed

```
src/
├── app/           ← Next.js App Router pages + layouts
├── components/
│   ├── ui/        ← Atomic, generic, token-aware (Button, Input, Select…)
│   ├── common/    ← Shared patterns (PageHeader, DataGrid, FilterPanel…)
│   └── features/  ← Domain-specific (PrescriptionCard, ProductCard…)
├── api/           ← API endpoint functions, one file per domain
├── hooks/         ← TanStack Query hooks, one file per domain
├── stores/        ← Zustand stores, one store per concern
├── styles/        ← tokens.css + globals.css only
├── types/         ← Shared TypeScript interfaces
└── lib/           ← Utilities, formatters, constants, helpers
```

Never create files outside this structure without discussion.

### 1.4 No duplication — extract before repeating

If the same UI pattern appears in two places, extract it to `components/common/` before the second use. If a utility function is used in two files, move it to `lib/`. Three similar lines is fine; copy-paste of entire blocks is not.

---

## 2. TypeScript

### 2.1 Strict mode always on

```json
// tsconfig.json
{ "strict": true, "noImplicitAny": true, "strictNullChecks": true }
```

- Zero `any` types. Use `unknown` when the type is genuinely unknown, then narrow it.
- Zero `@ts-ignore` or `@ts-expect-error` without a comment explaining exactly why.
- Zero `as SomeType` casts unless the runtime shape is verified above the cast.

### 2.2 Types live in `src/types/`

- Shared interfaces → `src/types/admin.ts` / `src/types/patient.ts`
- Never inline complex types inside component files — they become impossible to reuse.
- API response shapes must always be typed; never use `any` for API data.

### 2.3 Enums → const objects or union types

```ts
// ❌ TypeScript enum (generates runtime code, causes issues with strict bundlers)
enum Status { Active = "active", Void = "void" }

// ✅ Union type
type Status = "active" | "void";

// ✅ Const object when you need to iterate
const STATUS = { Active: "active", Void: "void" } as const;
type Status = typeof STATUS[keyof typeof STATUS];
```

---

## 3. Frontend — Data Fetching & State

### 3.1 All API calls go through TanStack Query

```ts
// ❌ Wrong — direct fetch inside component
useEffect(() => {
  fetch("/api/orders").then(...);
}, []);

// ✅ Correct
const { data, isLoading } = useQuery({
  queryKey: ["orders", page, filters],
  queryFn:  () => ordersApi.list({ page, ...filters }),
});
```

- No `useEffect` + `fetch`/`axios` inside components. Ever.
- `useQuery` for reads, `useMutation` for writes.
- Query keys must include every variable the query depends on.

### 3.2 API functions live in `src/api/` — one file per domain

```ts
// src/api/orders.api.ts
export const ordersApi = {
  list:    (params) => apiClient.get("/orders", { params }).then(r => r.data.data),
  getById: (id)     => apiClient.get(`/orders/${id}`).then(r => r.data.data),
  update:  (id, p)  => apiClient.patch(`/orders/${id}`, p).then(r => r.data.data),
};
```

- Never call `apiClient` directly inside a component or Zustand store.
- All API functions return typed values — no `Promise<any>`.

### 3.3 Zustand for client state only

```ts
// ✅ Correct Zustand usage: UI state, auth session, cart, modals
const useAuthStore = create<AuthState>()(...)

// ❌ Wrong: server data in Zustand
const useOrderStore = create(() => ({ orders: [] })) // TanStack Query owns this
```

- Server data (from API) lives in TanStack Query cache only — never duplicated in Zustand.
- Zustand stores in `src/stores/` — one store per concern.

### 3.4 Pending vs Applied filter state

Any filter panel that sends API requests must use two state objects:

```ts
const [pending, setPending] = useState(defaultFilters); // form state — updates on every input change
const [applied, setApplied] = useState(defaultFilters); // query state — updates only on Apply click

useQuery({ queryKey: ["data", applied], queryFn: () => api.list(applied) });

function applyFilters() { setApplied({ ...pending }); setPage(1); }
function resetFilters()  { setPending(defaultFilters); setApplied(defaultFilters); }
```

Never put raw filter input state directly in the `queryKey` — it causes a request on every keystroke.

---

## 4. Frontend — UI Components

### 4.1 Never use native HTML form controls

| ❌ Forbidden | ✅ Required | Why |
|---|---|---|
| `<input type="text">` | `<Input>` | Consistent styling, label/hint/error slots |
| `<input type="number">` | `<NumberInput>` | Blocks browser spinner, blocks non-numeric keys |
| `<input type="date">` | `<DatePicker>` | Consistent cross-browser calendar |
| `<input type="date">` (range) | `<DateRangePicker>` | Dual-calendar with presets |
| `<select>` | `<Select>` | Radix-powered, keyboard accessible, token-styled |

### 4.2 Filter UIs always use `FilterPanel` + `FilterField`

```tsx
// ❌ Wrong: ad-hoc filter bar
<div className="flex gap-3"><input .../><select .../></div>

// ✅ Correct
<FilterPanel onApply={apply} onReset={reset} columns={3}>
  <FilterField label="Status"><Select .../></FilterField>
  <FilterField label="Date"><DateRangePicker .../></FilterField>
</FilterPanel>
```

### 4.3 Data lists always use `DataGrid`

```tsx
// ❌ Wrong: raw <table> with manual headers
<table><thead><tr><th>Name</th>...</tr></thead></table>

// ✅ Correct
<DataGrid
  columns={columns}
  data={data}
  keyFn={(r) => r._id}
  loading={isLoading}
  summary={[{ label: "Total", value: String(total) }]}
  onExport={handleExport}
  onRefresh={handleRefresh}
/>
```

`DataGrid` gives sortable headers, summary bar, search, export, and refresh for free.

### 4.4 Loading states on every async button

```tsx
// ❌ Wrong: no loading state
<button onClick={handleSave}>Save</button>

// ✅ Correct
<Button loading={mutation.isPending} disabled={mutation.isPending} onClick={handleSave}>
  Save
</Button>
```

Per-row loading state (e.g. downloading a PDF): use `useState<string | null>(null)` to track which row's action is in-flight.

---

## 5. Frontend — Styling & Design Tokens

### 5.1 Never hardcode Tailwind color utilities

```tsx
// ❌ Wrong
<p className="text-blue-600 bg-red-50 border-gray-200">

// ✅ Correct
<p className="text-[var(--color-primary)] bg-[var(--color-error-light)] border-[var(--color-border)]">
```

All design values (colors, spacing, radius, shadows, typography, transitions, z-index) must come from `src/styles/tokens.css`. Every CSS variable is defined there. Changing a token cascades everywhere automatically.

### 5.2 Allowed token references

```css
/* Colors */   var(--color-primary)  var(--color-error)  var(--color-surface) …
/* Typography */  var(--font-size-xs)  var(--font-size-sm)  var(--font-sans) …
/* Spacing */  var(--space-4)  var(--space-8) …
/* Radius */   var(--radius-md)  var(--radius-lg) …
/* Shadows */  var(--shadow-sm)  var(--shadow-md) …
/* Z-index */  var(--z-modal)  var(--z-toast) …
/* Transitions */  var(--transition-base)  var(--transition-fast) …
```

### 5.3 No inline `style={{}}` for design values

```tsx
// ❌ Wrong
<div style={{ color: "#1677A8", marginTop: "16px" }}>

// ✅ Correct
<div className="text-[var(--color-primary)] mt-[var(--space-4)]">
```

`style={{}}` is allowed only for truly dynamic values that cannot be expressed as a token (e.g. a progress bar width from data: `style={{ width: \`${pct}%\` }}`).

---

## 6. Frontend — Forms & Input Validation

### 6.1 Restrict characters at the `onChange` level

Do not rely on `pattern` attribute or server-side validation alone. Block invalid characters at the keyboard/paste level:

```tsx
// Batch / Lot # — alphanumeric + hyphens only
onChange={(e) => setBatch(e.target.value.replace(/[^A-Za-z0-9\-]/g, ""))}

// SKU — alphanumeric + hyphen + underscore
onChange={(e) => setSku(e.target.value.replace(/[^A-Za-z0-9\-_]/g, ""))}

// Signed integer (inventory delta)
onChange={(e) => setDelta(e.target.value.replace(/[^0-9\-]/g, ""))}

// Phone — digits + formatting chars
onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\-() ]/g, ""))}
```

**Reference table:**

| Field type | Allowed | Regex filter |
|---|---|---|
| Batch / Lot # | `A-Z a-z 0-9 -` | `/[^A-Za-z0-9\-]/g` |
| SKU / Code | `A-Z a-z 0-9 - _` | `/[^A-Za-z0-9\-_]/g` |
| Postal code | `A-Z a-z 0-9 - space` | `/[^A-Za-z0-9 \-]/g` |
| Phone | `0-9 + - ( ) space` | `/[^0-9+\-() ]/g` |
| Signed integer | `0-9 -` | `/[^0-9\-]/g` |
| Positive integer | `0-9` | `/[^0-9]/g` |

### 6.2 Never use `<input type="number">` for quantity/price fields

`type="number"` renders browser-native spinner arrows (browser-chrome that varies wildly), allows `e`, `E`, `+`, `.` by default, and is generally inconsistent. Always use `<NumberInput>` which is `type="text"` + `inputMode="numeric"` + `onKeyDown` filtering.

### 6.3 Server-side totals — never trust frontend math

All order/invoice totals, tax calculations, coupon discounts, and price-sensitive values must be computed on the backend. Frontend may show a live preview, but the persisted value always comes from the server response — never from frontend state.

```ts
// ❌ Wrong: saving frontend-calculated total
await ordersApi.checkout({ ...cart, total: cart.items.reduce(...) });

// ✅ Correct: total is returned by the backend checkout endpoint
const order = await ordersApi.checkout({ items: cart.items, couponCode });
// order.total is the authoritative server-computed value
```

---

## 7. Frontend — File & PDF Downloads

### 7.1 Never use `<a href>` for authenticated downloads

A bare `<a href="https://api.example.com/invoices/123/pdf">` opens the URL directly in the browser with no request headers — authenticated endpoints return 401.

```tsx
// ❌ Wrong
<a href={`${API_URL}/invoices/${id}/pdf`} target="_blank">Download</a>

// ✅ Correct — uses authenticated axios instance
async function downloadPdf(id: string, filename: string) {
  const res = await apiClient.get(`/invoices/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

This applies to any authenticated resource: documents, prescription files, lab results, signed URLs, exports.

### 7.2 Show loading state during download

Downloads can take multiple seconds (PDF generation, large files). Always show a spinner and disable the button while the request is in-flight.

---

## 8. Backend — API Design

### 8.1 All endpoints under `/api/v1/`

- Base path: `/api/v1`
- Resource naming: plural nouns, lowercase, hyphenated (`/ask-pharmacist`, `/pharmacy-partners`)
- No verbs in URLs; use HTTP methods to express intent

```
GET    /api/v1/orders          → list
GET    /api/v1/orders/:id      → get one
POST   /api/v1/orders          → create
PATCH  /api/v1/orders/:id      → partial update
DELETE /api/v1/orders/:id      → delete
PATCH  /api/v1/orders/:id/status → sub-resource action
```

### 8.2 Response shape is always consistent

```ts
// Success (single item or action)
{ success: true, data: T, message?: string }

// Success (list)
{ success: true, data: T[], meta: { page, limit, total, totalPages } }

// Error
{ success: false, error: string, details?: Record<string, string[]>, statusCode: number }
```

Always use the shared response helpers: `sendSuccess`, `sendList`, `sendError`, `sendCreated`.

### 8.3 All routes use `asyncHandler`

```ts
// ❌ Wrong — unhandled async errors crash the process
router.get("/", async (req, res) => { ... });

// ✅ Correct
router.get("/", authenticate, asyncHandler(async (req, res) => { ... }));
```

### 8.4 Validate all input with Zod at the route layer

```ts
const createSchema = z.object({
  name:  z.string().min(1).max(100),
  price: z.number().int().nonnegative(),
});

router.post("/", authenticate, asyncHandler(async (req, res) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400,
    body.error.flatten().fieldErrors as Record<string, string[]>);
  // proceed with body.data — fully typed and validated
}));
```

Never access `req.body.someField` without first validating the request body with Zod.

### 8.5 `req.user._id` not `req.user.id`

The `RequestUser` interface uses `_id` (MongoDB ObjectId string). Using `.id` compiles but is `undefined` at runtime.

---

## 9. Backend — Business Logic

### 9.1 Business logic lives in service files, not route handlers

Route handlers handle: request parsing, input validation, calling the service, sending the response.
Service files handle: database operations, business rules, side effects.

```ts
// ❌ Wrong — business logic in route handler
router.post("/orders/checkout", asyncHandler(async (req, res) => {
  const items = req.body.items;
  let total = 0;
  for (const item of items) {
    const product = await ProductModel.findById(item.productId);
    total += product.price * item.quantity;
  }
  const order = await OrderModel.create({ ...req.body, total });
  sendCreated(res, order);
}));

// ✅ Correct — route calls service
router.post("/orders/checkout", asyncHandler(async (req, res) => {
  const body = checkoutSchema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, ...);
  const order = await checkout(body.data, req.user!._id);
  sendCreated(res, order);
}));
```

### 9.2 Side effects are fire-and-forget

Email sends, push notifications, audit log writes, and invoice generation triggered by status changes must never block the main request:

```ts
// ✅ Correct
await OrderModel.findByIdAndUpdate(id, { status });
void sendOrderStatusEmail(order, newStatus).catch(logger.error); // non-blocking
void createFromOrder(String(order._id)).catch(logger.error);     // non-blocking
return sendSuccess(res, updatedOrder);
```

### 9.3 `AuditActor` shape is `{ id, email, name, ip? }`

```ts
// ❌ Wrong
logAction({ _id: req.user!._id, ... });

// ✅ Correct
logAction({
  id:    req.user!._id,   // string, not _id
  email: req.user!.email,
  name:  req.user!.fullName,
  ip:    req.ip,
});
```

### 9.4 Status history required for all major operational domains

Every document that has a `status` field that can change must also record a `statusHistory` array:

```ts
{
  status: "shipped",
  statusHistory: [
    { status: "pending",    changedAt: Date, changedBy: string, note?: string },
    { status: "processing", changedAt: Date, changedBy: string },
    { status: "shipped",    changedAt: Date, changedBy: string },
  ]
}
```

Domains with required status history: Orders, Prescriptions, Compounding, Appointments.

---

## 10. Backend — Database

### 10.1 Always use `.lean()` for reads

```ts
// ❌ Returns a Mongoose document — slower, has prototype methods, not a plain object
const order = await OrderModel.findById(id);

// ✅ Returns a plain JS object — faster, serializable, TypeScript-friendly
const order = await OrderModel.findById(id).lean();
```

Exception: you need to call `.save()` or a Mongoose instance method — then don't use `.lean()`.

### 10.2 Indexes for every query pattern

Every field you filter, sort, or look up by must have an index. Missing indexes mean full collection scans on large datasets.

```ts
// In the schema file
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });
```

Unique sparse indexes for optional unique fields (e.g. guestToken, orderId on invoices):
```ts
InvoiceSchema.index({ orderId: 1 }, { unique: true, sparse: true });
```

### 10.3 Atomic operations for counters and inventory

Never do read-then-write for counters or inventory quantity — use `$inc` and `findOneAndUpdate` atomically:

```ts
// ❌ Wrong — race condition
const counter = await CounterModel.findOne({ key });
counter.lastSeq += 1;
await counter.save();

// ✅ Correct — atomic
const counter = await CounterModel.findOneAndUpdate(
  { key },
  { $inc: { lastSeq: 1 } },
  { upsert: true, new: true },
);
```

### 10.4 Never store files as base64 in the database

Files (prescriptions, documents, product images, lab results) must be stored in file storage (S3/R2/local) via `FileStorageService`. The database stores only the storage key (a string path), never the file content.

```ts
// ❌ Wrong
{ prescriptionFile: "data:application/pdf;base64,JVBERi0xLjQ..." }

// ✅ Correct
{ prescriptionFileKey: "private/prescriptions/user123/rx-2025-001.pdf" }
```

---

## 11. Backend — Security

### 11.1 Authentication required on all non-public routes

```ts
// ❌ Wrong — no auth
router.get("/users", asyncHandler(async (req, res) => { ... }));

// ✅ Correct
router.get("/users", authenticate, requirePermission("users.read"), asyncHandler(...));
```

Public routes (no auth): `/api/v1/auth/*`, `/api/v1/products` (read), `/api/v1/faqs`.
All admin routes: require `authenticate` + `requirePermission(...)`.

### 11.2 Permissions-based access — never raw role checks

```ts
// ❌ Wrong — hardcoded role check
if (req.user!.role !== "admin") return sendError(res, "Forbidden", 403);

// ✅ Correct — permission check
router.patch("/:id/void", authenticate, requirePermission("invoices.void"), ...);
```

### 11.3 Zod validates all inputs — never trust `req.body` directly

See section 8.4. This is both a data integrity and a security rule — unsanitized input is the root cause of injection, mass assignment, and unexpected behavior.

### 11.4 `express-mongo-sanitize` is always active

The global middleware strips `$` and `.` from request body, query, and params — preventing NoSQL injection. Do not remove it.

### 11.5 Internal admin notes must never be exposed to patients

Any field named `internalNotes`, `adminNotes`, `internalFlags`, or similar must be stripped from any response going to a patient-facing endpoint:

```ts
// In patient-facing route
const order = await OrderModel.findById(id).select("-internalNotes").lean();
```

---

## 12. Backend — Error Handling

### 12.1 Throw `AppError` for known error conditions

```ts
// ❌ Wrong
throw new Error("Not found");

// ✅ Correct
throw new AppError("Order not found", 404);
throw new AppError("Insufficient stock", 409);
throw new AppError("Cannot void an already-voided invoice", 422);
```

`AppError` is caught by the global error middleware which formats the response correctly and logs appropriately.

### 12.2 Sensitive errors must not leak to the client

```ts
// ❌ Wrong — exposes internal details
catch (err) {
  res.json({ error: err.message }); // could be a DB error with schema details
}

// ✅ Correct — AppError messages are safe to expose; unexpected errors are sanitized
// The global error middleware handles this automatically — just throw AppError or let unknown errors bubble
```

### 12.3 Always log unexpected errors

```ts
import { logger } from "@/common/utils/logger";

catch (err) {
  logger.error("[InvoiceService] createFromOrder failed", { orderId, err });
  throw err; // re-throw for the global handler
}
```

---

## 13. Code Quality

### 13.1 No comments explaining WHAT the code does

```ts
// ❌ Wrong — explains what, not why
// Loop through items and calculate total
const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

// ✅ Only comment when WHY is non-obvious
// Use cents throughout to avoid floating-point rounding errors (e.g. $9.99 → 999)
const total = items.reduce((sum, item) => sum + item.priceInCents * item.qty, 0);
```

### 13.2 No console.log in committed code

Use `logger.info / logger.warn / logger.error` from `@/common/utils/logger` in the backend.
In frontend: use nothing (remove debug logs before committing).

### 13.3 No dead code

- No commented-out code blocks
- No unused imports (TypeScript will flag these with `noUnusedLocals`)
- No `_unused` variable workarounds — fix the underlying issue

### 13.4 Function size and complexity

- Prefer functions that do one thing. If a function is doing three things, split it.
- Service functions should not exceed ~80 lines. If they do, factor out private helpers.
- Components should not exceed ~250 lines. Extract sub-components.

### 13.5 No half-finished implementations

- No `// TODO: implement this later` stubs in production code
- No placeholder `return null;` in functions that are supposed to do something
- If a feature is incomplete, it should be behind a flag or not yet in the codebase at all

---

## 14. Git & PRs

### 14.1 Commit message format

```
<type>(<scope>): <short description>

Types: feat | fix | refactor | chore | docs | style | test
Scope: backend | admin | frontend | (module name)

Examples:
feat(invoices): add adhoc invoice creation with tax breakdown
fix(admin): replace native select with Radix Select component
refactor(backend): extract order status side effects to service
```

### 14.2 One logical change per commit

Don't mix unrelated changes in one commit. If you're fixing a bug and improving a component, that's two commits.

### 14.3 Always update worklog before closing a session

- Update `worklog.md` with a session summary
- Create/update `worklog/YYYY-MM-DD.md` with full detail
- This is required — not optional

### 14.4 Confirm before destructive operations

Never run `git reset --hard`, `git push --force`, `DROP COLLECTION`, or `rm -rf` without explicit user confirmation. Prefer reversible alternatives.

---

## 15. Pre-Merge Checklist

Before submitting any code for review:

**TypeScript**
- [ ] `npm run typecheck` passes with 0 errors
- [ ] No `any`, no `@ts-ignore`, no unsafe casts

**UI Components (admin/ and frontend/)**
- [ ] No `<input type="number">` → replaced with `<NumberInput>`
- [ ] No `<input type="date">` → replaced with `<DatePicker>` or `<DateRangePicker>`
- [ ] No `<select>` → replaced with `<Select>`
- [ ] No raw `<input>` without using `<Input>` component
- [ ] Batch / code / SKU fields have character-restriction filter in `onChange`
- [ ] Filter UIs use `<FilterPanel>` + `<FilterField>`
- [ ] Data tables use `<DataGrid>`
- [ ] No hardcoded Tailwind color utilities — only `var(--color-*)` tokens
- [ ] Async buttons have loading state + disabled while pending
- [ ] Authenticated file/PDF downloads use axios blob, not bare `<a href>`

**State & Data**
- [ ] All API calls go through TanStack Query
- [ ] No server data stored in Zustand
- [ ] Filter panels use pending/applied pattern
- [ ] Totals/prices computed server-side — never from frontend state

**Backend**
- [ ] All routes use `asyncHandler`
- [ ] All inputs validated with Zod before use
- [ ] No business logic in route handlers
- [ ] Auth + permission middleware on all protected routes
- [ ] `logger` used instead of `console.log`
- [ ] Side effects are fire-and-forget (non-blocking)
- [ ] `AppError` thrown for known error conditions
- [ ] `.lean()` on all read-only DB queries
- [ ] Indexes defined for all new query patterns
- [ ] No base64 file storage

**Security**
- [ ] Internal notes stripped from patient-facing responses
- [ ] No raw role checks — use `requirePermission()`
- [ ] No sensitive error details leaking to client responses

**Worklog**
- [ ] `worklog.md` and `worklog/YYYY-MM-DD.md` updated

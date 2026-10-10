# MediSyn — Resume Point
_Last updated: 2026-10-09_

---

## Where We Are

| App | Status |
|-----|--------|
| `backend/` Express API | Phase 1 ✅ + Phase 2 ✅ (44/44 auth tests) + Phase 3 🔶 (code complete, tests pending live DB) |
| `admin/` Next.js admin panel | Old code exists — not yet rebuilt/wired to API |
| `frontend/` Next.js patient app | Old code exists — not yet rebuilt/wired to API |

---

## Phase 3 — Final Step Before Closing

All Phase 3 code is written and `typecheck` + `lint` both pass. Only the integration test run is pending.

Docker + Postgres + Redis must be running:
```bash
cd backend/
docker compose up -d
npm run db:migrate
npm run db:seed
```

Then run the test suite to close Phase 3:
```bash
npm run test -- tests/catalogue/
```

All tests should pass (products, categories, browsing, inventory, coupons). If anything fails, see `worklog/2026-10-09c.md` for fixture details.

## Phase 4 — Start Here (after Phase 3 tests pass)

**Cart + Checkout + Orders** — guest cart, authenticated cart, checkout flow, order management.

Run spec-kit to begin:
```
/speckit-specify Phase 4 — Cart, Checkout, Orders. Guest cart (cookie-based), authenticated cart (merged on login), checkout (address, shipping method selection), order creation (line items, totals calculated server-side), order management (status history, cancellation). Builds on Phase 3 catalogue.
```

---

## Full Remaining Phase Roadmap

| Phase | What Gets Built | Depends On |
|-------|----------------|------------|
| **2** ✅ | Auth tests (44/44 green) | Done |
| **3** 🔶 | Products, categories, inventory, coupons — code done, run tests | Phase 2 auth ✅ |
| **4** | Cart (guest + auth), checkout, orders, order management | Phase 3 |
| **5** | Compounding requests, prescriptions (enhanced), ask-pharmacist, minor ailments, status histories | Phase 2 auth ✅ |
| **6** | Appointments — vaccine services, availability slots, STRICT/OPEN booking, concurrency-safe | Phase 2 auth ✅ |
| **7** | Redis/BullMQ async queue, email queue, email templates, notifications | Phase 3+ |
| **8** | Reports & dashboard metrics — sales, orders, customers | Phase 4+ |
| **9** | S3/R2 file storage, signed URLs, migrate file uploads off DB | Phase 5+ |
| **10** | Rate limiting, security hardening, OpenAPI cleanup, performance | All phases done |

Phases 5 and 6 can run **in parallel** with Phases 3–4 since they only depend on auth (Phase 2), not ecommerce.

---

## Open Decisions Needed Before Certain Phases

These are OPEN QUESTIONs that need answers before the relevant phase can be specced:

| Question | Needed For |
|----------|-----------|
| Exact product restrictions (controlled substances handling?) | Phase 3 |
| Shipping/tax rules by province | Phase 4 |
| Minor ailment service list (what conditions are covered?) | Phase 5 |
| Compounding request fields (what info does the pharmacist need?) | Phase 5 |
| Vaccine list + eligibility rules | Phase 6 |
| Appointment duration, cancellation, rescheduling rules | Phase 6 |
| Prescription file types/size limits + who can view PHI | Phase 5/9 |
| Admin role-to-permission bundles (what can PHARMACIST vs STAFF do?) | Admin panel |

---

## Admin Panel & Frontend — After Backend Phases 3–6

Both `admin/` and `frontend/` are **separate Next.js apps** (own `package.json`) that consume the Express API. Neither has been wired to the new backend yet.

**Admin panel** (`admin/`) needs:
- RBAC management UI (roles, permissions)
- User management, audit log viewer
- Ecommerce management (products, orders, coupons)
- Healthcare workflow management (prescriptions, compounding, appointments)

**Frontend** (`frontend/`) needs:
- Strip all Server Actions + Drizzle/PostgreSQL code
- Replace with TanStack Query + Zustand + axios calling the Express API
- Patient portal: prescriptions, compounding, appointments, ask-pharmacist, minor ailments

---

## Key File Locations

| File | What it is |
|------|-----------|
| `CLAUDE.md` | Project rules, tech stack, confirmed decisions, open questions |
| `worklog.md` | Running session history |
| `worklog/2026-10-09c.md` | Most recent session detail (Phase 3 catalogue implementation) |
| `specs/003-ecommerce-catalogue/tasks.md` | Phase 3 task checklist (T057, T060–T062 still need live DB) |
| `docs/MediSyn_Backend_Master_Prompt_Claude.md` | Full backend scope + module specs |
| `docs/MediSyn_Claude_Design_Requirements_Handoff.md` | UX + design requirements |

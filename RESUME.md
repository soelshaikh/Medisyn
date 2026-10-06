# MediSyn — Resume Point
_Last updated: 2026-10-06_

---

## Where We Are

| App | Status |
|-----|--------|
| `backend/` Express API | Phase 1 ✅ + Phase 2 ✅ (code done, tests need Docker to run) |
| `admin/` Next.js admin panel | Old code exists — not yet rebuilt/wired to API |
| `frontend/` Next.js patient app | Old code exists — not yet rebuilt/wired to API |

---

## Immediate Next Step — Close Phase 2 (15 min)

Install **Docker Desktop**, then:

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Run migrations + seeds (from backend/)
npm run db:migrate
npm run db:seed
npm run db:seed:facilities

# 3. Run all Phase 2 auth tests
npm run test -- tests/auth/
```

Expected: **38 tests green** across register / login / refresh / logout / password-reset / email-verify.

If any fail → fix and rerun before moving to Phase 3.

---

## Phase 3 — Start Here After Phase 2 Tests Pass

**Ecommerce Catalogue** — products, categories, inventory, coupons.

Run spec-kit to begin:
```
/speckit-specify Phase 3 — Ecommerce Catalogue. Products with variants (size/strength), categories (hierarchical), inventory tracking per facility, coupons (fixed/percent, usage limits, expiry). Admin CRUD for all. Uses Phase 1 foundation: Express + PostgreSQL + RLS + JWT auth.
```

---

## Full Remaining Phase Roadmap

| Phase | What Gets Built | Depends On |
|-------|----------------|------------|
| **2** *(close out)* | Run auth tests in Docker | Docker Desktop installed |
| **3** | Products, categories, inventory, coupons | Phase 2 auth ✅ |
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
| `worklog/2026-10-06g.md` | Most recent session detail |
| `backend/specs/002-auth-endpoints/tasks.md` | Phase 2 task checklist (T017, T021, T034, T037, T038 still open) |
| `docs/MediSyn_Backend_Master_Prompt_Claude.md` | Full backend scope + module specs |
| `docs/MediSyn_Claude_Design_Requirements_Handoff.md` | UX + design requirements |

# MediSyn — Claude Project Memory

## Project Overview
MediSyn is a Canadian pharmacy/healthcare platform. This repository is the **full-stack Next.js application** (frontend + backend via Server Actions). The two docs files describe the intended product scope — one for backend architecture, one for UX/design.

## Rules for Claude (Non-Negotiable)
- Never guess a material requirement or business rule. If unclear, ask first.
- Give recommendations with reasoning, then ask for confirmation before acting.
- Label every decision: CONFIRMED | PROPOSED | OPEN QUESTION | RESEARCH | ASSUMPTION
- Do not silently change previously confirmed decisions.
- After every meaningful work session, update `worklog.md` and `worklog/YYYY-MM-DD.md`.
- Before starting a new task, review the relevant previous worklog.
- If you need a decision from the user, stop and ask rather than inventing an answer.

## Source of Truth Files
- `docs/MediSyn_Backend_Master_Prompt_Claude.md` — backend scope, modules, architecture, permissions
- `docs/MediSyn_Claude_Design_Requirements_Handoff.md` — UX/design requirements, visual direction, IA

## Tech Stack (CONFIRMED — 2026-09-17)

### Backend (NEW — to be built, lives in `/backend` folder — monorepo)
- **Runtime**: Node.js
- **Framework**: Express.js (CONFIRMED 2026-09-17)
- **Database**: MongoDB Atlas + Mongoose
- **Auth**: JWT (access + refresh tokens), Argon2 password hashing
- **Queue**: Redis + BullMQ (async email/notification processing)
- **File Storage**: S3-compatible private storage (abstracted via FileStorageService)
- **API**: REST, /api/v1 base path, Swagger/OpenAPI docs
- **Language**: TypeScript strict (no .js application files)

### Repo Structure (CONFIRMED 2026-09-17 — Monorepo)
```
/ (repo root)
├── frontend/    ← Patient-facing Next.js app (medisyn.ca)
│   ├── src/     ← pages, components, UI only — NO Server Actions, NO DB code
│   ├── package.json
│   └── ...
├── backend/     ← Express.js REST API (Node.js + MongoDB)
│   ├── src/
│   ├── package.json
│   └── ...
├── admin/       ← Admin panel Next.js app (admin.medisyn.ca) — CONFIRMED separate
│   ├── src/     ← existing /admin pages moved here + rebuilt with full RBAC
│   ├── package.json
│   └── ...
├── CLAUDE.md
├── worklog.md
└── worklog/
```
All three folders are fully independent — separate package.json, separate installs, separate dev servers.

> CONFIRMED 2026-09-17:
> - Existing Next.js files move into frontend/ (clean break)
> - All Server Actions, DB code (Drizzle/PostgreSQL), and backend lib files stripped from frontend
> - Frontend becomes pure UI layer — all data via REST API calls to Express backend
> - Both frontend/ and backend/ are fully independent (separate package.json, separate installs)
> - No root-level workspace scripts

### Frontend (EXISTING — to be adapted)
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **API consumption**: Will call NestJS REST API instead of Server Actions

### Architecture
- Decoupled: NestJS backend API ← → Next.js frontend
- Next.js Server Actions will be replaced with REST API calls to NestJS
- Current PostgreSQL schema is reference only — MongoDB collections are the new data model

> OPEN QUESTION: Will the NestJS backend live in this same repository (monorepo)
> or in a separate repository? Needs user confirmation before scaffolding begins.

## Current Database Schema (as of 2026-09-17)
Tables in `src/db/schema.ts`:
- `users` — flat `role` varchar (patient | clinic | pharmacy_partner | admin) + `adminRole` varchar (super_admin | pharmacist | staff | content_manager | product_manager)
- `sessions`
- `patientProfiles`
- `clinicProfiles`
- `pharmacyPartnerProfiles`
- `prescriptionRequests`
- `askPharmacistRequests`
- `appointmentRequests`
- `minorAilmentRequests`
- `notifications`
- `faqs`
- `adminAuditLog`
- `contactMessages`
- `newsletterSubscribers`

## What Is Already Built
### Pages/Routes
- Public: `/`, `/about`, `/faq`, `/contact`, `/services`, `/how-it-works`
- Auth: `/login`, `/register`, `/register/clinic`, `/register/pharmacy-partner`, `/forgot-password`, `/reset-password`, `/verify-email`
- Patient portal: `/patient` (dashboard), `/patient/prescriptions`, `/patient/ask-a-pharmacist`, `/patient/minor-ailments`, `/patient/appointments`, `/patient/profile`
- Admin portal: `/admin` (dashboard), `/admin/clinics`, `/admin/clinics/[id]`, `/admin/patients`, `/admin/patients/[id]`, `/admin/pharmacy-partners`, `/admin/pharmacy-partners/[id]`, `/admin/prescriptions`, `/admin/prescriptions/[id]`, `/admin/ask-a-pharmacist`, `/admin/ask-a-pharmacist/[id]`
- Clinic portal: `/clinic`, `/clinic/profile`
- Partner portal: `/partner`, `/partner/profile`

### Server Actions (`src/actions/`)
- `auth.ts` — login, register (patient/clinic/partner), verify email, forgot/reset password
- `admin.ts` — admin operations
- `clinic.ts`, `partner.ts`, `patient.ts` — portal-specific actions

### Infrastructure
- `src/lib/auth.ts` — session management, getCurrentUser()
- `src/lib/mailer.ts` — email sending (direct, not queued)
- `src/lib/validation.ts` — input validation helpers

## Critical Gaps (vs Requirements)
1. **RBAC**: Flat role strings → needs proper `roles`, `permissions`, `role_permissions`, `user_roles` tables + admin UI
2. **Admin RBAC UI**: No roles/permissions management in admin panel
3. **Compounding Requests**: Not a separate module — must be distinct from prescriptions
4. **Ecommerce**: Entirely missing — products, categories, inventory, cart, orders, coupons
5. **Appointments**: Simple request form only — needs vaccine service catalog, availability slots, STRICT/OPEN capacity, concurrency-safe booking
6. **File Storage**: Files stored as base64 text in DB columns — must move to S3/R2 private storage
7. **Email Queue**: Direct synchronous sends — needs async queue + email log
8. **Status History**: No history tables for any request/order/appointment status changes
9. **Minor Ailments**: Hardcoded options — needs configurable DB catalog
10. **Reports/Analytics**: Nothing exists
11. **Compounding module**: Entirely absent

## Open Questions (Unresolved)
- [ ] OPEN QUESTION: Exact patient registration fields required
- [ ] OPEN QUESTION: Minor Ailment service list
- [ ] OPEN QUESTION: Vaccine list and eligibility
- [ ] OPEN QUESTION: Appointment duration, cancellation, rescheduling rules
- [ ] OPEN QUESTION: Prescription file types/size limits
- [ ] OPEN QUESTION: Payment gateway (out of scope for now — but what payment methods at launch?)
- [ ] OPEN QUESTION: Shipping/tax rules by province
- [ ] OPEN QUESTION: Who can view PHI / prescription files
- [ ] OPEN QUESTION: Data retention and storage requirements
- [ ] OPEN QUESTION: Admin role-to-permission bundles (PHARMACIST, STAFF, etc.) — user to define later
- [ ] OPEN QUESTION: Admin roles and permission assignments — to be defined by user later. CONFIRMED approach: permissions-based (not hardcoded role checks). Roles are groupings of permissions; exact permission bundles per role TBD.
- [ ] OPEN QUESTION: Ecommerce is CONFIRMED for MVP1 — but exact product restrictions, shipping/tax rules by province TBD
- [ ] OPEN QUESTION: Exact patient registration fields required
- [ ] OPEN QUESTION: Minor Ailment service list
- [ ] OPEN QUESTION: Vaccine list and eligibility
- [ ] OPEN QUESTION: Appointment duration, cancellation, rescheduling rules
- [ ] OPEN QUESTION: Prescription file types/size limits
- [ ] OPEN QUESTION: Payment gateway (currently out of scope per docs)
- [ ] OPEN QUESTION: Shipping/tax rules by province
- [ ] OPEN QUESTION: Who can view PHI / prescription files (PHI access rules)
- [ ] OPEN QUESTION: Data retention and storage requirements

## Frontend Architecture Standards (CONFIRMED 2026-09-17 — applies to both frontend/ and admin/)

### Data Fetching — TanStack Query
- ALL API calls go through TanStack Query (useQuery, useMutation)
- No direct fetch() calls inside components
- API functions live in `src/api/` (one file per domain)
- Query hooks live in `src/hooks/` (one file per domain, wraps api/ functions)
- Centralized `apiClient` (axios instance) with auth token injection + error handling

### State Management — Zustand
- Client state only in Zustand (auth session, UI state, cart, modals)
- Server state (data from API) always in TanStack Query — never duplicated in Zustand
- Stores in `src/stores/` — one store per concern

### CSS Architecture — Design Tokens (NO raw CSS in components)
- ALL design values defined as CSS custom properties in `src/styles/tokens.css`
- Tokens cover: colors, spacing, typography, border-radius, shadows, transitions, z-index
- Tailwind v4 configured to reference these tokens (not hardcoded values like `blue-500`)
- Components never use hardcoded colors or magic numbers
- Changing a token cascades everywhere automatically

#### MediSyn Design Token System (PROPOSED — from design doc)
```css
/* Brand Colors */
--color-primary:        #1677A8   /* Healthcare blue — main CTA, nav, links */
--color-primary-dark:   #0B6FA4   /* Hover states */
--color-primary-light:  #E8F4FB   /* Backgrounds, hover tints */
--color-accent:         #F2C14E   /* Warm yellow — used sparingly */
--color-accent-dark:    #D4A832   /* Accent hover */

/* Neutrals */
--color-white:          #FFFFFF
--color-surface:        #F7F9FB   /* Page background, card surfaces */
--color-border:         #E2E8F0   /* Dividers, input borders */
--color-text-primary:   #1A202C   /* Dark charcoal — body text */
--color-text-secondary: #4A5568   /* Muted text, labels */
--color-text-muted:     #718096   /* Placeholder, helper text */

/* Semantic */
--color-success:        #22C55E
--color-success-light:  #F0FDF4
--color-warning:        #F59E0B
--color-warning-light:  #FFFBEB
--color-error:          #EF4444
--color-error-light:    #FEF2F2
--color-info:           #3B82F6
--color-info-light:     #EFF6FF

/* Typography */
--font-sans:     'Inter', system-ui, sans-serif
--font-size-xs:  0.75rem    /* 12px */
--font-size-sm:  0.875rem   /* 14px */
--font-size-md:  1rem        /* 16px */
--font-size-lg:  1.125rem   /* 18px */
--font-size-xl:  1.25rem    /* 20px */
--font-size-2xl: 1.5rem     /* 24px */
--font-size-3xl: 1.875rem   /* 30px */
--font-size-4xl: 2.25rem    /* 36px */

/* Spacing scale */
--space-1: 0.25rem   /* 4px  */
--space-2: 0.5rem    /* 8px  */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-5: 1.25rem   /* 20px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-10: 2.5rem   /* 40px */
--space-12: 3rem     /* 48px */
--space-16: 4rem     /* 64px */

/* Border radius */
--radius-sm:   0.25rem   /* 4px  — inputs, small badges */
--radius-md:   0.5rem    /* 8px  — cards, buttons */
--radius-lg:   0.75rem   /* 12px — modals, panels */
--radius-xl:   1rem      /* 16px — large cards */
--radius-full: 9999px    /* pills, avatars */

/* Shadows */
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow-md:  0 4px 6px rgba(0,0,0,0.07)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.08)
--shadow-xl:  0 20px 25px rgba(0,0,0,0.10)

/* Transitions */
--transition-fast:   150ms ease
--transition-base:   200ms ease
--transition-slow:   300ms ease

/* Z-index scale */
--z-base:    0
--z-sticky:  100
--z-drawer:  200
--z-modal:   300
--z-toast:   400
--z-tooltip: 500
```
> OPEN QUESTION: Color values above are from the design doc suggestions — need final brand validation before production. Confirm or adjust before component build begins.

### Component Architecture — No Code Duplication
```
src/components/
├── ui/          ← Atomic: Button, Input, Select, Modal, Badge, Table, Tabs, Avatar, Spinner, etc.
├── common/      ← Patterns: PageHeader, DataTable, StatusBadge, FormField, EmptyState, etc.
└── features/    ← Domain: PrescriptionCard, ProductCard, AppointmentSlot, etc.
```
- ui/ components are generic, reusable, token-aware
- common/ components are shared patterns across features
- features/ components are domain-specific, use ui/ + common/ internally
- ZERO style duplication — extract a common component before repeating anything twice

### Folder Structure (both frontend/ and admin/)
```
src/
├── app/           ← Next.js App Router pages + layouts
├── components/
│   ├── ui/
│   ├── common/
│   └── features/
├── api/           ← API endpoint functions (domain-grouped)
├── hooks/         ← TanStack Query hooks (domain-grouped)
├── stores/        ← Zustand stores
├── styles/
│   ├── tokens.css ← ALL CSS custom properties live here
│   └── globals.css
├── types/         ← TypeScript interfaces shared across the app
└── lib/           ← utilities, formatters, constants, helpers
```

## Confirmed Decisions
- CONFIRMED (2026-09-17): Backend stack — Node.js + Express.js + MongoDB Atlas + Mongoose
- CONFIRMED (2026-09-17): NestJS explicitly rejected
- CONFIRMED (2026-09-17): Monorepo — frontend/, backend/, admin/ folders, all fully independent
- CONFIRMED (2026-09-17): TanStack Query for all API calls in frontend + admin
- CONFIRMED (2026-09-17): Zustand for client state in frontend + admin
- CONFIRMED (2026-09-17): CSS design token system — all values in tokens.css, no raw CSS in components
- CONFIRMED (2026-09-17): Component architecture — ui/ + common/ + features/ layers, zero duplication
- CONFIRMED (2026-09-17): Design system with color tokens (see design token spec below)
- CONFIRMED (2026-09-17): Admin panel is a separate Next.js app in admin/ (not inside frontend/)
- CONFIRMED (2026-09-17): Existing /admin pages move from current Next.js app → admin/ folder
- CONFIRMED (2026-09-17): Clean break — frontend strips all Server Actions, Drizzle, PostgreSQL immediately
- CONFIRMED (2026-09-17): No root-level workspace — each folder has its own package.json and install
- CONFIRMED (2026-09-17): Frontend stays Next.js, consumes NestJS REST API
- CONFIRMED (2026-09-17): Ecommerce (products, cart, orders, coupons) is in MVP1
- CONFIRMED (2026-09-17): Admin permissions-based access — no hardcoded role checks. Exact role-to-permission bundles TBD later.
- CONFIRMED: Modular monolith architecture (no microservices)
- CONFIRMED: All application source files in TypeScript (strict, no .js)
- CONFIRMED: Online payment gateway NOT in current scope
- CONFIRMED: Compounding must be a separate module from Prescriptions
- CONFIRMED: Files must NOT be stored as base64 in the database — use private S3-compatible storage
- CONFIRMED: All commercial totals calculated server-side (never trust frontend)
- CONFIRMED: Internal admin notes must never be exposed to customers
- CONFIRMED: RBAC — permissions determine access, not raw role checks
- CONFIRMED: Status history required for all major operational domains (orders, prescriptions, compounding, appointments)

## Phase Plan (PROPOSED — not yet confirmed by user)
| Phase | Focus | Key Deliverables |
|---|---|---|
| 1 | NestJS Foundation + Auth + RBAC | Project scaffold, MongoDB, Auth (JWT), Users, Roles, Permissions |
| 2 | Admin Panel Core | Admin user mgmt, RBAC management UI, audit log, dashboard |
| 3 | Ecommerce Catalogue | Products, categories, inventory, coupons |
| 4 | Ecommerce Commerce | Cart (guest+auth), checkout, orders, order management |
| 5 | Healthcare Workflows | Compounding, enhanced prescriptions, ask-pharmacist, minor ailments, status histories |
| 6 | Appointments | Vaccine services, availability slots, STRICT/OPEN booking, concurrency |
| 7 | Async Infrastructure | Redis/BullMQ, email queue, email templates, notifications |
| 8 | Reports & Dashboard | Sales, orders, customers, dashboard metrics |
| 9 | File Storage | S3/R2 abstraction, migrate file uploads, signed URLs |
| 10 | Hardening | Rate limiting, security, tests, OpenAPI cleanup, performance |

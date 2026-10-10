# Data Model: Healthcare Workflows

**Feature**: 005-healthcare-workflows | **Date**: 2026-10-10

All tables are facility-scoped (`facility_id` FK → `facilities CASCADE`), RLS-enabled with `current_facility_id()` policy, and added to `backend/src/db/schema/healthcare.ts`.

---

## Tables

### 1. `prescription_requests`

Patient-submitted prescription requests (refills, transfers, new prescriptions).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID PK | DEFAULT gen_random_uuid() | |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE RESTRICT | |
| `patient_id` | UUID FK → users | NOT NULL, ON DELETE RESTRICT | |
| `type` | TEXT | NOT NULL, CHECK IN ('refill','transfer','new') | |
| `medication_name` | TEXT | NOT NULL, max 200 chars | |
| `dosage` | TEXT | nullable, max 100 chars | |
| `prescriber_name` | TEXT | nullable, max 200 chars | |
| `prescriber_fax` | TEXT | nullable, max 30 chars | |
| `file_reference` | TEXT | nullable | S3 key or URL — Phase 9 wires actual storage |
| `status` | TEXT | NOT NULL, DEFAULT 'submitted' | enum: see state machine |
| `dispense_notes` | TEXT | nullable | visible to patient |
| `internal_notes` | TEXT | nullable | NEVER returned in patient-facing responses |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**State machine**:
```
submitted → under_review → approved | declined
submitted → approved | declined   (skip under_review)
```
Terminal states: `approved`, `declined`

**Indexes**: `(facility_id, patient_id)`, `(facility_id, status)`, `(facility_id, created_at DESC)`

---

### 2. `prescription_request_history`

Append-only status log for prescription requests. **REVOKE UPDATE, DELETE** from all app roles.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | |
| `request_id` | UUID FK → prescription_requests | NOT NULL, ON DELETE CASCADE |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE RESTRICT |
| `previous_status` | TEXT | nullable (null on first entry) |
| `new_status` | TEXT | NOT NULL |
| `changed_by_id` | UUID FK → users | nullable, ON DELETE SET NULL |
| `note` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

---

### 3. `compounding_requests`

Patient-submitted custom compound medication requests.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID PK | | |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE RESTRICT | |
| `patient_id` | UUID FK → users | NOT NULL, ON DELETE RESTRICT | |
| `compound_name` | TEXT | NOT NULL, max 200 chars | |
| `strength` | TEXT | nullable, max 100 chars | e.g., "10mg/mL" |
| `form` | TEXT | NOT NULL, CHECK IN ('tablet','capsule','liquid','cream','suppository','other') | |
| `quantity` | TEXT | NOT NULL, max 100 chars | e.g., "100 capsules", "60mL" |
| `special_instructions` | TEXT | nullable | |
| `prescriber_name` | TEXT | nullable, max 200 chars | |
| `file_reference` | TEXT | nullable | |
| `quoted_price` | NUMERIC(10,2) | nullable | set by pharmacist |
| `quoted_turnaround_days` | INTEGER | nullable, CHECK ≥ 0 | set by pharmacist |
| `status` | TEXT | NOT NULL, DEFAULT 'submitted' | enum: see state machine |
| `internal_notes` | TEXT | nullable | NEVER in patient responses |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**State machine**:
```
submitted → under_review → quoted → accepted → ready → completed
                                  → patient_declined
quoted → patient_declined   (patient rejects quote)
declined reachable from: submitted | under_review | quoted
```
Terminal states: `completed`, `declined`, `patient_declined`

**Indexes**: `(facility_id, patient_id)`, `(facility_id, status)`, `(facility_id, created_at DESC)`

---

### 4. `compounding_request_history`

Append-only status log for compounding requests. **REVOKE UPDATE, DELETE** from all app roles.

Same column structure as `prescription_request_history` with FK → `compounding_requests`.

---

### 5. `minor_ailment_catalog`

Admin-managed list of treatable ailments. Facility-scoped so each pharmacy can enable/disable independently.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID PK | |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE CASCADE |
| `name` | TEXT | NOT NULL, max 150 chars |
| `description` | TEXT | nullable |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT true |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Unique**: `(facility_id, name)` — case-insensitive uniqueness enforced at service layer.

**Seed**: 19 Ontario model ailments inserted per facility by `healthcare-permissions.ts` seed script.

---

### 6. `minor_ailment_requests`

Patient-submitted assessments for minor ailment services.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID PK | | |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE RESTRICT | |
| `patient_id` | UUID FK → users | NOT NULL, ON DELETE RESTRICT | |
| `ailment_id` | UUID FK → minor_ailment_catalog | NOT NULL, ON DELETE RESTRICT | |
| `symptoms` | TEXT | NOT NULL | min 10 chars |
| `duration` | TEXT | NOT NULL, max 200 chars | e.g., "3 days", "2 weeks" |
| `current_medications` | TEXT | nullable | |
| `health_history` | TEXT | nullable | |
| `treatment_note` | TEXT | nullable | written by pharmacist; VISIBLE to patient |
| `internal_notes` | TEXT | nullable | NEVER in patient responses |
| `status` | TEXT | NOT NULL, DEFAULT 'submitted' | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**State machine**:
```
submitted → under_review → treated | referred
submitted → treated | referred   (skip under_review)
```
Terminal states: `treated`, `referred`

---

### 7. `minor_ailment_request_history`

Append-only status log. **REVOKE UPDATE, DELETE**. FK → `minor_ailment_requests`.

---

### 8. `pharmacist_conversations`

Ask-a-pharmacist conversation threads.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID PK | | |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE RESTRICT | |
| `patient_id` | UUID FK → users | NOT NULL, ON DELETE RESTRICT | |
| `subject` | TEXT | NOT NULL, max 200 chars | |
| `medication_name` | TEXT | nullable, max 200 chars | optional context |
| `assigned_to` | UUID FK → users | nullable, ON DELETE SET NULL | assigned pharmacist |
| `status` | TEXT | NOT NULL, DEFAULT 'open' | |
| `internal_notes` | TEXT | nullable | NEVER in patient responses |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**State machine**:
```
open → in_progress → resolved | closed
open → resolved | closed   (admin fast-close)
```
Terminal states: `resolved`, `closed`

---

### 9. `conversation_messages`

Individual messages in a pharmacist conversation. Append-only — no UPDATE or DELETE.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID PK | | |
| `conversation_id` | UUID FK → pharmacist_conversations | NOT NULL, ON DELETE CASCADE | |
| `facility_id` | UUID FK → facilities | NOT NULL, ON DELETE RESTRICT | |
| `sender_id` | UUID FK → users | NOT NULL, ON DELETE RESTRICT | |
| `sender_type` | TEXT | NOT NULL, CHECK IN ('patient','staff') | |
| `body` | TEXT | NOT NULL, min 10 chars | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**REVOKE UPDATE, DELETE** — messages are immutable once sent.

**Indexes**: `(conversation_id, created_at ASC)` — for ordered message loading.

---

## Error Codes (new — to add to `errors.ts`)

```typescript
// Healthcare — prescriptions
| 'PRESCRIPTION_REQUEST_NOT_FOUND'
// Healthcare — compounding
| 'COMPOUNDING_REQUEST_NOT_FOUND'
// Healthcare — minor ailments
| 'AILMENT_NOT_FOUND'
| 'AILMENT_INACTIVE'
| 'AILMENT_NAME_EXISTS'
// Healthcare — ask-a-pharmacist
| 'CONVERSATION_NOT_FOUND'
| 'CONVERSATION_CLOSED'
// Healthcare — shared
| 'HEALTHCARE_INVALID_STATUS_TRANSITION'
```

> Note: `HEALTHCARE_INVALID_STATUS_TRANSITION` is a distinct code from `INVALID_STATUS_TRANSITION` (used by orders) to allow frontend differentiation.

---

## Migration: `0004_healthcare_workflows.sql`

Creates all 9 tables with:
- FK constraints (DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$ pattern)
- CHECK constraints for enum columns
- RLS ENABLE + facility_isolation policy on all 9 tables
- REVOKE UPDATE, DELETE on history tables (`prescription_request_history`, `compounding_request_history`, `minor_ailment_request_history`, `conversation_messages`)
- GRANT SELECT, INSERT, UPDATE on request tables; GRANT SELECT, INSERT on history + messages tables
- Indexes

---

## Permissions Seed: `0005_healthcare_permissions.ts`

8 permissions under `healthcare` platform module:
- `prescriptions.read`, `prescriptions.manage`
- `compounding.read`, `compounding.manage`
- `minor-ailments.read`, `minor-ailments.manage`
- `ask-pharmacist.read`, `ask-pharmacist.manage`

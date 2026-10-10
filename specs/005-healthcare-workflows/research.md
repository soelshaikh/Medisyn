# Research: Healthcare Workflows

**Feature**: 005-healthcare-workflows | **Date**: 2026-10-10

All decisions below are drawn from existing codebase patterns, Canadian pharmacy regulations, and established architectural constraints. No external unknowns required resolution.

---

## Decision 1: Append-Only Status History Pattern

**Decision**: Each module gets its own `*_request_history` table (4 tables total). The DB migration REVOKEs UPDATE and DELETE on all four history tables from `app_user` and `app_super_admin`. The schema mirrors the `order_status_history` pattern from Phase 4.

**Rationale**: Healthcare status transitions are audit-critical. The append-only guarantee must be enforced at the database privilege level, not just application logic. Separate tables per module give cleaner indexes and avoid a single mega-history table with a discriminator column (which would complicate RLS and partial indexes).

**Alternatives considered**: Single shared `request_status_history` table with a `request_type` discriminator — rejected because it complicates RLS policies, requires composite partial indexes, and creates coupling between unrelated modules.

---

## Decision 2: State Machines

**Decision**: Each module defines a `VALID_TRANSITIONS` constant (same pattern as `VALID_TRANSITIONS` in `order.types.ts`) and a `validateStatusTransition(current, next)` function that throws `INVALID_STATUS_TRANSITION` on violation.

**Prescription transitions**: `submitted → under_review → approved | declined`; also `submitted → approved | declined` (skip under_review).

**Compounding transitions**: `submitted → under_review → quoted → accepted → ready → completed`; also `quoted → patient_declined`; `declined` reachable from `submitted | under_review | quoted`.

**Minor ailment transitions**: `submitted → under_review → treated | referred`; also `submitted → treated | referred` (skip under_review).

**Ask-a-pharmacist transitions**: `open → in_progress → resolved | closed`; also `open → resolved | closed`.

**Rationale**: The VALID_TRANSITIONS pattern is already proven from Phase 4. Consistent validation function name across all modules makes the codebase easier to navigate.

**Alternatives considered**: Database CHECK constraints for status values — useful but insufficient alone; application-layer state machine is needed to validate transitions (not just valid enum values).

---

## Decision 3: Internal Notes Isolation

**Decision**: All request tables include an `internal_notes` column (TEXT nullable). Service-layer response builders have two shapes per module: `PatientView` (omits `internalNotes`) and `AdminView` (includes `internalNotes`). Patient-facing service methods return `PatientView`; admin-facing service methods return `AdminView`. The `internalNotes` field is never passed through the patient router under any circumstances.

**Rationale**: Constitution Principle IV requires PHI and sensitive clinical notes to never reach patients. Enforcing this at the service layer (rather than only in the router) provides defense in depth.

**Alternatives considered**: Runtime field deletion in router middleware — fragile, depends on correct filtering every time. Service-level typed separation is safer and verifiable at compile time.

---

## Decision 4: File References

**Decision**: Prescription and compounding requests include a `file_reference` column (TEXT nullable). Phase 5 accepts and stores whatever string the client provides (no validation that it points to a real file). The actual signed-URL upload/download infrastructure is built in Phase 9.

**Rationale**: Forcing S3/R2 integration into Phase 5 would block all four healthcare modules on infrastructure work. A plain reference string allows the data model and workflow to be built and tested now; Phase 9 wires the actual storage.

**Alternatives considered**: Base64 in DB — explicitly rejected by architecture ("Files must NOT be stored as base64 in the database"). File upload blocked until Phase 9 — would delay all pharmacy workflows; reference-only approach is the clean incremental path.

---

## Decision 5: Minor Ailment Catalog Scope

**Decision**: `minor_ailment_catalog` is facility-scoped (`facility_id` FK). The seed script inserts the 19 Ontario model ailments for each test facility. Different facilities may independently activate/deactivate ailments. Province-specific eligibility rules are out of scope for Phase 5.

**Ontario 19 Ailments** (CONFIRMED by user — seed list):
1. Acne
2. Allergic Rhinitis
3. Oral Candidiasis (Thrush)
4. Conjunctivitis (Pink Eye)
5. Contact Dermatitis
6. Dysmenorrhea (Menstrual Cramps)
7. Gastroesophageal Reflux Disease (GERD)
8. Hemorrhoids
9. Herpes Labialis (Cold Sores)
10. Impetigo
11. Insect Bites and Stings
12. Musculoskeletal Sprains and Strains
13. Tick Bites
14. Uncomplicated Urinary Tract Infection (Women)
15. Urticaria (Hives)
16. Herpes Zoster (Shingles)
17. Nausea and Vomiting of Pregnancy
18. Pinworms/Threadworms
19. Eczema (Atopic Dermatitis)

**Rationale**: Facility-scoped catalog allows MediSyn to support pharmacies in different provinces with different regulated ailment lists without a monolithic global catalog.

**Alternatives considered**: Global catalog (not facility-scoped) — simpler but doesn't accommodate provincial differences or per-pharmacy service offerings.

---

## Decision 6: Ask-a-Pharmacist Conversation Threading

**Decision**: Conversations are stored in `pharmacist_conversations`. Messages are stored in `conversation_messages` (separate table, FK to conversation). Each message has `sender_id`, `sender_type` (patient|staff), `body`, `created_at`. No editing or deleting of messages — append-only. When a conversation is `resolved` or `closed`, new message inserts are rejected at the service layer.

**Rationale**: A separate messages table (vs JSONB array column) allows efficient querying, indexing, RLS enforcement per message, and future features like message search or read receipts. Append-only messages match the platform's immutability-for-clinical-records principle.

**Alternatives considered**: JSONB array in conversations table — simpler schema but prevents row-level security on individual messages, makes querying harder, and complicates pagination of message history.

---

## Decision 7: Permissions Model

**Decision**: 8 new permissions under the `healthcare` platform module:

| Permission Key | Name | Who Uses It |
|---------------|------|-------------|
| `prescriptions.read` | View Prescriptions | Pharmacist, admin |
| `prescriptions.manage` | Manage Prescriptions | Pharmacist |
| `compounding.read` | View Compounding Requests | Pharmacist, admin |
| `compounding.manage` | Manage Compounding Requests | Pharmacist |
| `minor-ailments.read` | View Minor Ailment Assessments | Pharmacist, admin |
| `minor-ailments.manage` | Manage Minor Ailments | Pharmacist + catalog admin |
| `ask-pharmacist.read` | View Pharmacist Conversations | Pharmacist, admin |
| `ask-pharmacist.manage` | Manage Pharmacist Conversations | Pharmacist |

Patient endpoints (submit, view own, cancel own) require only standard `authMiddleware` — no additional permission. Access is enforced by `patient_id = auth.userId` check in queries.

**Rationale**: Consistent with the permission model used for `orders.read` / `orders.manage` in Phase 4. Separating read and manage allows admin-only observers (no clinical actions) without granting write access.

---

## Decision 8: PHI Audit Logging

**Decision**: The following operations MUST write an audit log entry (constitution Principle IV):

- Patient submits a prescription/compounding request containing a `file_reference` → `prescription.submitted` / `compounding.submitted`
- Admin/pharmacist reads a prescription request with a file reference → `prescription.file_accessed`
- Admin/pharmacist reads a compounding request with a file reference → `compounding.file_accessed`
- Any status change on any healthcare request → `<module>.status_changed`
- Patient views own request detail → no audit needed (non-PHI list/view by the data owner)

**Rationale**: Constitution Principle IV explicitly lists "PHI access (prescription file downloads)" as a mandatory audit category. File references (even before Phase 9 delivers actual signed URLs) are treated as PHI pointers.

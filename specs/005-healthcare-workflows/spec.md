# Feature Specification: Healthcare Workflows

**Feature Branch**: `005-healthcare-workflows`

**Created**: 2026-10-10

**Status**: Draft

**Input**: Phase 5 — Four healthcare request modules for the MediSyn Canadian pharmacy platform backend.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Enhanced Prescription Requests (Priority: P1)

A patient needs a prescription filled, refilled, or transferred to MediSyn. They submit a request with their prescription details (and optionally a scanned file reference), the pharmacist reviews it, and either approves with dispense notes or declines with a reason. The patient can see the current status of their request at any time. Every status change is recorded in an immutable history log.

**Why this priority**: Prescription processing is the core workflow of any pharmacy. Without it, no other healthcare service has context. It is the highest-volume patient interaction.

**Independent Test**: A patient submits a prescription refill request. The request appears in the admin queue with status `submitted`. A pharmacist approves it and adds dispense notes. The patient sees the status update to `approved` and can read the dispense notes. The patient cannot see the pharmacist's internal notes. A second pharmacist attempt to approve an already-approved request is rejected.

**Acceptance Scenarios**:

1. **Given** a patient is authenticated, **When** they submit a prescription request (type: refill, medication name, dosage, prescriber name, and optionally a file reference), **Then** a new request is created with status `submitted` and a status history entry is appended.
2. **Given** a prescription request is in `submitted` status, **When** a pharmacist approves it with dispense notes, **Then** status changes to `approved`, a status history entry is appended, and dispense notes are stored.
3. **Given** a prescription request is in `submitted` status, **When** a pharmacist declines it with a reason, **Then** status changes to `declined` and a status history entry is appended.
4. **Given** a patient views their prescription request, **Then** internal pharmacist notes are never included in the response.
5. **Given** a prescription request is in `approved` status, **When** the pharmacist attempts to approve it again, **Then** the request is rejected with an invalid status transition error.
6. **Given** an admin views the prescription queue, **When** filtering by status and date range, **Then** only matching requests are returned with pagination.

---

### User Story 2 — Compounding Requests (Priority: P2)

A patient needs a custom compound medication (a medication formulated specifically for them — e.g., specific strength, alternative form, allergen-free version). They submit a compounding request with the desired formulation details and an optional prescription file reference. The pharmacist reviews the request, assesses feasibility, and provides a quote (price, estimated turnaround). The patient must explicitly accept or reject the pharmacist's quote before preparation begins. This protects the patient from unexpected charges and requires a patient-facing "accept quote" action.

**Why this priority**: Compounding is explicitly a separate module from standard prescriptions (architectural requirement). It is a key differentiator for MediSyn and requires a distinct workflow.

**Independent Test**: A patient submits a compounding request with formulation details. It appears in the admin compounding queue as `submitted`. A pharmacist reviews it and submits a quote (price + turnaround days). The request moves to `quoted` status. The patient receives no internal notes. The full status history shows the progression.

**Acceptance Scenarios**:

1. **Given** a patient is authenticated, **When** they submit a compounding request (compound name, desired strength, form — tablet/capsule/liquid/cream/other, quantity, special instructions, optional prescriber name, optional file reference), **Then** a new compounding request is created with status `submitted`.
2. **Given** a compounding request is in `submitted` status, **When** a pharmacist submits a quote (quoted price, estimated turnaround in days, pharmacist notes), **Then** status changes to `quoted` and a status history entry is appended.
3. **Given** a compounding request is in `quoted` status, **When** the patient accepts the quote, **Then** status changes to `accepted` and a status history entry is appended.
3b. **Given** a compounding request is in `quoted` status, **When** the patient declines the quote, **Then** status changes to `patient_declined` and a status history entry is appended.
4. **Given** a compounding request is in any active status, **When** a pharmacist marks it as `ready`, **Then** status changes to `ready` and a status history entry is appended.
5. **Given** a compounding request is in `submitted` or `quoted` status, **When** the pharmacist marks it as `declined`, **Then** status changes to `declined` with a reason and status history is appended.
6. **Given** a patient views their compounding request, **Then** pharmacist internal notes are never returned to the patient.

---

### User Story 3 — Minor Ailments (Priority: P3)

Minor ailment services allow pharmacists to assess and treat a regulated list of common conditions without a physician visit. A patient submits an assessment for a specific ailment from a configurable catalog, providing their symptoms and relevant health history. The pharmacist reviews the assessment and either provides a treatment (writes a treatment note, which may include a recommendation) or refers the patient to a physician.

The ailment catalog is managed in the database — new ailments can be added or deactivated by admins without a code deployment.

**Why this priority**: Minor ailments services are a regulated, value-added offering. The DB-driven catalog prevents hardcoded lists from becoming outdated as provincial regulations evolve.

**Independent Test**: An admin creates a new ailment in the catalog (e.g., "Allergic Rhinitis"). A patient submits an assessment for that ailment with symptom details. A pharmacist reviews the assessment and marks it as `treated` with a treatment note. The patient sees status `treated`. A patient cannot submit an assessment for a deactivated ailment. The ailment catalog can be listed by any user (public endpoint — patients need to know what's available).

**Acceptance Scenarios**:

1. **Given** an admin is authenticated with the appropriate permission, **When** they create a new ailment (name, description, active status), **Then** the ailment is available in the catalog for patient submissions.
2. **Given** an active ailment exists in the catalog, **When** a patient submits an assessment (ailment ID, symptoms description, duration, current medications, relevant health history), **Then** a new minor ailment request is created with status `submitted`.
3. **Given** a minor ailment assessment is in `submitted` status, **When** a pharmacist marks it as `treated` with a treatment note, **Then** status changes to `treated` and a status history entry is appended.
4. **Given** a minor ailment assessment is in `submitted` status, **When** a pharmacist marks it as `referred` with a referral note, **Then** status changes to `referred` and a status history entry is appended.
5. **Given** a patient attempts to submit an assessment for a deactivated ailment, **Then** the submission is rejected.
6. **Given** any user requests the ailment catalog, **Then** only active ailments are returned (no auth required to view the catalog).
7. **Given** a patient views their minor ailment assessment, **Then** internal pharmacist notes are never included in the response.

---

### User Story 4 — Ask-a-Pharmacist (Priority: P4)

Patients can submit a medication or health question to the pharmacy. A pharmacist reviews the question and responds. This is a multi-turn conversation: the patient and pharmacist can exchange multiple messages until the conversation is marked resolved. Admins can assign or reassign a conversation to a specific pharmacist. Conversations are private — only the patient who submitted and staff can view them.

**Why this priority**: Ask-a-Pharmacist is a value-add service that builds patient trust. It is lower priority than prescription and compounding workflows which are operationally critical.

**Independent Test**: A patient submits a question. It appears in the admin queue as `open`. A pharmacist is assigned and replies. The patient sees the reply. The patient follows up with another message. The pharmacist resolves the conversation. A different patient cannot access the first patient's conversation.

**Acceptance Scenarios**:

1. **Given** a patient is authenticated, **When** they submit a question (subject, message body, optional medication name), **Then** a new conversation is created with status `open` and an initial message record is created.
2. **Given** a conversation is `open`, **When** a pharmacist replies with a message, **Then** the reply is added to the conversation thread and the patient can see it.
3. **Given** a conversation is `open` or `in_progress`, **When** the patient sends a follow-up message, **Then** the message is added to the thread.
4. **Given** a conversation is `open`, **When** an admin assigns it to a specific pharmacist, **Then** the assigned pharmacist is recorded and the conversation status changes to `in_progress`.
5. **Given** a conversation is `in_progress`, **When** the pharmacist marks it as `resolved`, **Then** the conversation is closed and no further messages can be added.
6. **Given** a patient requests a conversation they do not own, **Then** the system returns 404 (not 403 — do not leak existence).
7. **Given** an admin lists all conversations, **When** filtering by status or assigned pharmacist, **Then** only matching conversations are returned paginated.

---

### Edge Cases

- What if a patient submits a duplicate prescription request for the same medication within 24 hours? (Allowed — no deduplication, but both requests appear in the queue.)
- What if a pharmacist is assigned to an Ask-a-Pharmacist conversation but is later deactivated? (The assignment record remains; the conversation stays `in_progress` until reassigned or resolved.)
- What if an ailment is deactivated while a patient has an active assessment for it? (Existing assessments are unaffected; only new submissions for deactivated ailments are blocked.)
- What if a compounding quote is submitted for a request that was already declined? (Rejected — invalid status transition.)
- What if a patient submits an empty message body to Ask-a-Pharmacist? (Rejected — message body is required, minimum 10 characters.)
- What happens to file references when a prescription or compounding request is cancelled? (File references are retained in the record — the file storage lifecycle is managed in Phase 9.)

---

## Requirements *(mandatory)*

### Functional Requirements

**Cross-cutting (all four modules):**

- **FR-001**: Every request module MUST record an append-only status history entry whenever the request status changes. The history MUST record: previous status, new status, actor who made the change, timestamp, and an optional note.
- **FR-002**: Internal staff notes on any request MUST never be returned in patient-facing API responses. The notes field is staff-only.
- **FR-003**: Every status-changing operation MUST write an entry to the platform audit log with the actor identity, action, resource type, and resource ID.
- **FR-004**: All write operations on request records MUST be protected by RBAC permission checks. Pharmacist-action endpoints require a specific permission (e.g., `prescriptions.manage`). Patient endpoints require only authentication as the owning patient.
- **FR-005**: All admin list endpoints MUST support pagination (page + limit), filtering by status and date range, and return total count for UI pagination controls.
- **FR-006**: Status transitions MUST be validated against a defined state machine per module. Invalid transitions MUST be rejected with a clear error code.

**Prescription Requests:**

- **FR-007**: Patients MUST be able to submit prescription requests of type: `refill`, `transfer`, or `new`.
- **FR-008**: Prescription requests MUST support an optional file reference field (a string — the actual file upload is handled in Phase 9).
- **FR-009**: Status machine: `submitted` → `under_review` → `approved` | `declined`. Pharmacist may also mark `submitted` directly as `approved` or `declined` without an intermediate `under_review` step.
- **FR-010**: Pharmacist MUST be able to add dispense notes (visible to patient) and internal notes (staff only) when approving a prescription request.

**Compounding Requests:**

- **FR-011**: Patients MUST be able to specify compound form: `tablet`, `capsule`, `liquid`, `cream`, `suppository`, or `other`.
- **FR-012**: Pharmacist MUST be able to submit a quote containing: quoted price (decimal), estimated turnaround in days (integer), and pharmacist notes.
- **FR-013**: Status machine: `submitted` → `under_review` → `quoted` → `accepted` | `patient_declined` → `ready` → `completed`. Pharmacist may also decline at any stage: `declined`. Patient accepts or declines the quote via a dedicated patient endpoint.
- **FR-014**: Compounding requests MUST support an optional file reference field (same as prescriptions).

**Minor Ailments:**

- **FR-015**: The ailment catalog MUST be stored in the database and manageable (create, update, deactivate) by admin users without a code change.
- **FR-016**: Patients MUST be able to list active ailments from the catalog (unauthenticated access permitted for catalog browsing).
- **FR-017**: Minor ailment assessments MUST capture: ailment ID, symptoms description (required), duration of symptoms (required), current medications (optional), and relevant health history (optional).
- **FR-018**: Status machine: `submitted` → `under_review` → `treated` | `referred`.
- **FR-019**: Pharmacist treatment notes MUST be stored separately from internal notes. Treatment notes are visible to patients; internal notes are not.

**Ask-a-Pharmacist:**

- **FR-020**: Conversations MUST support multiple messages from both the patient and pharmacist in a threaded model (array of messages with sender type and timestamp).
- **FR-021**: Status machine: `open` → `in_progress` → `resolved` | `closed`. `closed` is for admin-initiated closure (e.g., spam); `resolved` is pharmacist-initiated.
- **FR-022**: Admin MUST be able to assign a conversation to a specific pharmacist (stored as `assigned_to` user ID).
- **FR-023**: Once a conversation is `resolved` or `closed`, no new messages can be added.
- **FR-024**: Patients MAY only view their own conversations. A request for another patient's conversation returns 404.

### Key Entities

- **PrescriptionRequest**: Patient-submitted prescription (type, medication details, file reference, status, dispense notes, internal notes, status history)
- **CompoundingRequest**: Patient-submitted compounding order (compound details, form, file reference, quote, status, internal notes, status history)
- **MinorAilmentCatalog**: Admin-managed list of treatable ailments (name, description, province applicability, active flag)
- **MinorAilmentRequest**: Patient assessment submission (ailment reference, symptoms, duration, medication history, treatment note, internal notes, status history)
- **PharmacistConversation**: Ask-a-Pharmacist thread (subject, assigned pharmacist, status, messages array)
- **ConversationMessage**: Individual message in a conversation thread (sender type: patient|pharmacist|admin, body, timestamp)
- **RequestStatusHistory**: Append-only log entry for any status change across all modules (previous status, new status, actor, timestamp, note)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A patient can submit a prescription refill request and receive a pharmacist response (approved or declined) within the same session — no page reload required.
- **SC-002**: Admin pharmacists can process 50 prescription requests per hour without the system degrading (queue list and status updates remain responsive).
- **SC-003**: Zero internal notes are ever exposed in patient-facing API responses — validated by automated tests that assert the absence of the `internalNotes` field in patient endpoints.
- **SC-004**: Status transitions that violate the state machine are rejected 100% of the time with a clear error code.
- **SC-005**: The minor ailment catalog can be updated (new ailment added, existing deactivated) without any code deployment or server restart.
- **SC-006**: Ask-a-Pharmacist conversations are fully isolated — a patient cannot access another patient's conversation under any circumstances (tested via cross-patient access attempt returning 404).
- **SC-007**: All status-changing operations produce an audit log entry — verified by automated tests checking audit_log after each operation.

---

## Assumptions

- File attachments (prescription scans, compounding prescriptions) are stored as a reference string in Phase 5. The actual signed-URL upload and download mechanism is implemented in Phase 9 (File Storage). Phase 5 accepts and stores the reference string but does not validate it points to a real file.
- All four modules are facility-scoped — all data is isolated by `facility_id` per the platform's tenant isolation rule. Cross-facility access is never permitted.
- The pharmacist role is an admin user with specific permissions (e.g., `prescriptions.manage`, `compounding.manage`, `minor-ailments.manage`, `ask-pharmacist.manage`). The exact user making clinical decisions is always a platform admin user — not a patient.
- Province-specific minor ailment eligibility rules (e.g., Ontario's 19 conditions vs other provinces) are out of scope for Phase 5. The catalog is a flat list; province filtering is a future enhancement.
- Ask-a-Pharmacist conversations are between one patient and pharmacist staff — no multi-patient conversations, no group chats.
- The full Ontario 19-ailment model will be seeded as the default catalog: acne, allergic rhinitis, oral candidiasis, conjunctivitis, contact dermatitis, dysmenorrhea, GERD, hemorrhoids, herpes labialis, impetigo, insect bites and stings, musculoskeletal sprains and strains, tick bites, uncomplicated UTI in women, urticaria, herpes zoster (shingles), cold sores, nausea and vomiting of pregnancy, pinworms/threadworms. Admins can deactivate any that are not offered at their facility.
- No email notifications are sent in Phase 5 — that is Phase 7 (Async Infrastructure / BullMQ email queue).
- Patients cannot delete or withdraw a submitted request — only staff can cancel/decline.

# Tasks: Healthcare Workflows

**Input**: Design documents from `specs/005-healthcare-workflows/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

**Organization**: Tasks grouped by user story â€” each phase is independently testable.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1â€“US4)

---

## Phase 1: Setup

**Purpose**: Error codes, DB schema, migration, permissions seed, and test fixtures. Must complete before any user story begins.

**âš ï¸ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add 8 error codes to `ErrorCode` union in `backend/src/lib/errors.ts` after existing commerce codes: `'PRESCRIPTION_REQUEST_NOT_FOUND'`, `'COMPOUNDING_REQUEST_NOT_FOUND'`, `'AILMENT_NOT_FOUND'`, `'AILMENT_INACTIVE'`, `'AILMENT_NAME_EXISTS'`, `'CONVERSATION_NOT_FOUND'`, `'CONVERSATION_CLOSED'`, `'HEALTHCARE_INVALID_STATUS_TRANSITION'`

- [X] T002 Create `backend/src/db/schema/healthcare.ts` â€” 9 Drizzle table definitions using `pgTable`, all with `facility_id` FK â†’ facilities CASCADE/RESTRICT as appropriate: (1) `prescriptionRequests` (id UUID PK, facility_id RESTRICT, patient_id RESTRICT, type TEXT NOT NULL CHECK IN('refill','transfer','new'), medication_name TEXT NOT NULL, dosage TEXT nullable, prescriber_name TEXT nullable, prescriber_fax TEXT nullable, file_reference TEXT nullable, status TEXT NOT NULL DEFAULT 'submitted', dispense_notes TEXT nullable, internal_notes TEXT nullable, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()), (2) `prescriptionRequestHistory` (id UUID PK, request_id FKâ†’prescriptionRequests CASCADE, facility_id RESTRICT, previous_status TEXT nullable, new_status TEXT NOT NULL, changed_by_id FKâ†’users SET NULL nullable, note TEXT nullable, created_at TIMESTAMPTZ DEFAULT now()), (3) `compoundingRequests` (id UUID PK, facility_id RESTRICT, patient_id RESTRICT, compound_name TEXT NOT NULL, strength TEXT nullable, form TEXT NOT NULL CHECK IN('tablet','capsule','liquid','cream','suppository','other'), quantity TEXT NOT NULL, special_instructions TEXT nullable, prescriber_name TEXT nullable, file_reference TEXT nullable, quoted_price NUMERIC(10,2) nullable, quoted_turnaround_days INTEGER nullable, status TEXT NOT NULL DEFAULT 'submitted', internal_notes TEXT nullable, created_at, updated_at), (4) `compoundingRequestHistory` (same structure as prescriptionRequestHistory but FKâ†’compoundingRequests), (5) `minorAilmentCatalog` (id UUID PK, facility_id CASCADE, name TEXT NOT NULL, description TEXT nullable, is_active BOOLEAN NOT NULL DEFAULT true, display_order INTEGER NOT NULL DEFAULT 0, created_at, updated_at), (6) `minorAilmentRequests` (id UUID PK, facility_id RESTRICT, patient_id RESTRICT, ailment_id FKâ†’minorAilmentCatalog RESTRICT, symptoms TEXT NOT NULL, duration TEXT NOT NULL, current_medications TEXT nullable, health_history TEXT nullable, treatment_note TEXT nullable, internal_notes TEXT nullable, status TEXT NOT NULL DEFAULT 'submitted', created_at, updated_at), (7) `minorAilmentRequestHistory` (same structure, FKâ†’minorAilmentRequests), (8) `pharmacistConversations` (id UUID PK, facility_id RESTRICT, patient_id RESTRICT, subject TEXT NOT NULL, medication_name TEXT nullable, assigned_to UUID nullable FKâ†’users SET NULL, status TEXT NOT NULL DEFAULT 'open', internal_notes TEXT nullable, created_at, updated_at), (9) `conversationMessages` (id UUID PK, conversation_id FKâ†’pharmacistConversations CASCADE, facility_id RESTRICT, sender_id FKâ†’users RESTRICT, sender_type TEXT NOT NULL CHECK IN('patient','staff'), body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())

- [X] T003 [P] Update `backend/src/db/index.ts` â€” add `import * as healthcareSchema from './schema/healthcare'` and spread `...healthcareSchema` into the schema object passed to `drizzle()`

- [X] T004 [P] Update `backend/tests/setup/db.ts` â€” same import and spread of `healthcareSchema` so test DB includes all healthcare tables

- [X] T005 Create `backend/src/db/migrations/0004_healthcare_workflows.sql` â€” write full CREATE TABLE statements for all 9 healthcare tables using the `DO $$ BEGIN ... ALTER TABLE ADD CONSTRAINT ... EXCEPTION WHEN duplicate_object THEN null; END $$` pattern for FK constraints. After all tables: (1) `ALTER TABLE minor_ailment_catalog ADD CONSTRAINT minor_ailment_catalog_facility_name_unique UNIQUE (facility_id, name)`, (2) ENABLE ROW LEVEL SECURITY on all 9 tables, (3) `CREATE POLICY facility_isolation ON <table> USING (facility_id = current_facility_id()) WITH CHECK (facility_id = current_facility_id())` for each, (4) REVOKE UPDATE, DELETE ON `prescription_request_history`, `compounding_request_history`, `minor_ailment_request_history`, `conversation_messages` FROM app_user, app_super_admin, (5) REVOKE UPDATE, DELETE ON `conversation_messages` FROM app_user, app_super_admin (messages are immutable), (6) GRANT SELECT,INSERT,UPDATE ON all 5 request/conversation tables TO app_user, app_super_admin, (7) GRANT SELECT,INSERT ON all 4 history/messages tables TO app_user, app_super_admin, (8) CREATE INDEX idx_prescription_requests_facility_patient ON prescription_requests(facility_id, patient_id), CREATE INDEX idx_prescription_requests_facility_status ON prescription_requests(facility_id, status), CREATE INDEX idx_prescription_requests_facility_created ON prescription_requests(facility_id, created_at DESC) â€” same 3 indexes for compounding_requests, minor_ailment_requests, pharmacist_conversations, (9) CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, created_at ASC)

- [X] T006 [P] Update `backend/src/db/migrations/meta/_journal.json` â€” append entry: `{"idx": 4, "version": "7", "when": 1791950000000, "tag": "0004_healthcare_workflows", "breakpoints": true}`

- [X] T007 Run `npm run db:migrate` in `backend/` to apply `0004_healthcare_workflows.sql` against the local Docker PostgreSQL instance â€” verify all 9 new tables exist (manual step, requires running DB)

- [X] T008 Create `backend/src/db/seeds/healthcare-permissions.ts` â€” Part 1: seed 8 permissions under `healthcare` platform module: `{key:'prescriptions.read', name:'View Prescriptions'}`, `{key:'prescriptions.manage', name:'Manage Prescriptions'}`, `{key:'compounding.read', name:'View Compounding Requests'}`, `{key:'compounding.manage', name:'Manage Compounding Requests'}`, `{key:'minor-ailments.read', name:'View Minor Ailment Assessments'}`, `{key:'minor-ailments.manage', name:'Manage Minor Ailments'}`, `{key:'ask-pharmacist.read', name:'View Pharmacist Conversations'}`, `{key:'ask-pharmacist.manage', name:'Manage Pharmacist Conversations'}` â€” use same upsert pattern as existing permission seeds; Part 2: for each existing facility in the DB, insert the 19 Ontario model ailments into `minor_ailment_catalog` ON CONFLICT DO NOTHING: acne, allergic rhinitis, oral candidiasis (thrush), conjunctivitis (pink eye), contact dermatitis, dysmenorrhea (menstrual cramps), gastroesophageal reflux disease (GERD), hemorrhoids, herpes labialis (cold sores), impetigo, insect bites and stings, musculoskeletal sprains and strains, tick bites, uncomplicated urinary tract infection (women), urticaria (hives), herpes zoster (shingles), nausea and vomiting of pregnancy, pinworms/threadworms, eczema (atopic dermatitis) â€” display_order 0â€“18 respectively

- [X] T009 [P] Create `backend/tests/setup/healthcare-fixtures.ts` â€” export: `createTestPrescriptionRequest(facilityId, patientId, overrides?)` (inserts request + initial history row, defaults: type='refill', medicationName='Test Medication', status='submitted'), `createTestCompoundingRequest(facilityId, patientId, overrides?)` (defaults: compoundName='Test Compound', form='cream', quantity='60g', status='submitted'), `createTestMinorAilmentCatalogEntry(facilityId, overrides?)` (defaults: name='Allergic Rhinitis', isActive=true), `createTestMinorAilmentRequest(facilityId, patientId, ailmentId, overrides?)` (defaults: symptoms='Test symptoms for testing purposes', duration='3 days', status='submitted'), `createTestConversation(facilityId, patientId, overrides?)` (creates conversation + inserts first patient message, defaults: subject='Test Question', status='open'), cleanup helpers: `deleteTestHealthcareByFacility(facilityId)` â€” deletes from all 5 request/conversation tables in correct FK order

**Checkpoint**: Schema migrated, permissions seeded, fixtures ready. All four user stories can now begin.

---

## Phase 2: User Story 1 â€” Enhanced Prescription Requests (Priority: P1)

**Goal**: Patients submit prescription requests; pharmacists approve or decline with dispense notes; full status history; internal notes never exposed to patients.

**Independent Test**: Patient submits a refill request (201, status=`submitted`). Admin approves with dispenseNotes. Patient views detail: `dispenseNotes` present, `internalNotes` absent. Invalid transition (approvedâ†’submitted) returns 422 `HEALTHCARE_INVALID_STATUS_TRANSITION`.

- [X] T010 [P] [US1] Create `backend/src/modules/healthcare/prescriptions/prescription.types.ts` â€” export `PrescriptionType = 'refill' | 'transfer' | 'new'`, `PrescriptionStatus = 'submitted' | 'under_review' | 'approved' | 'declined'`, `PRESCRIPTION_VALID_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = { submitted: ['under_review','approved','declined'], under_review: ['approved','declined'], approved: [], declined: [] }`, `validatePrescriptionTransition(current: PrescriptionStatus, next: PrescriptionStatus): void` (throws `HEALTHCARE_INVALID_STATUS_TRANSITION` if next not in PRESCRIPTION_VALID_TRANSITIONS[current]), interfaces: `PrescriptionHistoryEntry` (id, requestId, facilityId, previousStatus, newStatus, changedById, changedByName, note, createdAt), `PatientPrescriptionSummary` (id, type, medicationName, dosage, status, createdAt, updatedAt), `PatientPrescriptionDetail` extends PatientPrescriptionSummary (prescriberName, prescriberFax, fileReference, dispenseNotes, statusHistory: PrescriptionHistoryEntry[]) â€” **no internalNotes field**, `AdminPrescriptionDetail` extends PatientPrescriptionDetail (internalNotes, patientId, patientName, patientEmail)

- [X] T011 [P] [US1] Create `backend/src/modules/healthcare/prescriptions/prescription.validator.ts` â€” `CreatePrescriptionBodySchema` (type: z.enum(['refill','transfer','new']), medicationName: z.string().min(1).max(200), dosage: z.string().max(100).optional(), prescriberName: z.string().max(200).optional(), prescriberFax: z.string().max(30).optional(), fileReference: z.string().optional()), `ListPrescriptionsQuerySchema` (status: z.enum([...PrescriptionStatuses]).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20)), `AdminListPrescriptionsQuerySchema` (adds patientId: z.string().uuid().optional(), type optional, dateFrom/dateTo YYYY-MM-DD regex optional, sort: z.enum(['createdAt:asc','createdAt:desc']).default('createdAt:desc')), `AdminStatusUpdateBodySchema` (newStatus: z.enum([...PrescriptionStatuses]), dispenseNotes: z.string().max(2000).optional(), internalNotes: z.string().max(2000).optional(), note: z.string().max(500).optional())

- [X] T012 [P] [US1] Create `backend/src/modules/healthcare/prescriptions/prescription.queries.ts` â€” `insertPrescriptionRequest(data: typeof prescriptionRequests.$inferInsert, tx): Promise<{id:string}>`, `insertPrescriptionHistory(data: typeof prescriptionRequestHistory.$inferInsert, tx): Promise<void>`, `findPrescriptionById(id:string, tx): Promise<typeof prescriptionRequests.$inferSelect | undefined>`, `findPrescriptionForPatient(facilityId:string, id:string, patientId:string, tx)` â€” returns null if patient_id mismatch (security: caller throws 404 in both cases), `listPrescriptionsForPatient(facilityId, patientId, opts:{status?,page,limit}, tx): Promise<{rows:PatientPrescriptionSummary[], total:number}>`, `findPrescriptionDetailForPatient(facilityId, id, patientId, tx): Promise<PatientPrescriptionDetail | null>` â€” LEFT JOIN history + changedBy user name, `listPrescriptionsForAdmin(facilityId, opts:{status?,patientId?,type?,dateFrom?,dateTo?,page,limit,sort}, tx): Promise<{rows:(PatientPrescriptionSummary & {patientName:string})[], total:number}>` â€” JOIN users for patientName; use raw sql.raw() with parameterized dynamic WHERE, `findPrescriptionDetailForAdmin(facilityId, id, tx): Promise<AdminPrescriptionDetail | null>` â€” includes internal_notes and patient info, `updatePrescription(id:string, data:{status:PrescriptionStatus, dispenseNotes?:string, internalNotes?:string, updatedAt:Date}, tx): Promise<void>`

- [X] T013 [US1] Create `backend/src/modules/healthcare/prescriptions/prescription.service.ts` â€” all methods use `withTenantContext(facilityId, async(tx) => {...})`: `submitPrescription(auth:AuthContext, input:CreatePrescriptionInput): Promise<PatientPrescriptionDetail>` â€” insertPrescriptionRequest + insertPrescriptionHistory(previousStatus:null, newStatus:'submitted', changedById:null) + createAuditEntry({action:'prescription.submitted', ...}); `listPatientPrescriptions(auth, opts)`: listPrescriptionsForPatient; `getPatientPrescriptionDetail(auth, id)`: findPrescriptionDetailForPatient (throws PRESCRIPTION_REQUEST_NOT_FOUND if null); if result.fileReference: createAuditEntry({action:'prescription.file_accessed', ...}); return result (PatientPrescriptionDetail â€” no internalNotes); `listAdminPrescriptions(auth, opts)`: listPrescriptionsForAdmin; `getAdminPrescriptionDetail(auth, id)`: findPrescriptionDetailForAdmin (throws PRESCRIPTION_REQUEST_NOT_FOUND); createAuditEntry({action:'prescription.file_accessed'}) if fileReference present; `updatePrescriptionStatus(auth, id, input)`: findPrescriptionById (PRESCRIPTION_REQUEST_NOT_FOUND), validatePrescriptionTransition(current, input.newStatus), updatePrescription, insertPrescriptionHistory(previousStatus:current, newStatus:input.newStatus, changedById:auth.userId, note:input.note), createAuditEntry({action:'prescription.status_changed', metadata:{from:current, to:input.newStatus}})

- [X] T014 [US1] Create `backend/src/modules/healthcare/prescriptions/prescription.router.ts` â€” `prescriptionRouter = Router()`: `POST /prescriptions` (authMiddleware â†’ CreatePrescriptionBodySchema â†’ submitPrescription â†’ 201), `GET /prescriptions` (authMiddleware â†’ ListPrescriptionsQuerySchema â†’ listPatientPrescriptions â†’ {data, pagination}), `GET /prescriptions/:id` (authMiddleware â†’ getPatientPrescriptionDetail â†’ {data}), `GET /admin/prescriptions` (authMiddleware + requirePermission('prescriptions.read') â†’ AdminListPrescriptionsQuerySchema â†’ listAdminPrescriptions â†’ {data, pagination}), `GET /admin/prescriptions/:id` (authMiddleware + requirePermission('prescriptions.read') â†’ getAdminPrescriptionDetail â†’ {data}), `PATCH /admin/prescriptions/:id/status` (authMiddleware + requirePermission('prescriptions.manage') â†’ AdminStatusUpdateBodySchema â†’ updatePrescriptionStatus â†’ {data:{success:true}})

**Checkpoint**: Prescription module fully functional. Patient isolation verified (404 on wrong patientId). internalNotes absent from patient responses. Status transitions enforced.

---

## Phase 3: User Story 2 â€” Compounding Requests (Priority: P2)

**Goal**: Patients submit custom compound requests; pharmacists quote with price/turnaround; patients explicitly accept or decline the quote; pharmacist advances to ready/completed.

**Independent Test**: Patient submits compound request. Pharmacist quotes ($45, 5 days). Patient sees quote with `internalNotes` absent. Patient accepts â†’ status `accepted`. Pharmacist marks `ready`. Patient declines a separate quote â†’ status `patient_declined`.

- [X] T015 [P] [US2] Create `backend/src/modules/healthcare/compounding/compounding.types.ts` â€” export `CompoundForm = 'tablet' | 'capsule' | 'liquid' | 'cream' | 'suppository' | 'other'`, `CompoundingStatus = 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'patient_declined' | 'ready' | 'completed' | 'declined'`, `COMPOUNDING_VALID_TRANSITIONS: Record<CompoundingStatus, CompoundingStatus[]> = { submitted: ['under_review','quoted','declined'], under_review: ['quoted','declined'], quoted: ['accepted','patient_declined','declined'], accepted: ['ready'], patient_declined: [], ready: ['completed'], completed: [], declined: [] }`, `validateCompoundingTransition(current:CompoundingStatus, next:CompoundingStatus): void` (throws HEALTHCARE_INVALID_STATUS_TRANSITION), interfaces: `CompoundingHistoryEntry`, `PatientCompoundingSummary` (id, compoundName, form, status, quotedPrice, quotedTurnaroundDays, createdAt, updatedAt), `PatientCompoundingDetail` extends summary (strength, quantity, specialInstructions, prescriberName, fileReference, statusHistory) â€” **no internalNotes**, `AdminCompoundingDetail` extends PatientCompoundingDetail (internalNotes, patientId, patientName, patientEmail)

- [X] T016 [P] [US2] Create `backend/src/modules/healthcare/compounding/compounding.validator.ts` â€” `CreateCompoundingBodySchema` (compoundName min 1 max 200, strength max 100 optional, form: z.enum(['tablet','capsule','liquid','cream','suppository','other']), quantity min 1 max 100, specialInstructions max 1000 optional, prescriberName max 200 optional, fileReference optional), `AdminCompoundingStatusBodySchema` (newStatus: z.enum([...CompoundingStatuses]), quotedPrice: z.number().min(0).optional(), quotedTurnaroundDays: z.number().int().min(0).optional(), internalNotes optional, note optional â€” add `.superRefine()` to require quotedPrice + quotedTurnaroundDays when newStatus === 'quoted')

- [X] T017 [P] [US2] Create `backend/src/modules/healthcare/compounding/compounding.queries.ts` â€” same pattern as prescription.queries.ts: `insertCompoundingRequest`, `insertCompoundingHistory`, `findCompoundingById`, `findCompoundingForPatient(facilityId,id,patientId,tx)` â€” null if mismatch, `listCompoundingForPatient(facilityId,patientId,opts,tx)`, `findCompoundingDetailForPatient(facilityId,id,patientId,tx)` â€” with history, `listCompoundingForAdmin(facilityId,opts,tx)` â€” raw sql.raw() with dynamic WHERE + JOIN users, `findCompoundingDetailForAdmin(facilityId,id,tx)` â€” includes internalNotes, `updateCompoundingStatus(id,data:{status,quotedPrice?,quotedTurnaroundDays?,internalNotes?,updatedAt},tx): Promise<void>`

- [X] T018 [US2] Create `backend/src/modules/healthcare/compounding/compounding.service.ts` â€” `submitCompounding(auth,input)`: insert + history(nullâ†’submitted) + audit; `listPatientCompounding(auth,opts)`: listCompoundingForPatient; `getPatientCompoundingDetail(auth,id)`: findCompoundingDetailForPatient (COMPOUNDING_REQUEST_NOT_FOUND), audit if fileReference; `acceptQuote(auth,id)`: findCompoundingForPatient (COMPOUNDING_REQUEST_NOT_FOUND), validateCompoundingTransition(current,'accepted'), updateCompoundingStatus, insertHistory, audit (compounding.quote_accepted); `declineQuote(auth,id,note?)`: same flow, transitionâ†’'patient_declined', audit (compounding.quote_declined); `listAdminCompounding(auth,opts)`; `getAdminCompoundingDetail(auth,id)`: audit if fileReference; `updateCompoundingStatus(auth,id,input)`: findCompoundingById (NOT_FOUND), validateCompoundingTransition, update (include quotedPrice/quotedTurnaroundDays when quoted), insertHistory, audit (compounding.status_changed)

- [X] T019 [US2] Create `backend/src/modules/healthcare/compounding/compounding.router.ts` â€” `compoundingRouter = Router()`: `POST /compounding` (authMiddleware â†’ 201), `GET /compounding` (authMiddleware + ListQuerySchema â†’ {data,pagination}), `GET /compounding/:id` (authMiddleware â†’ {data}), `POST /compounding/:id/accept` (authMiddleware â†’ acceptQuote â†’ {data:{success:true}}), `POST /compounding/:id/decline` (authMiddleware â†’ body: optional note â†’ declineQuote â†’ {data:{success:true}}), `GET /admin/compounding` (authMiddleware + requirePermission('compounding.read')), `GET /admin/compounding/:id` (authMiddleware + requirePermission('compounding.read')), `PATCH /admin/compounding/:id/status` (authMiddleware + requirePermission('compounding.manage') â†’ AdminCompoundingStatusBodySchema â†’ updateCompoundingStatus â†’ {data:{success:true}})

**Checkpoint**: Compounding flow complete end-to-end. Quote cycle (submitâ†’quotedâ†’acceptedâ†’readyâ†’completed) works. Patient decline (quotedâ†’patient_declined) works. internalNotes never in patient responses.

---

## Phase 4: User Story 3 â€” Minor Ailments (Priority: P3)

**Goal**: DB-driven ailment catalog managed by admins; patients submit assessments; pharmacists treat or refer; treatment notes visible to patients; internal notes staff-only.

**Independent Test**: 19 ailments in catalog after seed. Patient submits for `Allergic Rhinitis`. Admin treats with `treatmentNote`. Patient sees treatmentNote, NOT internalNotes. Patient blocked from submitting for deactivated ailment (422 AILMENT_INACTIVE). Catalog accessible without auth.

- [X] T020 [P] [US3] Create `backend/src/modules/healthcare/minor-ailments/minor-ailment.types.ts` â€” export `MinorAilmentStatus = 'submitted' | 'under_review' | 'treated' | 'referred'`, `MINOR_AILMENT_VALID_TRANSITIONS: Record<MinorAilmentStatus, MinorAilmentStatus[]> = { submitted: ['under_review','treated','referred'], under_review: ['treated','referred'], treated: [], referred: [] }`, `validateMinorAilmentTransition(current,next): void` (throws HEALTHCARE_INVALID_STATUS_TRANSITION), interfaces: `CatalogEntry` (id, facilityId, name, description, isActive, displayOrder, createdAt, updatedAt), `MinorAilmentHistoryEntry`, `PatientAssessmentSummary` (id, ailmentId, ailmentName, symptoms, duration, status, createdAt, updatedAt), `PatientAssessmentDetail` extends summary (currentMedications, healthHistory, treatmentNote, statusHistory) â€” **no internalNotes**, `AdminAssessmentDetail` extends PatientAssessmentDetail (internalNotes, patientId, patientName, patientEmail)

- [X] T021 [P] [US3] Create `backend/src/modules/healthcare/minor-ailments/minor-ailment.validator.ts` â€” `CreateAssessmentBodySchema` (ailmentId: z.string().uuid(), symptoms: z.string().min(10), duration: z.string().min(1).max(200), currentMedications optional, healthHistory optional), `ListAssessmentsQuerySchema` (status optional, page, limit), `AdminListAssessmentsQuerySchema` (adds ailmentId, patientId, dateFrom, dateTo, sort), `CreateCatalogEntryBodySchema` (name: z.string().min(1).max(150), description optional, displayOrder: z.number().int().default(0)), `UpdateCatalogEntryBodySchema` (same fields all optional, plus isActive: z.boolean().optional()), `AdminAssessmentStatusBodySchema` (newStatus: z.enum([...MinorAilmentStatuses]), treatmentNote: z.string().min(1).optional(), internalNotes optional, note optional â€” superRefine: require treatmentNote when newStatus==='treated')

- [X] T022 [P] [US3] Create `backend/src/modules/healthcare/minor-ailments/minor-ailment.queries.ts` â€” catalog: `listActiveCatalog(facilityId,tx)` (WHERE is_active=true ORDER BY display_order ASC, name ASC), `listAllCatalog(facilityId,tx)` (all including inactive), `findCatalogEntryById(id,tx)`, `checkCatalogNameExists(facilityId,name,excludeId?,tx): Promise<boolean>` (LOWER(name) = LOWER(input) check), `insertCatalogEntry(data,tx)`, `updateCatalogEntry(id,data,tx)`; assessments: `insertMinorAilmentRequest(data,tx): Promise<{id:string}>`, `insertMinorAilmentHistory(data,tx)`, `findMinorAilmentById(id,tx)`, `findMinorAilmentForPatient(facilityId,id,patientId,tx)` â€” null if mismatch, `listMinorAilmentsForPatient(facilityId,patientId,opts,tx)`, `findMinorAilmentDetailForPatient(facilityId,id,patientId,tx)` â€” LEFT JOIN minor_ailment_catalog for ailmentName + LEFT JOIN history with changedBy name, `listMinorAilmentsForAdmin(facilityId,opts,tx)` â€” raw SQL JOIN users + catalog, `findMinorAilmentDetailForAdmin(facilityId,id,tx)` â€” includes internalNotes + patient info, `updateMinorAilmentRequest(id,data:{status,treatmentNote?,internalNotes?,updatedAt},tx)`

- [X] T023 [US3] Create `backend/src/modules/healthcare/minor-ailments/minor-ailment.service.ts` â€” `listActiveCatalog(facilityId)`: withTenantContext â†’ listActiveCatalog query; `listAllCatalog(auth)`: admin view; `createCatalogEntry(auth,input)`: checkCatalogNameExists (AILMENT_NAME_EXISTS), insertCatalogEntry, audit (ailment.catalog_created); `updateCatalogEntry(auth,id,input)`: findCatalogEntryById (AILMENT_NOT_FOUND), checkCatalogNameExists (exclude self), updateCatalogEntry; `submitAssessment(auth,input)`: findCatalogEntryById (AILMENT_NOT_FOUND if not found), check isActive (AILMENT_INACTIVE if false), insertMinorAilmentRequest + insertMinorAilmentHistory(nullâ†’submitted); `listPatientAssessments(auth,opts)`; `getPatientAssessmentDetail(auth,id)`: findMinorAilmentDetailForPatient (AILMENT_NOT_FOUND if null) â€” PatientAssessmentDetail, no internalNotes; `listAdminAssessments(auth,opts)`; `getAdminAssessmentDetail(auth,id)`: findMinorAilmentDetailForAdmin (AILMENT_NOT_FOUND); `updateAssessmentStatus(auth,id,input)`: findMinorAilmentById (AILMENT_NOT_FOUND), validateMinorAilmentTransition, updateMinorAilmentRequest (include treatmentNote when treated), insertMinorAilmentHistory, audit (ailment.status_changed)

- [X] T024 [US3] Create `backend/src/modules/healthcare/minor-ailments/minor-ailment.router.ts` â€” `minorAilmentRouter = Router()`: `GET /minor-ailments/catalog` (resolveFacility middleware â€” NO auth â†’ listActiveCatalog â†’ {data:[...]}), `GET /admin/minor-ailments/catalog` (authMiddleware + requirePermission('minor-ailments.manage') â†’ listAllCatalog â†’ {data}), `POST /admin/minor-ailments/catalog` (authMiddleware + requirePermission('minor-ailments.manage') â†’ CreateCatalogEntryBodySchema â†’ createCatalogEntry â†’ 201 {data}), `PATCH /admin/minor-ailments/catalog/:id` (authMiddleware + requirePermission('minor-ailments.manage') â†’ UpdateCatalogEntryBodySchema â†’ updateCatalogEntry â†’ {data}), `POST /minor-ailments/assessments` (authMiddleware â†’ CreateAssessmentBodySchema â†’ submitAssessment â†’ 201), `GET /minor-ailments/assessments` (authMiddleware â†’ ListAssessmentsQuerySchema â†’ listPatientAssessments â†’ {data,pagination}), `GET /minor-ailments/assessments/:id` (authMiddleware â†’ getPatientAssessmentDetail â†’ {data}), `GET /admin/minor-ailments/assessments` (authMiddleware + requirePermission('minor-ailments.read') â†’ AdminListAssessmentsQuerySchema â†’ listAdminAssessments â†’ {data,pagination}), `GET /admin/minor-ailments/assessments/:id` (authMiddleware + requirePermission('minor-ailments.read') â†’ getAdminAssessmentDetail â†’ {data}), `PATCH /admin/minor-ailments/assessments/:id/status` (authMiddleware + requirePermission('minor-ailments.manage') â†’ AdminAssessmentStatusBodySchema â†’ updateAssessmentStatus â†’ {data:{success:true}})

**Checkpoint**: Minor ailments complete. Catalog publicly browseable. Patient blocked from inactive ailments. Treatment notes patient-visible. internalNotes staff-only.

---

## Phase 5: User Story 4 â€” Ask-a-Pharmacist (Priority: P4)

**Goal**: Multi-turn patient-pharmacist conversation; admin assigns; pharmacist replies auto-advances to in_progress; resolved/closed conversations reject new messages.

**Independent Test**: Patient starts conversation (status=`open`, 1 message in thread). Admin assigns (status=`in_progress`). Pharmacist replies (thread has 2 messages). Patient follows up (thread has 3 messages). Conversation resolved. New message attempt â†’ 422 CONVERSATION_CLOSED. Cross-patient access â†’ 404.

- [X] T025 [P] [US4] Create `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.types.ts` â€” export `ConversationStatus = 'open' | 'in_progress' | 'resolved' | 'closed'`, `SenderType = 'patient' | 'staff'`, `CONVERSATION_VALID_TRANSITIONS: Record<ConversationStatus,ConversationStatus[]> = { open: ['in_progress','resolved','closed'], in_progress: ['resolved','closed'], resolved: [], closed: [] }`, `validateConversationTransition(current,next): void` (throws HEALTHCARE_INVALID_STATUS_TRANSITION), interfaces: `ConversationMessage` (id, conversationId, senderType:SenderType, senderName:string, body, createdAt), `PatientConversationSummary` (id, subject, medicationName, status, messageCount, lastMessageAt, createdAt), `PatientConversationDetail` extends summary (messages:ConversationMessage[]) â€” **no internalNotes, no assignedToName**, `AdminConversationDetail` extends PatientConversationDetail (internalNotes, patientId, patientName, patientEmail, assignedToId, assignedToName)

- [X] T026 [P] [US4] Create `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.validator.ts` â€” `StartConversationBodySchema` (subject: z.string().min(1).max(200), body: z.string().min(10), medicationName optional max 200), `AddMessageBodySchema` (body: z.string().min(10)), `AssignConversationBodySchema` (assignedTo: z.string().uuid()), `ConversationStatusBodySchema` (newStatus: z.enum(['resolved','closed']), note optional max 500), `UpdateConversationNotesBodySchema` (notes: z.string().max(2000)), `ListConversationsQuerySchema` (status optional, page, limit), `AdminListConversationsQuerySchema` (adds assignedTo uuid, patientId, dateFrom, dateTo, sort)

- [X] T027 [P] [US4] Create `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.queries.ts` â€” `insertConversation(data:typeof pharmacistConversations.$inferInsert,tx): Promise<{id:string}>`, `insertMessage(data:typeof conversationMessages.$inferInsert,tx): Promise<{id:string}>`, `findConversationById(id,tx): Promise<typeof pharmacistConversations.$inferSelect | undefined>`, `findConversationForPatient(facilityId,id,patientId,tx)` â€” null if mismatch, `listConversationsForPatient(facilityId,patientId,opts,tx): Promise<{rows:PatientConversationSummary[],total:number}>` â€” COUNT(messages) + MAX(message created_at) as lastMessageAt, `findConversationDetailForPatient(facilityId,id,patientId,tx): Promise<PatientConversationDetail|null>` â€” with messages LEFT JOIN users for senderName; patient view only, `listConversationsForAdmin(facilityId,opts,tx): Promise<{rows:(...),total:number}>` â€” JOIN users for patientName + assignedToName via two LEFT JOINs, `findConversationDetailForAdmin(facilityId,id,tx): Promise<AdminConversationDetail|null>` â€” includes internalNotes + patient info + messages with sender names, `updateConversationStatus(id,status,tx)`, `updateConversationAssignee(id,assignedTo,tx)`, `updateConversationNotes(id,notes,tx)`, `updateConversationAndStatus(id,data:{status?,assignedTo?,internalNotes?,updatedAt},tx)` â€” general update

- [X] T028 [US4] Create `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.service.ts` â€” `startConversation(auth,input)`: withTenantContext â†’ insertConversation(status:'open') + insertMessage(senderType:'patient', senderId:auth.userId, body:input.body) + audit(ask-pharmacist.started); `listPatientConversations(auth,opts)`; `getPatientConversationDetail(auth,id)`: findConversationDetailForPatient (CONVERSATION_NOT_FOUND if null) â€” PatientConversationDetail (no internalNotes); `addPatientMessage(auth,id,body)`: findConversationForPatient (CONVERSATION_NOT_FOUND), check status â€” if resolved|closed throw CONVERSATION_CLOSED, insertMessage(senderType:'patient'); `listAdminConversations(auth,opts)`; `getAdminConversationDetail(auth,id)`: findConversationDetailForAdmin (CONVERSATION_NOT_FOUND); `addStaffMessage(auth,id,body)`: findConversationById (NOT_FOUND), check status (CONVERSATION_CLOSED if resolved|closed), insertMessage(senderType:'staff', senderId:auth.userId), if conversation.status==='open' then updateConversationStatus(id,'in_progress'); `assignConversation(auth,id,assignedTo)`: findConversationById (NOT_FOUND), updateConversationAssignee(id,assignedTo), if status==='open' updateConversationStatus(id,'in_progress'), audit(ask-pharmacist.assigned); `updateConversationStatus(auth,id,newStatus,note?)`: findConversationById (NOT_FOUND), validateConversationTransition(current,newStatus), updateConversationStatus, audit(ask-pharmacist.status_changed); `updateConversationNotes(auth,id,notes)`: findConversationById (NOT_FOUND), updateConversationNotes

- [X] T029 [US4] Create `backend/src/modules/healthcare/ask-pharmacist/ask-pharmacist.router.ts` â€” `askPharmacistRouter = Router()`: `POST /ask-pharmacist` (authMiddleware â†’ StartConversationBodySchema â†’ startConversation â†’ 201), `GET /ask-pharmacist` (authMiddleware â†’ ListConversationsQuerySchema â†’ listPatientConversations â†’ {data,pagination}), `GET /ask-pharmacist/:id` (authMiddleware â†’ getPatientConversationDetail â†’ {data}), `POST /ask-pharmacist/:id/messages` (authMiddleware â†’ AddMessageBodySchema â†’ addPatientMessage â†’ 201), `GET /admin/ask-pharmacist` (authMiddleware + requirePermission('ask-pharmacist.read') â†’ AdminListConversationsQuerySchema â†’ listAdminConversations â†’ {data,pagination}), `GET /admin/ask-pharmacist/:id` (authMiddleware + requirePermission('ask-pharmacist.read') â†’ getAdminConversationDetail â†’ {data}), `POST /admin/ask-pharmacist/:id/messages` (authMiddleware + requirePermission('ask-pharmacist.manage') â†’ AddMessageBodySchema â†’ addStaffMessage â†’ 201), `PATCH /admin/ask-pharmacist/:id/assign` (authMiddleware + requirePermission('ask-pharmacist.manage') â†’ AssignConversationBodySchema â†’ assignConversation â†’ {data:{success:true}}), `PATCH /admin/ask-pharmacist/:id/status` (authMiddleware + requirePermission('ask-pharmacist.manage') â†’ ConversationStatusBodySchema â†’ updateConversationStatus â†’ {data:{success:true}}), `PATCH /admin/ask-pharmacist/:id/notes` (authMiddleware + requirePermission('ask-pharmacist.manage') â†’ UpdateConversationNotesBodySchema â†’ updateConversationNotes â†’ {data:{success:true}})

**Checkpoint**: Ask-a-Pharmacist complete. Multi-turn threading works. Resolved conversation blocks new messages. Cross-patient access returns 404.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 Create `backend/src/modules/healthcare/healthcare.router.ts` â€” import `prescriptionRouter`, `compoundingRouter`, `minorAilmentRouter`, `askPharmacistRouter`; export `healthcareRouter = Router()` mounting all four: `healthcareRouter.use(prescriptionRouter)`, `healthcareRouter.use(compoundingRouter)`, `healthcareRouter.use(minorAilmentRouter)`, `healthcareRouter.use(askPharmacistRouter)`

- [X] T031 Register `healthcareRouter` in `backend/src/app.ts` â€” add `import { healthcareRouter } from './modules/healthcare/healthcare.router'` and `app.use('/api/v1', healthcareRouter)` alongside existing `commerceRouter` registration

- [X] T032 Run `npm run typecheck` in `backend/` â€” fix all TypeScript errors in new healthcare modules. Common issues: `as string` casts for `req.params.id`, `unknown` intermediate casts for raw SQL results, missing return types

- [X] T033 Run `npm run lint` in `backend/` targeting `src/modules/healthcare/` â€” fix all ESLint errors (unused imports, missing return types, no-unused-vars)

- [X] T034 Run `npm test -- tests/healthcare/ --passWithNoTests` in `backend/` â€” verify test runner passes even with no test files yet

- [ ] T035 Manually run quickstart.md Scenarios 1â€“7 against running backend: (1) prescription full lifecycle, (2) compounding quote+acceptance, (3) minor ailments assessment+treatment, (4) ask-a-pharmacist multi-turn, (5) patient isolation (404 cross-patient), (6) internal notes never leaked, (7) audit log entries present after each status change

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies â€” start immediately
- **Phase 2 (US1 Prescriptions)**: Depends on Phase 1 complete (schema + error codes)
- **Phase 3 (US2 Compounding)**: Depends on Phase 1 complete; independent of US1
- **Phase 4 (US3 Minor Ailments)**: Depends on Phase 1 complete; independent of US1/US2
- **Phase 5 (US4 Ask-a-Pharmacist)**: Depends on Phase 1 complete; independent of US1/US2/US3
- **Phase 6 (Polish)**: Depends on all four user story phases complete

### Within-Phase Parallel Tasks

**Phase 1**: T003, T004, T006, T009 are all [P] â€” run alongside T002 and T005.

**Each US Phase (2â€“5)**: The types, validator, and queries tasks are all [P] â€” run together before the service task, then router last:
- `T010 + T011 + T012` â†’ then `T013` â†’ then `T014`
- `T015 + T016 + T017` â†’ then `T018` â†’ then `T019`
- `T020 + T021 + T022` â†’ then `T023` â†’ then `T024`
- `T025 + T026 + T027` â†’ then `T028` â†’ then `T029`

---

## Parallel Execution Examples

```
# Phase 1 â€” start these together after T002 + T005:
Task T003: Update backend/src/db/index.ts
Task T004: Update backend/tests/setup/db.ts
Task T006: Update journal JSON
Task T009: Create healthcare-fixtures.ts

# Phase 2 (US1) â€” start these together after Phase 1:
Task T010: Create prescription.types.ts
Task T011: Create prescription.validator.ts
Task T012: Create prescription.queries.ts

# Phases 2â€“5 can all run in parallel once Phase 1 is done (independent modules):
Developer A: T010â†’T013â†’T014 (Prescriptions)
Developer B: T015â†’T018â†’T019 (Compounding)
Developer C: T020â†’T023â†’T024 (Minor Ailments)
Developer D: T025â†’T028â†’T029 (Ask-a-Pharmacist)
```

---

## Implementation Strategy

### MVP First (US1 Prescriptions Only)

1. Complete Phase 1: Setup (T001â€“T009)
2. Complete Phase 2: US1 Prescriptions (T010â€“T014)
3. **STOP and VALIDATE**: Prescription submit â†’ approve â†’ patient view works
4. Then add US2, US3, US4 incrementally

### Incremental Delivery

- After Phase 1 + Phase 2: Prescription workflow live
- After Phase 3: Compounding workflow live (quote+accept cycle)
- After Phase 4: Minor ailment assessments live (public catalog)
- After Phase 5: Ask-a-pharmacist live (full multi-turn threading)
- After Phase 6: All integrated, typecheck+lint clean, quickstart validated

---

## Notes

- `req.params.id as string` cast required everywhere â€” see Phase 4 pattern (ParamsDictionary type)
- Use `resolveFacility` middleware (not `authMiddleware`) for public catalog endpoint
- `withTenantContext` wraps ALL service methods â€” never import `db` directly
- History tables: REVOKE UPDATE/DELETE enforced at DB level in migration
- `internalNotes` must be structurally absent from PatientXxxDetail types (not just deleted at runtime)
- File reference audit: if `fileReference` is non-null and non-empty on a detail fetch, write audit entry
- `validateXxxTransition()` functions throw `HEALTHCARE_INVALID_STATUS_TRANSITION` (not `INVALID_STATUS_TRANSITION`) â€” different error code intentional for frontend differentiation
- When pharmacist posts first staff reply to `open` conversation, auto-advance to `in_progress` at service layer
- Ontario 19 ailment seed in T008 uses ON CONFLICT DO NOTHING â€” safe to re-run

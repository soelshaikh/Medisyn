# Quickstart: Healthcare Workflows

Validate that all four healthcare modules work end-to-end by following the scenarios below.

---

## Prerequisites

1. Backend running: `npm run dev` in `backend/` (port 3001)
2. Migration applied: `npm run db:migrate` in `backend/`
3. Permissions seeded: `npx tsx src/db/seeds/healthcare-permissions.ts`
4. Test facility exists with:
   - A patient user (JWT token available)
   - An admin user with `prescriptions.manage`, `compounding.manage`, `minor-ailments.manage`, `ask-pharmacist.manage` permissions
5. All requests include `X-Facility-ID: <test-facility-id>` header

---

## Scenario 1: Prescription Refill — Full Lifecycle

1. **Patient submits** `POST /api/v1/prescriptions`
   - Body: `{ "type": "refill", "medicationName": "Metformin 500mg", "prescriberName": "Dr. Smith" }`
   - **Expected**: 201, `status = "submitted"`

2. **Admin lists queue** `GET /api/v1/admin/prescriptions?status=submitted`
   - **Expected**: 200, request appears in list with `patientName`

3. **Admin approves** `PATCH /api/v1/admin/prescriptions/:id/status`
   - Body: `{ "newStatus": "approved", "dispenseNotes": "Ready for pickup tomorrow", "internalNotes": "Verified with prescriber" }`
   - **Expected**: 200 success

4. **Patient views detail** `GET /api/v1/prescriptions/:id`
   - **Expected**: `status = "approved"`, `dispenseNotes` present, `internalNotes` ABSENT

5. **Invalid transition attempt** `PATCH /api/v1/admin/prescriptions/:id/status`
   - Body: `{ "newStatus": "submitted" }`
   - **Expected**: 422, `error.code = "HEALTHCARE_INVALID_STATUS_TRANSITION"`

---

## Scenario 2: Compounding Quote + Patient Acceptance

1. **Patient submits** `POST /api/v1/compounding`
   - Body: `{ "compoundName": "Progesterone Cream 100mg", "form": "cream", "quantity": "60g" }`
   - **Expected**: 201, `status = "submitted"`

2. **Pharmacist quotes** `PATCH /api/v1/admin/compounding/:id/status`
   - Body: `{ "newStatus": "quoted", "quotedPrice": 45.00, "quotedTurnaroundDays": 5 }`
   - **Expected**: 200 success

3. **Patient sees quote** `GET /api/v1/compounding/:id`
   - **Expected**: `quotedPrice = "45.00"`, `quotedTurnaroundDays = 5`, `status = "quoted"`, `internalNotes` ABSENT

4. **Patient accepts** `POST /api/v1/compounding/:id/accept`
   - **Expected**: 200 success

5. **Patient views** `GET /api/v1/compounding/:id`
   - **Expected**: `status = "accepted"`

6. **Pharmacist marks ready** `PATCH /api/v1/admin/compounding/:id/status`
   - Body: `{ "newStatus": "ready" }`
   - **Expected**: 200 success. Status history has 4 entries.

---

## Scenario 3: Minor Ailment Assessment + Treatment

1. **List catalog** `GET /api/v1/minor-ailments/catalog` (no auth needed)
   - **Expected**: 200, 19 ailments returned (seeded Ontario list), `is_active = true`

2. **Patient submits assessment** `POST /api/v1/minor-ailments/assessments`
   - Body: `{ "ailmentId": "<allergic-rhinitis-id>", "symptoms": "Runny nose and sneezing for 5 days", "duration": "5 days" }`
   - **Expected**: 201, `status = "submitted"`

3. **Pharmacist treats** `PATCH /api/v1/admin/minor-ailments/assessments/:id/status`
   - Body: `{ "newStatus": "treated", "treatmentNote": "Recommended Reactine 10mg once daily" }`
   - **Expected**: 200 success

4. **Patient views result** `GET /api/v1/minor-ailments/assessments/:id`
   - **Expected**: `status = "treated"`, `treatmentNote` present, `internalNotes` ABSENT

5. **Deactivated ailment blocked** — admin deactivates an ailment, patient tries to submit for it
   - **Expected**: 422, `error.code = "AILMENT_INACTIVE"`

---

## Scenario 4: Ask-a-Pharmacist — Multi-turn Conversation

1. **Patient starts conversation** `POST /api/v1/ask-pharmacist`
   - Body: `{ "subject": "Drug interaction", "body": "Is it safe to take ibuprofen with my blood pressure medication?", "medicationName": "Ibuprofen" }`
   - **Expected**: 201, `status = "open"`, `messages` array has 1 entry with `senderType = "patient"`

2. **Admin assigns pharmacist** `PATCH /api/v1/admin/ask-pharmacist/:id/assign`
   - Body: `{ "assignedTo": "<pharmacist-user-id>" }`
   - **Expected**: 200, conversation `status = "in_progress"`

3. **Pharmacist replies** `POST /api/v1/admin/ask-pharmacist/:id/messages`
   - Body: `{ "body": "NSAIDs like ibuprofen can raise blood pressure. Please consult your prescriber before using." }`
   - **Expected**: 201, message added

4. **Patient follows up** `POST /api/v1/ask-pharmacist/:id/messages`
   - Body: `{ "body": "Thank you! Can I use Tylenol instead?" }`
   - **Expected**: 201, thread now has 3 messages

5. **Patient view** `GET /api/v1/ask-pharmacist/:id`
   - **Expected**: 3 messages visible, `internalNotes` ABSENT

6. **Resolve conversation** `PATCH /api/v1/admin/ask-pharmacist/:id/status`
   - Body: `{ "newStatus": "resolved" }`
   - **Expected**: 200 success

7. **Message after resolve blocked** `POST /api/v1/ask-pharmacist/:id/messages`
   - **Expected**: 422, `error.code = "CONVERSATION_CLOSED"`

---

## Scenario 5: Security — Patient Isolation

- Patient A submits a prescription. Patient B tries `GET /api/v1/prescriptions/<patient-A-request-id>`
- **Expected**: 404 (not 403 — do not reveal existence)

- Same isolation test for compounding, minor ailment assessments, and conversations.

---

## Scenario 6: Internal Notes Never Leaked

For each module, create a request, have admin set `internalNotes`, then call the patient-facing detail endpoint.

- **Expected for ALL modules**: Response JSON does NOT contain an `internalNotes` field.
- Verify with: `JSON.stringify(response.data).includes('internalNotes')` → must be `false`

---

## Scenario 7: Audit Log Verification

After any admin status-change action, check `audit_log` table directly:
- `action` field matches expected (e.g., `prescription.status_changed`)
- `resource_id` matches the request ID
- `actor_id` matches the pharmacist user ID
- `facility_id` matches the test facility

---

## Key References

- State machines: `specs/005-healthcare-workflows/data-model.md`
- API contracts:
  - `specs/005-healthcare-workflows/contracts/prescriptions.md`
  - `specs/005-healthcare-workflows/contracts/compounding.md`
  - `specs/005-healthcare-workflows/contracts/minor-ailments.md`
  - `specs/005-healthcare-workflows/contracts/ask-pharmacist.md`
- Permissions: `backend/src/db/seeds/healthcare-permissions.ts`

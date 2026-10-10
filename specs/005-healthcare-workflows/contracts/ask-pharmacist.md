# API Contract: Ask-a-Pharmacist

Base path: `/api/v1`  
All requests require `X-Facility-ID: <facilityId>` header.

---

## POST /ask-pharmacist — Start Conversation (Patient)

**Auth**: `authMiddleware` (patient)

**Request Body**:
```json
{
  "subject": "Drug interaction question",
  "body": "I was just prescribed Warfarin and I take Aspirin daily. Is this combination safe?",
  "medicationName": "Warfarin + Aspirin"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `subject` | string | yes | min 1, max 200 chars |
| `body` | string | yes | min 10 chars |
| `medicationName` | string | no | max 200 chars |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "subject": "Drug interaction question",
    "medicationName": "Warfarin + Aspirin",
    "status": "open",
    "assignedTo": null,
    "messages": [
      {
        "id": "uuid",
        "senderType": "patient",
        "body": "I was just prescribed Warfarin and I take Aspirin daily. Is this combination safe?",
        "createdAt": "..."
      }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Note: `internalNotes` NEVER in patient response.

---

## GET /ask-pharmacist — List Patient's Own Conversations

**Auth**: `authMiddleware`

**Query Params**: `status?`, `page?`, `limit?`

**Response 200**: Paginated list of patient's own conversations (no messages array in list view).

---

## GET /ask-pharmacist/:id — Patient Conversation Detail

**Auth**: `authMiddleware` — 404 if not owned

**Response 200**: Full conversation with all messages thread.

**Errors**: `404 CONVERSATION_NOT_FOUND`

---

## POST /ask-pharmacist/:id/messages — Patient Follow-up Message

**Auth**: `authMiddleware` (patient — must own the conversation)

Conversation must be `open` or `in_progress` (not `resolved` or `closed`).

**Request Body**:
```json
{ "body": "Thank you for the info. Should I take them at different times?" }
```

**Response 201**: Created message.

**Errors**: `404 CONVERSATION_NOT_FOUND`, `422 CONVERSATION_CLOSED`

---

## GET /admin/ask-pharmacist — Admin List

**Auth**: `authMiddleware` + `requirePermission('ask-pharmacist.read')`

**Query Params**: `status?`, `assignedTo?`, `patientId?`, `dateFrom?`, `dateTo?`, `page?`, `limit?`, `sort?`

**Response 200**: Paginated list including `patientName`, `assignedToName`.

---

## GET /admin/ask-pharmacist/:id — Admin Detail

**Auth**: `authMiddleware` + `requirePermission('ask-pharmacist.read')`

**Response 200**: Full conversation including `internalNotes`, `patientEmail`, full message thread.

---

## POST /admin/ask-pharmacist/:id/messages — Staff Reply

**Auth**: `authMiddleware` + `requirePermission('ask-pharmacist.manage')`

Conversation must be `open` or `in_progress`.

**Request Body**:
```json
{ "body": "Yes, Warfarin and Aspirin together significantly increase bleeding risk. Please consult your prescriber before combining them." }
```

**Response 201**: Created message. If conversation was `open`, status auto-advances to `in_progress`.

**Errors**: `404 CONVERSATION_NOT_FOUND`, `422 CONVERSATION_CLOSED`

---

## PATCH /admin/ask-pharmacist/:id/assign — Assign Pharmacist

**Auth**: `authMiddleware` + `requirePermission('ask-pharmacist.manage')`

**Request Body**:
```json
{ "assignedTo": "uuid-of-pharmacist-user" }
```

Status advances from `open` → `in_progress` if not already.

**Response 200**: `{ "data": { "success": true } }`

---

## PATCH /admin/ask-pharmacist/:id/status — Change Status (Resolve/Close)

**Auth**: `authMiddleware` + `requirePermission('ask-pharmacist.manage')`

**Request Body**:
```json
{
  "newStatus": "resolved",
  "note": "Question fully answered"
}
```

Valid transitions: `open | in_progress → resolved | closed`

**Response 200**: `{ "data": { "success": true } }`

**Errors**: `404 CONVERSATION_NOT_FOUND`, `422 HEALTHCARE_INVALID_STATUS_TRANSITION`

---

## PATCH /admin/ask-pharmacist/:id/notes — Update Internal Notes

**Auth**: `authMiddleware` + `requirePermission('ask-pharmacist.manage')`

**Request Body**: `{ "notes": "Patient has history of bleeding complications" }`

**Response 200**: `{ "data": { "success": true } }`

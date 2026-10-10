import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import {
  insertConversation,
  insertMessage,
  findConversationById,
  findConversationForPatient,
  findConversationDetailForPatient,
  listConversationsForPatient,
  findConversationDetailForAdmin,
  listConversationsForAdmin,
  updateConversationStatus,
  updateConversationAssignee,
  updateConversationNotes,
} from './ask-pharmacist.queries';
import { validateConversationTransition } from './ask-pharmacist.types';
import type {
  ConversationStatus,
  PatientConversationDetail,
  AdminConversationDetail,
  PatientConversationSummary,
} from './ask-pharmacist.types';
import type {
  StartConversationBody,
  AddMessageBody,
  AssignConversationBody,
  ConversationStatusBody,
  UpdateConversationNotesBody,
  ListConversationsQuery,
  AdminListConversationsQuery,
} from './ask-pharmacist.validator';

// ── startConversation ─────────────────────────────────────────────────────

export async function startConversation(
  auth: AuthContext,
  input: StartConversationBody,
): Promise<PatientConversationDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const { id } = await insertConversation(
      {
        facilityId,
        patientId: auth.userId,
        subject: input.subject,
        medicationName: input.medicationName,
        status: 'open',
      },
      tx,
    );

    await insertMessage(
      {
        conversationId: id,
        facilityId,
        senderId: auth.userId,
        senderType: 'patient',
        body: input.body,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'ask_pharmacist.started',
        resourceType: 'pharmacist_conversation',
        resourceId: id,
      },
      tx,
    );

    const detail = await findConversationDetailForPatient(facilityId, id, auth.userId, tx);
    return detail!;
  });
}

// ── listPatientConversations ──────────────────────────────────────────────

export async function listPatientConversations(
  auth: AuthContext,
  opts: ListConversationsQuery,
): Promise<{ rows: PatientConversationSummary[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listConversationsForPatient(
      facilityId,
      auth.userId,
      { status: opts.status as ConversationStatus | undefined, page: opts.page, limit: opts.limit },
      tx,
    );
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getPatientConversationDetail ──────────────────────────────────────────

export async function getPatientConversationDetail(
  auth: AuthContext,
  id: string,
): Promise<PatientConversationDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findConversationDetailForPatient(facilityId, id, auth.userId, tx);
    if (!detail) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }
    return detail;
  });
}

// ── addPatientMessage ─────────────────────────────────────────────────────

export async function addPatientMessage(
  auth: AuthContext,
  id: string,
  input: AddMessageBody,
): Promise<{ id: string }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const conv = await findConversationForPatient(facilityId, id, auth.userId, tx);
    if (!conv) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    const status = conv.status as ConversationStatus;
    if (status === 'resolved' || status === 'closed') {
      throw new AppError(
        'CONVERSATION_CLOSED',
        'This conversation is resolved and no longer accepting messages',
        422,
      );
    }

    const msg = await insertMessage(
      {
        conversationId: id,
        facilityId,
        senderId: auth.userId,
        senderType: 'patient',
        body: input.body,
      },
      tx,
    );

    return msg;
  });
}

// ── listAdminConversations ────────────────────────────────────────────────

export async function listAdminConversations(
  auth: AuthContext,
  opts: AdminListConversationsQuery,
): Promise<{ rows: (PatientConversationSummary & { patientName: string; assignedToName: string | null })[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listConversationsForAdmin(facilityId, opts, tx);
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getAdminConversationDetail ────────────────────────────────────────────

export async function getAdminConversationDetail(
  auth: AuthContext,
  id: string,
): Promise<AdminConversationDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findConversationDetailForAdmin(facilityId, id, tx);
    if (!detail) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }
    return detail;
  });
}

// ── addStaffMessage ───────────────────────────────────────────────────────
// Auto-advances conversation from 'open' to 'in_progress' on first staff reply.

export async function addStaffMessage(
  auth: AuthContext,
  id: string,
  input: AddMessageBody,
): Promise<{ id: string }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const conv = await findConversationById(id, tx);
    if (!conv) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    const status = conv.status as ConversationStatus;
    if (status === 'resolved' || status === 'closed') {
      throw new AppError(
        'CONVERSATION_CLOSED',
        'This conversation is resolved and no longer accepting messages',
        422,
      );
    }

    const msg = await insertMessage(
      {
        conversationId: id,
        facilityId,
        senderId: auth.userId,
        senderType: 'staff',
        body: input.body,
      },
      tx,
    );

    // Auto-advance open → in_progress on first staff reply
    if (status === 'open') {
      await updateConversationStatus(id, 'in_progress', tx);
    }

    return msg;
  });
}

// ── assignConversation ────────────────────────────────────────────────────

export async function assignConversation(
  auth: AuthContext,
  id: string,
  input: AssignConversationBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const conv = await findConversationById(id, tx);
    if (!conv) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    await updateConversationAssignee(id, input.assignedTo, tx);

    if ((conv.status as ConversationStatus) === 'open') {
      await updateConversationStatus(id, 'in_progress', tx);
    }

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'ask_pharmacist.assigned',
        resourceType: 'pharmacist_conversation',
        resourceId: id,
        metadata: { assignedTo: input.assignedTo },
      },
      tx,
    );
  });
}

// ── changeConversationStatus ──────────────────────────────────────────────

export async function changeConversationStatus(
  auth: AuthContext,
  id: string,
  input: ConversationStatusBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const conv = await findConversationById(id, tx);
    if (!conv) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    validateConversationTransition(conv.status as ConversationStatus, input.newStatus as ConversationStatus);

    await updateConversationStatus(id, input.newStatus as ConversationStatus, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'ask_pharmacist.status_changed',
        resourceType: 'pharmacist_conversation',
        resourceId: id,
        metadata: { from: conv.status, to: input.newStatus, note: input.note },
      },
      tx,
    );
  });
}

// ── updateConversationNotesService ────────────────────────────────────────

export async function updateConversationNotesService(
  auth: AuthContext,
  id: string,
  input: UpdateConversationNotesBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const conv = await findConversationById(id, tx);
    if (!conv) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    await updateConversationNotes(id, input.notes, tx);
  });
}

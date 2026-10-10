import { eq, sql, and } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { pharmacistConversations, conversationMessages } from '@/db/schema/healthcare';
import type {
  ConversationStatus,
  ConversationMessage,
  PatientConversationSummary,
  PatientConversationDetail,
  AdminConversationDetail,
} from './ask-pharmacist.types';

// ── insertConversation ────────────────────────────────────────────────────

export async function insertConversation(
  data: typeof pharmacistConversations.$inferInsert,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(pharmacistConversations)
    .values(data)
    .returning({ id: pharmacistConversations.id });
  return row;
}

// ── insertMessage ─────────────────────────────────────────────────────────

export async function insertMessage(
  data: typeof conversationMessages.$inferInsert,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(conversationMessages)
    .values(data)
    .returning({ id: conversationMessages.id });
  return row;
}

// ── findConversationById ──────────────────────────────────────────────────

export async function findConversationById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof pharmacistConversations.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(pharmacistConversations)
    .where(eq(pharmacistConversations.id, id))
    .limit(1);
  return row;
}

// ── findConversationForPatient ────────────────────────────────────────────

export async function findConversationForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<typeof pharmacistConversations.$inferSelect | null> {
  const [row] = await tx
    .select()
    .from(pharmacistConversations)
    .where(
      and(
        eq(pharmacistConversations.id, id),
        eq(pharmacistConversations.facilityId, facilityId),
        eq(pharmacistConversations.patientId, patientId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── listConversationsForPatient ───────────────────────────────────────────

export async function listConversationsForPatient(
  facilityId: string,
  patientId: string,
  opts: { status?: ConversationStatus; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: PatientConversationSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions = [
    sql`c.facility_id = ${facilityId}`,
    sql`c.patient_id = ${patientId}`,
  ];
  if (opts.status) conditions.push(sql`c.status = ${opts.status}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count FROM pharmacist_conversations c WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      c.id, c.subject, c.medication_name, c.status, c.created_at,
      COUNT(m.id)::int AS message_count,
      MAX(m.created_at) AS last_message_at
    FROM pharmacist_conversations c
    LEFT JOIN conversation_messages m ON m.conversation_id = c.id
    WHERE ${whereClause}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      subject: r.subject as string,
      medicationName: (r.medication_name as string | null) ?? null,
      status: r.status as ConversationStatus,
      messageCount: r.message_count as number,
      lastMessageAt: (r.last_message_at as Date | null) ?? null,
      createdAt: r.created_at as Date,
    })),
    total,
  };
}

// ── findConversationDetailForPatient ──────────────────────────────────────

export async function findConversationDetailForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<PatientConversationDetail | null> {
  const convRows = await tx.execute(sql`
    SELECT
      c.id, c.subject, c.medication_name, c.status, c.created_at,
      COUNT(m.id)::int AS message_count,
      MAX(m.created_at) AS last_message_at
    FROM pharmacist_conversations c
    LEFT JOIN conversation_messages m ON m.conversation_id = c.id
    WHERE c.id = ${id}
      AND c.facility_id = ${facilityId}
      AND c.patient_id = ${patientId}
    GROUP BY c.id
  `);

  if (!convRows.length) return null;

  const conv = (convRows as unknown as Record<string, unknown>[])[0];

  const msgRows = await tx.execute(sql`
    SELECT
      m.id, m.sender_type, m.body, m.created_at,
      CONCAT(u.first_name, ' ', u.last_name) AS sender_name
    FROM conversation_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ${id}
    ORDER BY m.created_at ASC
  `);

  const messages: ConversationMessage[] = (msgRows as unknown as Record<string, unknown>[]).map((m) => ({
    id: m.id as string,
    conversationId: id,
    senderType: m.sender_type as ConversationMessage['senderType'],
    senderName: m.sender_name as string,
    body: m.body as string,
    createdAt: m.created_at as Date,
  }));

  return {
    id: conv.id as string,
    subject: conv.subject as string,
    medicationName: (conv.medication_name as string | null) ?? null,
    status: conv.status as ConversationStatus,
    messageCount: conv.message_count as number,
    lastMessageAt: (conv.last_message_at as Date | null) ?? null,
    createdAt: conv.created_at as Date,
    messages,
  };
}

// ── listConversationsForAdmin ─────────────────────────────────────────────

export async function listConversationsForAdmin(
  facilityId: string,
  opts: {
    status?: ConversationStatus;
    assignedTo?: string;
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort: 'createdAt:asc' | 'createdAt:desc';
  },
  tx: TenantTransaction,
): Promise<{ rows: (PatientConversationSummary & { patientName: string; assignedToName: string | null })[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const orderDir = opts.sort === 'createdAt:asc' ? 'ASC' : 'DESC';

  const conditions = [sql`c.facility_id = ${facilityId}`];
  if (opts.status) conditions.push(sql`c.status = ${opts.status}`);
  if (opts.assignedTo) conditions.push(sql`c.assigned_to = ${opts.assignedTo}`);
  if (opts.patientId) conditions.push(sql`c.patient_id = ${opts.patientId}`);
  if (opts.dateFrom) conditions.push(sql`c.created_at >= ${opts.dateFrom}::date`);
  if (opts.dateTo) conditions.push(sql`c.created_at < (${opts.dateTo}::date + interval '1 day')`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count FROM pharmacist_conversations c WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      c.id, c.subject, c.medication_name, c.status, c.created_at,
      COUNT(m.id)::int AS message_count,
      MAX(m.created_at) AS last_message_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      CONCAT(a.first_name, ' ', a.last_name) AS assigned_to_name
    FROM pharmacist_conversations c
    JOIN users p ON p.id = c.patient_id
    LEFT JOIN users a ON a.id = c.assigned_to
    LEFT JOIN conversation_messages m ON m.conversation_id = c.id
    WHERE ${whereClause}
    GROUP BY c.id, p.first_name, p.last_name, a.first_name, a.last_name
    ORDER BY c.created_at ${orderDir === 'ASC' ? sql`ASC` : sql`DESC`}
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      subject: r.subject as string,
      medicationName: (r.medication_name as string | null) ?? null,
      status: r.status as ConversationStatus,
      messageCount: r.message_count as number,
      lastMessageAt: (r.last_message_at as Date | null) ?? null,
      createdAt: r.created_at as Date,
      patientName: r.patient_name as string,
      assignedToName: (r.assigned_to_name as string | null) ?? null,
    })),
    total,
  };
}

// ── findConversationDetailForAdmin ────────────────────────────────────────

export async function findConversationDetailForAdmin(
  facilityId: string,
  id: string,
  tx: TenantTransaction,
): Promise<AdminConversationDetail | null> {
  const convRows = await tx.execute(sql`
    SELECT
      c.id, c.subject, c.medication_name, c.status, c.internal_notes,
      c.patient_id, c.assigned_to AS assigned_to_id, c.created_at,
      COUNT(m.id)::int AS message_count,
      MAX(m.created_at) AS last_message_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.email AS patient_email,
      CONCAT(a.first_name, ' ', a.last_name) AS assigned_to_name
    FROM pharmacist_conversations c
    JOIN users p ON p.id = c.patient_id
    LEFT JOIN users a ON a.id = c.assigned_to
    LEFT JOIN conversation_messages m ON m.conversation_id = c.id
    WHERE c.id = ${id}
      AND c.facility_id = ${facilityId}
    GROUP BY c.id, p.first_name, p.last_name, p.email, a.first_name, a.last_name
  `);

  if (!convRows.length) return null;

  const conv = (convRows as unknown as Record<string, unknown>[])[0];

  const msgRows = await tx.execute(sql`
    SELECT
      m.id, m.sender_type, m.body, m.created_at,
      CONCAT(u.first_name, ' ', u.last_name) AS sender_name
    FROM conversation_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ${id}
    ORDER BY m.created_at ASC
  `);

  const messages: ConversationMessage[] = (msgRows as unknown as Record<string, unknown>[]).map((m) => ({
    id: m.id as string,
    conversationId: id,
    senderType: m.sender_type as ConversationMessage['senderType'],
    senderName: m.sender_name as string,
    body: m.body as string,
    createdAt: m.created_at as Date,
  }));

  return {
    id: conv.id as string,
    subject: conv.subject as string,
    medicationName: (conv.medication_name as string | null) ?? null,
    status: conv.status as ConversationStatus,
    internalNotes: (conv.internal_notes as string | null) ?? null,
    patientId: conv.patient_id as string,
    patientName: conv.patient_name as string,
    patientEmail: conv.patient_email as string,
    assignedToId: (conv.assigned_to_id as string | null) ?? null,
    assignedToName: (conv.assigned_to_name as string | null) ?? null,
    messageCount: conv.message_count as number,
    lastMessageAt: (conv.last_message_at as Date | null) ?? null,
    createdAt: conv.created_at as Date,
    messages,
  };
}

// ── updateConversationStatus ──────────────────────────────────────────────

export async function updateConversationStatus(
  id: string,
  status: ConversationStatus,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(pharmacistConversations)
    .set({ status, updatedAt: new Date() })
    .where(eq(pharmacistConversations.id, id));
}

// ── updateConversationAssignee ────────────────────────────────────────────

export async function updateConversationAssignee(
  id: string,
  assignedTo: string,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(pharmacistConversations)
    .set({ assignedTo, updatedAt: new Date() })
    .where(eq(pharmacistConversations.id, id));
}

// ── updateConversationNotes ───────────────────────────────────────────────

export async function updateConversationNotes(
  id: string,
  notes: string,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(pharmacistConversations)
    .set({ internalNotes: notes, updatedAt: new Date() })
    .where(eq(pharmacistConversations.id, id));
}

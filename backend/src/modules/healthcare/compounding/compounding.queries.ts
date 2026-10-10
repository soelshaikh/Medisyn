import { eq, sql, and } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { compoundingRequests, compoundingRequestHistory } from '@/db/schema/healthcare';
import type {
  CompoundingStatus,
  PatientCompoundingSummary,
  PatientCompoundingDetail,
  AdminCompoundingDetail,
} from './compounding.types';

// ── insertCompoundingRequest ──────────────────────────────────────────────

export async function insertCompoundingRequest(
  data: typeof compoundingRequests.$inferInsert,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(compoundingRequests)
    .values(data)
    .returning({ id: compoundingRequests.id });
  return row;
}

// ── insertCompoundingHistory ──────────────────────────────────────────────

export async function insertCompoundingHistory(
  data: typeof compoundingRequestHistory.$inferInsert,
  tx: TenantTransaction,
): Promise<void> {
  await tx.insert(compoundingRequestHistory).values(data);
}

// ── findCompoundingById ───────────────────────────────────────────────────

export async function findCompoundingById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof compoundingRequests.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(compoundingRequests)
    .where(eq(compoundingRequests.id, id))
    .limit(1);
  return row;
}

// ── findCompoundingForPatient ─────────────────────────────────────────────

export async function findCompoundingForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<typeof compoundingRequests.$inferSelect | null> {
  const [row] = await tx
    .select()
    .from(compoundingRequests)
    .where(
      and(
        eq(compoundingRequests.id, id),
        eq(compoundingRequests.facilityId, facilityId),
        eq(compoundingRequests.patientId, patientId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── listCompoundingForPatient ─────────────────────────────────────────────

export async function listCompoundingForPatient(
  facilityId: string,
  patientId: string,
  opts: { status?: CompoundingStatus; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: PatientCompoundingSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions = [
    sql`facility_id = ${facilityId}`,
    sql`patient_id = ${patientId}`,
  ];
  if (opts.status) conditions.push(sql`status = ${opts.status}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count FROM compounding_requests WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT id, compound_name, form, status, quoted_price, quoted_turnaround_days, created_at, updated_at
    FROM compounding_requests
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      compoundName: r.compound_name as string,
      form: r.form as PatientCompoundingSummary['form'],
      status: r.status as CompoundingStatus,
      quotedPrice: (r.quoted_price as string | null) ?? null,
      quotedTurnaroundDays: (r.quoted_turnaround_days as number | null) ?? null,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    })),
    total,
  };
}

// ── findCompoundingDetailForPatient ───────────────────────────────────────

export async function findCompoundingDetailForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<PatientCompoundingDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      r.id, r.compound_name, r.strength, r.form, r.quantity, r.special_instructions,
      r.prescriber_name, r.file_reference, r.quoted_price, r.quoted_turnaround_days,
      r.status, r.created_at, r.updated_at,
      h.id AS h_id, h.previous_status, h.new_status, h.changed_by_id,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM compounding_requests r
    LEFT JOIN compounding_request_history h ON h.request_id = r.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE r.id = ${id}
      AND r.facility_id = ${facilityId}
      AND r.patient_id = ${patientId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: PatientCompoundingDetail = {
    id: first.id as string,
    compoundName: first.compound_name as string,
    strength: (first.strength as string | null) ?? null,
    form: first.form as PatientCompoundingDetail['form'],
    quantity: first.quantity as string,
    specialInstructions: (first.special_instructions as string | null) ?? null,
    prescriberName: (first.prescriber_name as string | null) ?? null,
    fileReference: (first.file_reference as string | null) ?? null,
    quotedPrice: (first.quoted_price as string | null) ?? null,
    quotedTurnaroundDays: (first.quoted_turnaround_days as number | null) ?? null,
    status: first.status as CompoundingStatus,
    createdAt: first.created_at as Date,
    updatedAt: first.updated_at as Date,
    statusHistory: [],
  };

  for (const row of rows as unknown as Record<string, unknown>[]) {
    if (row.h_id) {
      detail.statusHistory.push({
        id: row.h_id as string,
        requestId: id,
        facilityId,
        previousStatus: (row.previous_status as CompoundingStatus | null) ?? null,
        newStatus: row.new_status as CompoundingStatus,
        changedById: (row.changed_by_id as string | null) ?? null,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

// ── listCompoundingForAdmin ───────────────────────────────────────────────

export async function listCompoundingForAdmin(
  facilityId: string,
  opts: {
    status?: CompoundingStatus;
    patientId?: string;
    form?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort: 'createdAt:asc' | 'createdAt:desc';
  },
  tx: TenantTransaction,
): Promise<{ rows: (PatientCompoundingSummary & { patientName: string })[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const orderDir = opts.sort === 'createdAt:asc' ? 'ASC' : 'DESC';

  const conditions = [eq(compoundingRequests.facilityId, facilityId)];
  if (opts.status) conditions.push(eq(compoundingRequests.status, opts.status));
  if (opts.patientId) conditions.push(eq(compoundingRequests.patientId, opts.patientId));
  if (opts.form) conditions.push(eq(compoundingRequests.form, opts.form));
  if (opts.dateFrom) {
    conditions.push(sql`compounding_requests.created_at >= ${opts.dateFrom}::date`);
  }
  if (opts.dateTo) {
    conditions.push(sql`compounding_requests.created_at < (${opts.dateTo}::date + interval '1 day')`);
  }

  const whereExpr = and(...conditions);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count FROM compounding_requests WHERE ${whereExpr}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      r.id, r.compound_name, r.form, r.status, r.quoted_price, r.quoted_turnaround_days,
      r.created_at, r.updated_at,
      CONCAT(u.first_name, ' ', u.last_name) AS patient_name
    FROM compounding_requests r
    JOIN users u ON u.id = r.patient_id
    WHERE ${whereExpr}
    ORDER BY r.created_at ${orderDir === 'ASC' ? sql`ASC` : sql`DESC`}
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      compoundName: r.compound_name as string,
      form: r.form as PatientCompoundingSummary['form'],
      status: r.status as CompoundingStatus,
      quotedPrice: (r.quoted_price as string | null) ?? null,
      quotedTurnaroundDays: (r.quoted_turnaround_days as number | null) ?? null,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
      patientName: r.patient_name as string,
    })),
    total,
  };
}

// ── findCompoundingDetailForAdmin ─────────────────────────────────────────

export async function findCompoundingDetailForAdmin(
  facilityId: string,
  id: string,
  tx: TenantTransaction,
): Promise<AdminCompoundingDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      r.id, r.compound_name, r.strength, r.form, r.quantity, r.special_instructions,
      r.prescriber_name, r.file_reference, r.quoted_price, r.quoted_turnaround_days,
      r.status, r.internal_notes, r.patient_id, r.created_at, r.updated_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.email AS patient_email,
      h.id AS h_id, h.previous_status, h.new_status, h.changed_by_id,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM compounding_requests r
    JOIN users p ON p.id = r.patient_id
    LEFT JOIN compounding_request_history h ON h.request_id = r.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE r.id = ${id}
      AND r.facility_id = ${facilityId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: AdminCompoundingDetail = {
    id: first.id as string,
    compoundName: first.compound_name as string,
    strength: (first.strength as string | null) ?? null,
    form: first.form as AdminCompoundingDetail['form'],
    quantity: first.quantity as string,
    specialInstructions: (first.special_instructions as string | null) ?? null,
    prescriberName: (first.prescriber_name as string | null) ?? null,
    fileReference: (first.file_reference as string | null) ?? null,
    quotedPrice: (first.quoted_price as string | null) ?? null,
    quotedTurnaroundDays: (first.quoted_turnaround_days as number | null) ?? null,
    status: first.status as CompoundingStatus,
    internalNotes: (first.internal_notes as string | null) ?? null,
    patientId: first.patient_id as string,
    patientName: first.patient_name as string,
    patientEmail: first.patient_email as string,
    createdAt: first.created_at as Date,
    updatedAt: first.updated_at as Date,
    statusHistory: [],
  };

  for (const row of rows as unknown as Record<string, unknown>[]) {
    if (row.h_id) {
      detail.statusHistory.push({
        id: row.h_id as string,
        requestId: id,
        facilityId,
        previousStatus: (row.previous_status as CompoundingStatus | null) ?? null,
        newStatus: row.new_status as CompoundingStatus,
        changedById: (row.changed_by_id as string | null) ?? null,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

// ── updateCompoundingStatus ───────────────────────────────────────────────

export async function updateCompoundingStatus(
  id: string,
  data: {
    status: CompoundingStatus;
    quotedPrice?: number;
    quotedTurnaroundDays?: number;
    internalNotes?: string;
    updatedAt: Date;
  },
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(compoundingRequests)
    .set({
      status: data.status,
      ...(data.quotedPrice !== undefined && { quotedPrice: String(data.quotedPrice) }),
      ...(data.quotedTurnaroundDays !== undefined && { quotedTurnaroundDays: data.quotedTurnaroundDays }),
      ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
      updatedAt: data.updatedAt,
    })
    .where(eq(compoundingRequests.id, id));
}

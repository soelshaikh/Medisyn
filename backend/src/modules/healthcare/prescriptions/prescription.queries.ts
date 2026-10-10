import { eq, sql, and } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { prescriptionRequests, prescriptionRequestHistory } from '@/db/schema/healthcare';
import type {
  PrescriptionStatus,
  PatientPrescriptionSummary,
  PatientPrescriptionDetail,
  AdminPrescriptionDetail,
} from './prescription.types';

// ── insertPrescriptionRequest ─────────────────────────────────────────────

export async function insertPrescriptionRequest(
  data: typeof prescriptionRequests.$inferInsert,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(prescriptionRequests)
    .values(data)
    .returning({ id: prescriptionRequests.id });
  return row;
}

// ── insertPrescriptionHistory ─────────────────────────────────────────────

export async function insertPrescriptionHistory(
  data: typeof prescriptionRequestHistory.$inferInsert,
  tx: TenantTransaction,
): Promise<void> {
  await tx.insert(prescriptionRequestHistory).values(data);
}

// ── findPrescriptionById ──────────────────────────────────────────────────

export async function findPrescriptionById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof prescriptionRequests.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(prescriptionRequests)
    .where(eq(prescriptionRequests.id, id))
    .limit(1);
  return row;
}

// ── findPrescriptionForPatient ────────────────────────────────────────────
// Returns null (not undefined) when patient_id does not match — caller throws 404 in both cases.

export async function findPrescriptionForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<typeof prescriptionRequests.$inferSelect | null> {
  const [row] = await tx
    .select()
    .from(prescriptionRequests)
    .where(
      and(
        eq(prescriptionRequests.id, id),
        eq(prescriptionRequests.facilityId, facilityId),
        eq(prescriptionRequests.patientId, patientId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── listPrescriptionsForPatient ───────────────────────────────────────────

export async function listPrescriptionsForPatient(
  facilityId: string,
  patientId: string,
  opts: { status?: PrescriptionStatus; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: PatientPrescriptionSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions = [
    sql`facility_id = ${facilityId}`,
    sql`patient_id = ${patientId}`,
  ];
  if (opts.status) {
    conditions.push(sql`status = ${opts.status}`);
  }
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM prescription_requests
    WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT id, type, medication_name, dosage, status, created_at, updated_at
    FROM prescription_requests
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      type: r.type as PatientPrescriptionSummary['type'],
      medicationName: r.medication_name as string,
      dosage: (r.dosage as string | null) ?? null,
      status: r.status as PrescriptionStatus,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    })),
    total,
  };
}

// ── findPrescriptionDetailForPatient ─────────────────────────────────────
// Returns full detail with status history. internalNotes omitted structurally.

export async function findPrescriptionDetailForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<PatientPrescriptionDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      r.id, r.type, r.medication_name, r.dosage, r.prescriber_name, r.prescriber_fax,
      r.file_reference, r.status, r.dispense_notes, r.created_at, r.updated_at,
      h.id AS h_id, h.previous_status, h.new_status, h.changed_by_id,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM prescription_requests r
    LEFT JOIN prescription_request_history h ON h.request_id = r.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE r.id = ${id}
      AND r.facility_id = ${facilityId}
      AND r.patient_id = ${patientId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: PatientPrescriptionDetail = {
    id: first.id as string,
    type: first.type as PatientPrescriptionDetail['type'],
    medicationName: first.medication_name as string,
    dosage: (first.dosage as string | null) ?? null,
    prescriberName: (first.prescriber_name as string | null) ?? null,
    prescriberFax: (first.prescriber_fax as string | null) ?? null,
    fileReference: (first.file_reference as string | null) ?? null,
    dispenseNotes: (first.dispense_notes as string | null) ?? null,
    status: first.status as PrescriptionStatus,
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
        previousStatus: (row.previous_status as PrescriptionStatus | null) ?? null,
        newStatus: row.new_status as PrescriptionStatus,
        changedById: (row.changed_by_id as string | null) ?? null,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

// ── listPrescriptionsForAdmin ─────────────────────────────────────────────

export async function listPrescriptionsForAdmin(
  facilityId: string,
  opts: {
    status?: PrescriptionStatus;
    patientId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort: 'createdAt:asc' | 'createdAt:desc';
  },
  tx: TenantTransaction,
): Promise<{ rows: (PatientPrescriptionSummary & { patientName: string })[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const orderDir = opts.sort === 'createdAt:asc' ? 'ASC' : 'DESC';

  const conditions = [eq(prescriptionRequests.facilityId, facilityId)];
  if (opts.status) conditions.push(eq(prescriptionRequests.status, opts.status));
  if (opts.patientId) conditions.push(eq(prescriptionRequests.patientId, opts.patientId));
  if (opts.type) conditions.push(eq(prescriptionRequests.type, opts.type));
  if (opts.dateFrom) {
    conditions.push(sql`prescription_requests.created_at >= ${opts.dateFrom}::date`);
  }
  if (opts.dateTo) {
    conditions.push(sql`prescription_requests.created_at < (${opts.dateTo}::date + interval '1 day')`);
  }

  const whereExpr = and(...conditions);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM prescription_requests
    WHERE ${whereExpr}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      r.id, r.type, r.medication_name, r.dosage, r.status, r.created_at, r.updated_at,
      CONCAT(u.first_name, ' ', u.last_name) AS patient_name
    FROM prescription_requests r
    JOIN users u ON u.id = r.patient_id
    WHERE ${whereExpr}
    ORDER BY r.created_at ${orderDir === 'ASC' ? sql`ASC` : sql`DESC`}
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      type: r.type as PatientPrescriptionSummary['type'],
      medicationName: r.medication_name as string,
      dosage: (r.dosage as string | null) ?? null,
      status: r.status as PrescriptionStatus,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
      patientName: r.patient_name as string,
    })),
    total,
  };
}

// ── findPrescriptionDetailForAdmin ────────────────────────────────────────

export async function findPrescriptionDetailForAdmin(
  facilityId: string,
  id: string,
  tx: TenantTransaction,
): Promise<AdminPrescriptionDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      r.id, r.type, r.medication_name, r.dosage, r.prescriber_name, r.prescriber_fax,
      r.file_reference, r.status, r.dispense_notes, r.internal_notes,
      r.patient_id, r.created_at, r.updated_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.email AS patient_email,
      h.id AS h_id, h.previous_status, h.new_status, h.changed_by_id,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM prescription_requests r
    JOIN users p ON p.id = r.patient_id
    LEFT JOIN prescription_request_history h ON h.request_id = r.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE r.id = ${id}
      AND r.facility_id = ${facilityId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: AdminPrescriptionDetail = {
    id: first.id as string,
    type: first.type as AdminPrescriptionDetail['type'],
    medicationName: first.medication_name as string,
    dosage: (first.dosage as string | null) ?? null,
    prescriberName: (first.prescriber_name as string | null) ?? null,
    prescriberFax: (first.prescriber_fax as string | null) ?? null,
    fileReference: (first.file_reference as string | null) ?? null,
    dispenseNotes: (first.dispense_notes as string | null) ?? null,
    internalNotes: (first.internal_notes as string | null) ?? null,
    status: first.status as PrescriptionStatus,
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
        previousStatus: (row.previous_status as PrescriptionStatus | null) ?? null,
        newStatus: row.new_status as PrescriptionStatus,
        changedById: (row.changed_by_id as string | null) ?? null,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

// ── updatePrescription ────────────────────────────────────────────────────

export async function updatePrescription(
  id: string,
  data: {
    status: PrescriptionStatus;
    dispenseNotes?: string;
    internalNotes?: string;
    updatedAt: Date;
  },
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(prescriptionRequests)
    .set({
      status: data.status,
      ...(data.dispenseNotes !== undefined && { dispenseNotes: data.dispenseNotes }),
      ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
      updatedAt: data.updatedAt,
    })
    .where(eq(prescriptionRequests.id, id));
}

import { eq, sql, and, ilike } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { minorAilmentCatalog, minorAilmentRequests, minorAilmentRequestHistory } from '@/db/schema/healthcare';
import type {
  MinorAilmentStatus,
  CatalogEntry,
  PatientAssessmentSummary,
  PatientAssessmentDetail,
  AdminAssessmentDetail,
} from './minor-ailment.types';

// ── Catalog queries ───────────────────────────────────────────────────────

export async function listActiveCatalog(
  facilityId: string,
  tx: TenantTransaction,
): Promise<CatalogEntry[]> {
  const rows = await tx
    .select()
    .from(minorAilmentCatalog)
    .where(
      and(
        eq(minorAilmentCatalog.facilityId, facilityId),
        eq(minorAilmentCatalog.isActive, true),
      ),
    )
    .orderBy(minorAilmentCatalog.displayOrder, minorAilmentCatalog.name);
  return rows;
}

export async function listAllCatalog(
  facilityId: string,
  tx: TenantTransaction,
): Promise<CatalogEntry[]> {
  const rows = await tx
    .select()
    .from(minorAilmentCatalog)
    .where(eq(minorAilmentCatalog.facilityId, facilityId))
    .orderBy(minorAilmentCatalog.displayOrder, minorAilmentCatalog.name);
  return rows;
}

export async function findCatalogEntryById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof minorAilmentCatalog.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(minorAilmentCatalog)
    .where(eq(minorAilmentCatalog.id, id))
    .limit(1);
  return row;
}

export async function checkCatalogNameExists(
  facilityId: string,
  name: string,
  excludeId: string | undefined,
  tx: TenantTransaction,
): Promise<boolean> {
  const conditions = [
    eq(minorAilmentCatalog.facilityId, facilityId),
    ilike(minorAilmentCatalog.name, name),
  ];
  if (excludeId) conditions.push(sql`${minorAilmentCatalog.id} != ${excludeId}`);

  const [row] = await tx
    .select({ id: minorAilmentCatalog.id })
    .from(minorAilmentCatalog)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

export async function insertCatalogEntry(
  data: typeof minorAilmentCatalog.$inferInsert,
  tx: TenantTransaction,
): Promise<typeof minorAilmentCatalog.$inferSelect> {
  const [row] = await tx.insert(minorAilmentCatalog).values(data).returning();
  return row;
}

export async function updateCatalogEntry(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    isActive: boolean;
    displayOrder: number;
    updatedAt: Date;
  }>,
  tx: TenantTransaction,
): Promise<typeof minorAilmentCatalog.$inferSelect> {
  const [row] = await tx
    .update(minorAilmentCatalog)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(minorAilmentCatalog.id, id))
    .returning();
  return row;
}

// ── Assessment queries ────────────────────────────────────────────────────

export async function insertMinorAilmentRequest(
  data: typeof minorAilmentRequests.$inferInsert,
  tx: TenantTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(minorAilmentRequests)
    .values(data)
    .returning({ id: minorAilmentRequests.id });
  return row;
}

export async function insertMinorAilmentHistory(
  data: typeof minorAilmentRequestHistory.$inferInsert,
  tx: TenantTransaction,
): Promise<void> {
  await tx.insert(minorAilmentRequestHistory).values(data);
}

export async function findMinorAilmentById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof minorAilmentRequests.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(minorAilmentRequests)
    .where(eq(minorAilmentRequests.id, id))
    .limit(1);
  return row;
}

export async function findMinorAilmentForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<typeof minorAilmentRequests.$inferSelect | null> {
  const [row] = await tx
    .select()
    .from(minorAilmentRequests)
    .where(
      and(
        eq(minorAilmentRequests.id, id),
        eq(minorAilmentRequests.facilityId, facilityId),
        eq(minorAilmentRequests.patientId, patientId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listMinorAilmentsForPatient(
  facilityId: string,
  patientId: string,
  opts: { status?: MinorAilmentStatus; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: PatientAssessmentSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions = [
    sql`r.facility_id = ${facilityId}`,
    sql`r.patient_id = ${patientId}`,
  ];
  if (opts.status) conditions.push(sql`r.status = ${opts.status}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM minor_ailment_requests r
    WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT r.id, r.ailment_id, c.name AS ailment_name, r.symptoms, r.duration, r.status, r.created_at, r.updated_at
    FROM minor_ailment_requests r
    JOIN minor_ailment_catalog c ON c.id = r.ailment_id
    WHERE ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      ailmentId: r.ailment_id as string,
      ailmentName: r.ailment_name as string,
      symptoms: r.symptoms as string,
      duration: r.duration as string,
      status: r.status as MinorAilmentStatus,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
    })),
    total,
  };
}

export async function findMinorAilmentDetailForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<PatientAssessmentDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      r.id, r.ailment_id, c.name AS ailment_name,
      r.symptoms, r.duration, r.current_medications, r.health_history,
      r.treatment_note, r.status, r.created_at, r.updated_at,
      h.id AS h_id, h.previous_status, h.new_status, h.changed_by_id,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM minor_ailment_requests r
    JOIN minor_ailment_catalog c ON c.id = r.ailment_id
    LEFT JOIN minor_ailment_request_history h ON h.request_id = r.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE r.id = ${id}
      AND r.facility_id = ${facilityId}
      AND r.patient_id = ${patientId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: PatientAssessmentDetail = {
    id: first.id as string,
    ailmentId: first.ailment_id as string,
    ailmentName: first.ailment_name as string,
    symptoms: first.symptoms as string,
    duration: first.duration as string,
    currentMedications: (first.current_medications as string | null) ?? null,
    healthHistory: (first.health_history as string | null) ?? null,
    treatmentNote: (first.treatment_note as string | null) ?? null,
    status: first.status as MinorAilmentStatus,
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
        previousStatus: (row.previous_status as MinorAilmentStatus | null) ?? null,
        newStatus: row.new_status as MinorAilmentStatus,
        changedById: (row.changed_by_id as string | null) ?? null,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

export async function listMinorAilmentsForAdmin(
  facilityId: string,
  opts: {
    status?: MinorAilmentStatus;
    ailmentId?: string;
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort: 'createdAt:asc' | 'createdAt:desc';
  },
  tx: TenantTransaction,
): Promise<{ rows: (PatientAssessmentSummary & { patientName: string })[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const orderDir = opts.sort === 'createdAt:asc' ? 'ASC' : 'DESC';

  const conditions = [sql`r.facility_id = ${facilityId}`];
  if (opts.status) conditions.push(sql`r.status = ${opts.status}`);
  if (opts.ailmentId) conditions.push(sql`r.ailment_id = ${opts.ailmentId}`);
  if (opts.patientId) conditions.push(sql`r.patient_id = ${opts.patientId}`);
  if (opts.dateFrom) conditions.push(sql`r.created_at >= ${opts.dateFrom}::date`);
  if (opts.dateTo) conditions.push(sql`r.created_at < (${opts.dateTo}::date + interval '1 day')`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM minor_ailment_requests r
    WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      r.id, r.ailment_id, c.name AS ailment_name, r.symptoms, r.duration, r.status, r.created_at, r.updated_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name
    FROM minor_ailment_requests r
    JOIN minor_ailment_catalog c ON c.id = r.ailment_id
    JOIN users p ON p.id = r.patient_id
    WHERE ${whereClause}
    ORDER BY r.created_at ${orderDir === 'ASC' ? sql`ASC` : sql`DESC`}
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      ailmentId: r.ailment_id as string,
      ailmentName: r.ailment_name as string,
      symptoms: r.symptoms as string,
      duration: r.duration as string,
      status: r.status as MinorAilmentStatus,
      createdAt: r.created_at as Date,
      updatedAt: r.updated_at as Date,
      patientName: r.patient_name as string,
    })),
    total,
  };
}

export async function findMinorAilmentDetailForAdmin(
  facilityId: string,
  id: string,
  tx: TenantTransaction,
): Promise<AdminAssessmentDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      r.id, r.ailment_id, c.name AS ailment_name,
      r.symptoms, r.duration, r.current_medications, r.health_history,
      r.treatment_note, r.internal_notes, r.status, r.patient_id, r.created_at, r.updated_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.email AS patient_email,
      h.id AS h_id, h.previous_status, h.new_status, h.changed_by_id,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM minor_ailment_requests r
    JOIN minor_ailment_catalog c ON c.id = r.ailment_id
    JOIN users p ON p.id = r.patient_id
    LEFT JOIN minor_ailment_request_history h ON h.request_id = r.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE r.id = ${id}
      AND r.facility_id = ${facilityId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: AdminAssessmentDetail = {
    id: first.id as string,
    ailmentId: first.ailment_id as string,
    ailmentName: first.ailment_name as string,
    symptoms: first.symptoms as string,
    duration: first.duration as string,
    currentMedications: (first.current_medications as string | null) ?? null,
    healthHistory: (first.health_history as string | null) ?? null,
    treatmentNote: (first.treatment_note as string | null) ?? null,
    internalNotes: (first.internal_notes as string | null) ?? null,
    status: first.status as MinorAilmentStatus,
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
        previousStatus: (row.previous_status as MinorAilmentStatus | null) ?? null,
        newStatus: row.new_status as MinorAilmentStatus,
        changedById: (row.changed_by_id as string | null) ?? null,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

export async function updateMinorAilmentRequest(
  id: string,
  data: {
    status: MinorAilmentStatus;
    treatmentNote?: string;
    internalNotes?: string;
    updatedAt: Date;
  },
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(minorAilmentRequests)
    .set({
      status: data.status,
      ...(data.treatmentNote !== undefined && { treatmentNote: data.treatmentNote }),
      ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
      updatedAt: data.updatedAt,
    })
    .where(eq(minorAilmentRequests.id, id));
}

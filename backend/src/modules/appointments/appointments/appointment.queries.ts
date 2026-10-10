import { eq, sql } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { appointments, appointmentStatusHistory } from '@/db/schema/appointments';
import type {
  AppointmentStatus,
  PatientAppointmentSummary,
  PatientAppointmentDetail,
  AdminAppointmentSummary,
  AdminAppointmentDetail,
} from './appointment.types';

export async function findAppointmentById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof appointments.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  return row;
}

// Patient isolation: returns null for any mismatch (no 403 leakage)
export async function findAppointmentForPatient(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<typeof appointments.$inferSelect | null> {
  const rows = await tx.execute(sql`
    SELECT * FROM appointments
    WHERE id = ${id}
      AND facility_id = ${facilityId}
      AND patient_id = ${patientId}
    LIMIT 1
  `);
  return (rows as unknown as typeof appointments.$inferSelect[])[0] ?? null;
}

export async function insertAppointment(
  data: typeof appointments.$inferInsert,
  tx: TenantTransaction,
): Promise<typeof appointments.$inferSelect> {
  const [row] = await tx.insert(appointments).values(data).returning();
  return row;
}

export async function insertAppointmentStatusHistory(
  data: typeof appointmentStatusHistory.$inferInsert,
  tx: TenantTransaction,
): Promise<void> {
  await tx.insert(appointmentStatusHistory).values(data);
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(appointments)
    .set({ status, updatedAt: new Date() })
    .where(eq(appointments.id, id));
}

export async function updateAppointmentInternalNotes(
  id: string,
  internalNotes: string,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(appointments)
    .set({ internalNotes, updatedAt: new Date() })
    .where(eq(appointments.id, id));
}

export async function listPatientAppointments(
  facilityId: string,
  patientId: string,
  opts: { status?: AppointmentStatus; page: number; limit: number },
  tx: TenantTransaction,
): Promise<{ rows: PatientAppointmentSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions = [
    sql`a.facility_id = ${facilityId}`,
    sql`a.patient_id = ${patientId}`,
  ];
  if (opts.status) conditions.push(sql`a.status = ${opts.status}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM appointments a
    WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      a.id, v.name AS service_name,
      s.slot_date, s.start_time, s.end_time,
      a.status, a.reason, a.created_at
    FROM appointments a
    JOIN availability_slots s ON s.id = a.slot_id
    JOIN vaccine_services v ON v.id = a.service_id
    WHERE ${whereClause}
    ORDER BY s.slot_date ASC, s.start_time ASC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      serviceName: r.service_name as string,
      slotDate: r.slot_date as string,
      startTime: r.start_time as string,
      endTime: r.end_time as string,
      status: r.status as AppointmentStatus,
      reason: (r.reason as string | null) ?? null,
      createdAt: r.created_at as Date,
    })),
    total,
  };
}

export async function findPatientAppointmentDetail(
  facilityId: string,
  id: string,
  patientId: string,
  tx: TenantTransaction,
): Promise<PatientAppointmentDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      a.id, v.name AS service_name, v.duration_minutes, v.eligibility_notes,
      s.slot_date, s.start_time, s.end_time,
      a.status, a.reason, a.created_at,
      h.previous_status, h.new_status,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM appointments a
    JOIN availability_slots s ON s.id = a.slot_id
    JOIN vaccine_services v ON v.id = a.service_id
    LEFT JOIN appointment_status_history h ON h.appointment_id = a.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE a.id = ${id}
      AND a.facility_id = ${facilityId}
      AND a.patient_id = ${patientId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: PatientAppointmentDetail = {
    id: first.id as string,
    serviceName: first.service_name as string,
    durationMinutes: first.duration_minutes as number,
    eligibilityNotes: (first.eligibility_notes as string | null) ?? null,
    slotDate: first.slot_date as string,
    startTime: first.start_time as string,
    endTime: first.end_time as string,
    status: first.status as AppointmentStatus,
    reason: (first.reason as string | null) ?? null,
    createdAt: first.created_at as Date,
    statusHistory: [],
  };

  for (const row of rows as unknown as Record<string, unknown>[]) {
    if (row.h_created_at) {
      detail.statusHistory.push({
        previousStatus: (row.previous_status as AppointmentStatus | null) ?? null,
        newStatus: row.new_status as AppointmentStatus,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

export async function listAdminAppointments(
  facilityId: string,
  opts: {
    serviceId?: string;
    slotId?: string;
    patientId?: string;
    status?: AppointmentStatus;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
    sort: 'slotDate:asc' | 'slotDate:desc' | 'createdAt:desc';
  },
  tx: TenantTransaction,
): Promise<{ rows: AdminAppointmentSummary[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const orderClause =
    opts.sort === 'createdAt:desc'
      ? sql`a.created_at DESC`
      : opts.sort === 'slotDate:desc'
      ? sql`s.slot_date DESC, s.start_time DESC`
      : sql`s.slot_date ASC, s.start_time ASC`;

  const conditions = [sql`a.facility_id = ${facilityId}`];
  if (opts.serviceId) conditions.push(sql`a.service_id = ${opts.serviceId}`);
  if (opts.slotId) conditions.push(sql`a.slot_id = ${opts.slotId}`);
  if (opts.patientId) conditions.push(sql`a.patient_id = ${opts.patientId}`);
  if (opts.status) conditions.push(sql`a.status = ${opts.status}`);
  if (opts.dateFrom) conditions.push(sql`s.slot_date >= ${opts.dateFrom}`);
  if (opts.dateTo) conditions.push(sql`s.slot_date <= ${opts.dateTo}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM appointments a
    JOIN availability_slots s ON s.id = a.slot_id
    WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      a.id,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.email AS patient_email,
      v.name AS service_name,
      s.slot_date, s.start_time,
      a.status, a.created_at
    FROM appointments a
    JOIN availability_slots s ON s.id = a.slot_id
    JOIN vaccine_services v ON v.id = a.service_id
    JOIN users p ON p.id = a.patient_id
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      patientName: r.patient_name as string,
      patientEmail: r.patient_email as string,
      serviceName: r.service_name as string,
      slotDate: r.slot_date as string,
      startTime: r.start_time as string,
      status: r.status as AppointmentStatus,
      createdAt: r.created_at as Date,
    })),
    total,
  };
}

export async function findAdminAppointmentDetail(
  facilityId: string,
  id: string,
  tx: TenantTransaction,
): Promise<AdminAppointmentDetail | null> {
  const rows = await tx.execute(sql`
    SELECT
      a.id, a.patient_id, a.internal_notes, a.status, a.reason, a.created_at,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.email AS patient_email,
      v.name AS service_name, v.duration_minutes,
      s.slot_date, s.start_time, s.end_time,
      h.previous_status, h.new_status,
      CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
      h.note AS h_note, h.created_at AS h_created_at
    FROM appointments a
    JOIN availability_slots s ON s.id = a.slot_id
    JOIN vaccine_services v ON v.id = a.service_id
    JOIN users p ON p.id = a.patient_id
    LEFT JOIN appointment_status_history h ON h.appointment_id = a.id
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE a.id = ${id}
      AND a.facility_id = ${facilityId}
    ORDER BY h.created_at ASC
  `);

  if (!rows.length) return null;

  const first = (rows as unknown as Record<string, unknown>[])[0];
  const detail: AdminAppointmentDetail = {
    id: first.id as string,
    patientId: first.patient_id as string,
    patientName: first.patient_name as string,
    patientEmail: first.patient_email as string,
    serviceName: first.service_name as string,
    durationMinutes: first.duration_minutes as number,
    slotDate: first.slot_date as string,
    startTime: first.start_time as string,
    endTime: first.end_time as string,
    reason: (first.reason as string | null) ?? null,
    internalNotes: (first.internal_notes as string | null) ?? null,
    status: first.status as AppointmentStatus,
    createdAt: first.created_at as Date,
    statusHistory: [],
  };

  for (const row of rows as unknown as Record<string, unknown>[]) {
    if (row.h_created_at) {
      detail.statusHistory.push({
        previousStatus: (row.previous_status as AppointmentStatus | null) ?? null,
        newStatus: row.new_status as AppointmentStatus,
        changedByName: (row.changed_by_name as string | null) ?? null,
        note: (row.h_note as string | null) ?? null,
        createdAt: row.h_created_at as Date,
      });
    }
  }

  return detail;
}

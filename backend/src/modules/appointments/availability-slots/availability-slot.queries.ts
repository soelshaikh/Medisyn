import { eq, sql } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { availabilitySlots } from '@/db/schema/appointments';
import type { AdminAvailabilitySlot, PatientAvailableSlot } from './availability-slot.types';

export async function findSlotById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof availabilitySlots.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, id))
    .limit(1);
  return row;
}

// SELECT FOR UPDATE — serializes concurrent bookings on this slot row.
// Must be called inside withTenantContext (transaction already open).
export async function findSlotByIdForUpdate(
  id: string,
  tx: TenantTransaction,
): Promise<typeof availabilitySlots.$inferSelect | undefined> {
  const rows = await tx.execute(
    sql`SELECT * FROM availability_slots WHERE id = ${id} FOR UPDATE LIMIT 1`,
  );
  return (rows as unknown as typeof availabilitySlots.$inferSelect[])[0];
}

export async function insertAvailabilitySlot(
  data: typeof availabilitySlots.$inferInsert,
  tx: TenantTransaction,
): Promise<typeof availabilitySlots.$inferSelect> {
  const [row] = await tx.insert(availabilitySlots).values(data).returning();
  return row;
}

export async function updateAvailabilitySlot(
  id: string,
  data: Partial<{
    capacity: number;
    openCapacity: number | null;
    bookedCount: number;
    isActive: boolean;
    updatedAt: Date;
  }>,
  tx: TenantTransaction,
): Promise<typeof availabilitySlots.$inferSelect> {
  const [row] = await tx
    .update(availabilitySlots)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(availabilitySlots.id, id))
    .returning();
  return row;
}

export async function listAdminSlots(
  facilityId: string,
  opts: {
    serviceId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  },
  tx: TenantTransaction,
): Promise<{ rows: AdminAvailabilitySlot[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;

  const conditions = [sql`s.facility_id = ${facilityId}`];
  if (opts.serviceId) conditions.push(sql`s.service_id = ${opts.serviceId}`);
  if (opts.date) conditions.push(sql`s.slot_date = ${opts.date}`);
  if (opts.dateFrom) conditions.push(sql`s.slot_date >= ${opts.dateFrom}`);
  if (opts.dateTo) conditions.push(sql`s.slot_date <= ${opts.dateTo}`);
  if (opts.isActive !== undefined) conditions.push(sql`s.is_active = ${opts.isActive}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const countResult = await tx.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM availability_slots s
    WHERE ${whereClause}
  `);
  const total = (countResult as unknown as { count: number }[])[0]?.count ?? 0;

  const rows = await tx.execute(sql`
    SELECT
      s.id, s.service_id, v.name AS service_name,
      s.slot_date, s.start_time, s.end_time,
      s.capacity, s.booking_type, s.open_capacity, s.booked_count,
      GREATEST(0, s.capacity - s.booked_count) AS remaining,
      s.is_active, s.created_at
    FROM availability_slots s
    JOIN vaccine_services v ON v.id = s.service_id
    WHERE ${whereClause}
    ORDER BY s.slot_date ASC, s.start_time ASC
    LIMIT ${opts.limit} OFFSET ${offset}
  `);

  return {
    rows: (rows as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      serviceId: r.service_id as string,
      serviceName: r.service_name as string,
      slotDate: r.slot_date as string,
      startTime: r.start_time as string,
      endTime: r.end_time as string,
      capacity: r.capacity as number,
      bookingType: r.booking_type as 'STRICT' | 'OPEN',
      openCapacity: (r.open_capacity as number | null) ?? null,
      bookedCount: r.booked_count as number,
      remaining: r.remaining as number,
      isActive: r.is_active as boolean,
      createdAt: r.created_at as Date,
    })),
    total,
  };
}

// Patient availability: only active future slots where booked_count < capacity.
// OPEN buffer invisible to patients — they see "full" at capacity threshold.
export async function listPatientAvailableSlots(
  facilityId: string,
  opts: { serviceId?: string; date?: string },
  tx: TenantTransaction,
): Promise<PatientAvailableSlot[]> {
  const today = new Date().toISOString().slice(0, 10);

  const conditions = [
    sql`s.facility_id = ${facilityId}`,
    sql`s.is_active = true`,
    sql`s.slot_date >= ${today}`,
    sql`s.booked_count < s.capacity`,
  ];
  if (opts.serviceId) conditions.push(sql`s.service_id = ${opts.serviceId}`);
  if (opts.date) conditions.push(sql`s.slot_date = ${opts.date}`);
  const whereClause = sql.join(conditions, sql` AND `);

  const rows = await tx.execute(sql`
    SELECT
      s.id, s.service_id, v.name AS service_name,
      s.slot_date, s.start_time, s.end_time,
      s.capacity,
      GREATEST(0, s.capacity - s.booked_count) AS remaining
    FROM availability_slots s
    JOIN vaccine_services v ON v.id = s.service_id
    WHERE ${whereClause}
    ORDER BY s.slot_date ASC, s.start_time ASC
  `);

  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    serviceId: r.service_id as string,
    serviceName: r.service_name as string,
    slotDate: r.slot_date as string,
    startTime: r.start_time as string,
    endTime: r.end_time as string,
    capacity: r.capacity as number,
    remaining: r.remaining as number,
  }));
}

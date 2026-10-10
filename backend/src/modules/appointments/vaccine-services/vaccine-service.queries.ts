import { eq, and, sql } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { vaccineServices } from '@/db/schema/appointments';
import type { PublicVaccineService, AdminVaccineService } from './vaccine-service.types';

export async function listActiveVaccineServices(
  facilityId: string,
  tx: TenantTransaction,
): Promise<PublicVaccineService[]> {
  const rows = await tx
    .select({
      id: vaccineServices.id,
      name: vaccineServices.name,
      description: vaccineServices.description,
      durationMinutes: vaccineServices.durationMinutes,
      eligibilityNotes: vaccineServices.eligibilityNotes,
      doseNumber: vaccineServices.doseNumber,
    })
    .from(vaccineServices)
    .where(and(eq(vaccineServices.facilityId, facilityId), eq(vaccineServices.isActive, true)))
    .orderBy(vaccineServices.name);
  return rows;
}

export async function listAllVaccineServices(
  facilityId: string,
  tx: TenantTransaction,
): Promise<AdminVaccineService[]> {
  const rows = await tx
    .select()
    .from(vaccineServices)
    .where(eq(vaccineServices.facilityId, facilityId))
    .orderBy(vaccineServices.name);
  return rows;
}

export async function findVaccineServiceById(
  id: string,
  tx: TenantTransaction,
): Promise<typeof vaccineServices.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(vaccineServices)
    .where(eq(vaccineServices.id, id))
    .limit(1);
  return row;
}

export async function checkVaccineServiceNameExists(
  facilityId: string,
  name: string,
  excludeId: string | undefined,
  tx: TenantTransaction,
): Promise<boolean> {
  const conditions = [
    eq(vaccineServices.facilityId, facilityId),
    sql`LOWER(${vaccineServices.name}) = LOWER(${name})`,
  ];
  if (excludeId) conditions.push(sql`${vaccineServices.id} != ${excludeId}`);

  const [row] = await tx
    .select({ id: vaccineServices.id })
    .from(vaccineServices)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

export async function insertVaccineService(
  data: typeof vaccineServices.$inferInsert,
  tx: TenantTransaction,
): Promise<typeof vaccineServices.$inferSelect> {
  const [row] = await tx.insert(vaccineServices).values(data).returning();
  return row;
}

export async function updateVaccineService(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    durationMinutes: number;
    eligibilityNotes: string | null;
    doseNumber: string | null;
    isActive: boolean;
    updatedAt: Date;
  }>,
  tx: TenantTransaction,
): Promise<typeof vaccineServices.$inferSelect> {
  const [row] = await tx
    .update(vaccineServices)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(vaccineServices.id, id))
    .returning();
  return row;
}

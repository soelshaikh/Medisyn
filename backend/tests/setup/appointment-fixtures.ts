import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getSuperAdminTestDb } from './db';
import * as appointmentsSchema from '@/db/schema/appointments';

// ── Vaccine service fixture ───────────────────────────────────────────────

export async function createTestVaccineService(
  facilityId: string,
  overrides: Partial<typeof appointmentsSchema.vaccineServices.$inferInsert> = {},
): Promise<typeof appointmentsSchema.vaccineServices.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(appointmentsSchema.vaccineServices)
    .values({
      facilityId,
      name: overrides.name ?? `Service-${uuidv4().slice(0, 8)}`,
      description: overrides.description ?? null,
      durationMinutes: overrides.durationMinutes ?? 15,
      eligibilityNotes: overrides.eligibilityNotes ?? null,
      doseNumber: overrides.doseNumber ?? null,
      isActive: overrides.isActive ?? true,
    })
    .returning();
  return row;
}

// ── Availability slot fixture ─────────────────────────────────────────────

export async function createTestAvailabilitySlot(
  facilityId: string,
  serviceId: string,
  overrides: Partial<typeof appointmentsSchema.availabilitySlots.$inferInsert> = {},
): Promise<typeof appointmentsSchema.availabilitySlots.$inferSelect> {
  const sa = getSuperAdminTestDb();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const [row] = await sa
    .insert(appointmentsSchema.availabilitySlots)
    .values({
      facilityId,
      serviceId,
      slotDate: overrides.slotDate ?? defaultDate,
      startTime: overrides.startTime ?? '10:00',
      endTime: overrides.endTime ?? '10:15',
      capacity: overrides.capacity ?? 5,
      bookingType: overrides.bookingType ?? 'STRICT',
      openCapacity: overrides.openCapacity ?? null,
      bookedCount: overrides.bookedCount ?? 0,
      isActive: overrides.isActive ?? true,
    })
    .returning();
  return row;
}

// ── Appointment fixture ───────────────────────────────────────────────────

export async function createTestAppointment(
  facilityId: string,
  patientId: string,
  slotId: string,
  serviceId: string,
  overrides: Partial<typeof appointmentsSchema.appointments.$inferInsert> = {},
): Promise<typeof appointmentsSchema.appointments.$inferSelect> {
  const sa = getSuperAdminTestDb();

  const [appointment] = await sa
    .insert(appointmentsSchema.appointments)
    .values({
      facilityId,
      patientId,
      slotId,
      serviceId,
      reason: overrides.reason ?? null,
      internalNotes: overrides.internalNotes ?? null,
      status: overrides.status ?? 'scheduled',
    })
    .returning();

  // Insert initial status history entry
  await sa.insert(appointmentsSchema.appointmentStatusHistory).values({
    appointmentId: appointment.id,
    facilityId,
    previousStatus: null,
    newStatus: appointment.status,
    changedById: null,
    note: null,
  });

  // Increment booked_count on slot when status is not cancelled
  if (appointment.status !== 'cancelled') {
    await sa
      .update(appointmentsSchema.availabilitySlots)
      .set({
        bookedCount: (
          await sa
            .select({ bookedCount: appointmentsSchema.availabilitySlots.bookedCount })
            .from(appointmentsSchema.availabilitySlots)
            .where(eq(appointmentsSchema.availabilitySlots.id, slotId))
            .limit(1)
        )[0].bookedCount + 1,
      })
      .where(eq(appointmentsSchema.availabilitySlots.id, slotId));
  }

  return appointment;
}

// ── Cleanup helpers ───────────────────────────────────────────────────────

export async function deleteTestAppointmentsByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  // History cascade-deletes via FK; appointments have DELETE revoked for app_user but
  // super admin can delete for test cleanup.
  await sa
    .delete(appointmentsSchema.appointmentStatusHistory)
    .where(eq(appointmentsSchema.appointmentStatusHistory.facilityId, facilityId));
  await sa
    .delete(appointmentsSchema.appointments)
    .where(eq(appointmentsSchema.appointments.facilityId, facilityId));
}

export async function deleteTestAvailabilitySlotsByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa
    .delete(appointmentsSchema.availabilitySlots)
    .where(eq(appointmentsSchema.availabilitySlots.facilityId, facilityId));
}

export async function deleteTestVaccineServicesByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  await sa
    .delete(appointmentsSchema.vaccineServices)
    .where(eq(appointmentsSchema.vaccineServices.facilityId, facilityId));
}

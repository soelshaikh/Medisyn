import { sql } from 'drizzle-orm';
import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import { findSlotByIdForUpdate, updateAvailabilitySlot } from '../availability-slots/availability-slot.queries';
import {
  findAppointmentById,
  findAppointmentForPatient,
  insertAppointment,
  insertAppointmentStatusHistory,
  updateAppointmentStatus,
  updateAppointmentInternalNotes,
  listPatientAppointments,
  findPatientAppointmentDetail,
  listAdminAppointments,
  findAdminAppointmentDetail,
} from './appointment.queries';
import { validateAppointmentTransition } from './appointment.types';
import type {
  AppointmentStatus,
  PatientAppointmentDetail,
  PatientAppointmentSummary,
  AdminAppointmentDetail,
  AdminAppointmentSummary,
} from './appointment.types';
import type {
  BookAppointmentBody,
  CancelAppointmentBody,
  ListPatientAppointmentsQuery,
  AdminListAppointmentsQuery,
  AdminUpdateStatusBody,
  AdminUpdateNotesBody,
} from './appointment.validator';

// ── bookAppointment ───────────────────────────────────────────────────────
// Concurrency-safe: SELECT FOR UPDATE on availability_slots row before insert.

export async function bookAppointment(
  auth: AuthContext,
  input: BookAppointmentBody,
): Promise<PatientAppointmentDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    // Lock the slot row for the duration of this transaction
    const slot = await findSlotByIdForUpdate(input.slotId, tx);
    if (!slot) {
      throw new AppError('SLOT_NOT_FOUND', 'Availability slot not found', 404);
    }
    if (!slot.isActive) {
      throw new AppError('SLOT_INACTIVE', 'This slot is no longer available for booking', 422);
    }

    // Capacity check: STRICT and OPEN both fail at capacity threshold for patients
    if (slot.bookedCount >= slot.capacity) {
      throw new AppError('SLOT_FULL', 'This slot is fully booked', 409);
    }

    // Duplicate booking check (partial unique index handles this at DB level too,
    // but we throw a typed error for clarity)
    const existingRows = await tx.execute(sql`
      SELECT id FROM appointments
      WHERE slot_id = ${input.slotId}
        AND patient_id = ${auth.userId}
        AND status != 'cancelled'
      LIMIT 1
    `);
    if ((existingRows as unknown[]).length > 0) {
      throw new AppError(
        'APPOINTMENT_DUPLICATE_BOOKING',
        'You already have an active booking for this slot',
        409,
      );
    }

    const appointment = await insertAppointment(
      {
        facilityId,
        patientId: auth.userId,
        slotId: input.slotId,
        serviceId: slot.serviceId,
        reason: input.reason ?? null,
        internalNotes: null,
        status: 'scheduled',
      },
      tx,
    );

    await insertAppointmentStatusHistory(
      {
        appointmentId: appointment.id,
        facilityId,
        previousStatus: null,
        newStatus: 'scheduled',
        changedById: null,
        note: null,
      },
      tx,
    );

    // Increment booked_count on the locked slot
    await updateAvailabilitySlot(
      input.slotId,
      { bookedCount: slot.bookedCount + 1 },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'appointment.booked',
        resourceType: 'appointment',
        resourceId: appointment.id,
        metadata: { slotId: input.slotId, serviceId: slot.serviceId },
      },
      tx,
    );

    const detail = await findPatientAppointmentDetail(facilityId, appointment.id, auth.userId, tx);
    return detail!;
  });
}

// ── listMyAppointments ────────────────────────────────────────────────────

export async function listMyAppointments(
  auth: AuthContext,
  opts: ListPatientAppointmentsQuery,
): Promise<{ rows: PatientAppointmentSummary[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const result = await listPatientAppointments(
      facilityId,
      auth.userId,
      { status: opts.status as AppointmentStatus | undefined, page: opts.page, limit: opts.limit },
      tx,
    );
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getMyAppointmentDetail ────────────────────────────────────────────────

export async function getMyAppointmentDetail(
  auth: AuthContext,
  id: string,
): Promise<PatientAppointmentDetail> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const detail = await findPatientAppointmentDetail(facilityId, id, auth.userId, tx);
    if (!detail) {
      throw new AppError('APPOINTMENT_NOT_FOUND', 'Appointment not found', 404);
    }
    return detail;
  });
}

// ── cancelMyAppointment ───────────────────────────────────────────────────
// Patient cancels their own scheduled appointment. Decrements booked_count.

export async function cancelMyAppointment(
  auth: AuthContext,
  id: string,
  input: CancelAppointmentBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findAppointmentForPatient(facilityId, id, auth.userId, tx);
    if (!existing) {
      throw new AppError('APPOINTMENT_NOT_FOUND', 'Appointment not found', 404);
    }

    validateAppointmentTransition(existing.status as AppointmentStatus, 'cancelled');

    // Lock the slot row before decrementing
    const slot = await findSlotByIdForUpdate(existing.slotId, tx);

    await updateAppointmentStatus(id, 'cancelled', tx);

    await insertAppointmentStatusHistory(
      {
        appointmentId: id,
        facilityId,
        previousStatus: existing.status,
        newStatus: 'cancelled',
        changedById: auth.userId,
        note: input.note ?? null,
      },
      tx,
    );

    // Decrement booked_count
    if (slot && slot.bookedCount > 0) {
      await updateAvailabilitySlot(
        existing.slotId,
        { bookedCount: slot.bookedCount - 1 },
        tx,
      );
    }

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'appointment.cancelled',
        resourceType: 'appointment',
        resourceId: id,
      },
      tx,
    );
  });
}

// ── Admin: listAdminAppointmentList ───────────────────────────────────────

export async function listAdminAppointmentList(
  auth: AuthContext,
  opts: AdminListAppointmentsQuery,
): Promise<{ rows: AdminAppointmentSummary[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const result = await listAdminAppointments(facilityId, opts, tx);
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── Admin: getAdminAppointmentDetail ─────────────────────────────────────

export async function getAdminAppointmentDetail(
  auth: AuthContext,
  id: string,
): Promise<AdminAppointmentDetail> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const detail = await findAdminAppointmentDetail(facilityId, id, tx);
    if (!detail) {
      throw new AppError('APPOINTMENT_NOT_FOUND', 'Appointment not found', 404);
    }
    return detail;
  });
}

// ── Admin: changeAppointmentStatus ────────────────────────────────────────
// completed/no_show do NOT decrement booked_count. Only cancelled does.

export async function changeAppointmentStatus(
  auth: AuthContext,
  id: string,
  input: AdminUpdateStatusBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findAppointmentById(id, tx);
    if (!existing) {
      throw new AppError('APPOINTMENT_NOT_FOUND', 'Appointment not found', 404);
    }

    validateAppointmentTransition(
      existing.status as AppointmentStatus,
      input.newStatus as AppointmentStatus,
    );

    if (input.newStatus === 'cancelled') {
      // Lock slot before decrementing
      const slot = await findSlotByIdForUpdate(existing.slotId, tx);
      if (slot && slot.bookedCount > 0) {
        await updateAvailabilitySlot(
          existing.slotId,
          { bookedCount: slot.bookedCount - 1 },
          tx,
        );
      }
    }

    await updateAppointmentStatus(id, input.newStatus as AppointmentStatus, tx);

    await insertAppointmentStatusHistory(
      {
        appointmentId: id,
        facilityId,
        previousStatus: existing.status,
        newStatus: input.newStatus,
        changedById: auth.userId,
        note: input.note ?? null,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'appointment.status_changed',
        resourceType: 'appointment',
        resourceId: id,
        metadata: { from: existing.status, to: input.newStatus },
      },
      tx,
    );
  });
}

// ── Admin: updateAppointmentNotes ─────────────────────────────────────────

export async function updateAppointmentNotes(
  auth: AuthContext,
  id: string,
  input: AdminUpdateNotesBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findAppointmentById(id, tx);
    if (!existing) {
      throw new AppError('APPOINTMENT_NOT_FOUND', 'Appointment not found', 404);
    }

    await updateAppointmentInternalNotes(id, input.notes, tx);
  });
}

import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import { findVaccineServiceById } from '../vaccine-services/vaccine-service.queries';
import {
  findSlotById,
  insertAvailabilitySlot,
  updateAvailabilitySlot,
  listAdminSlots,
  listPatientAvailableSlots,
} from './availability-slot.queries';
import type { AdminAvailabilitySlot, PatientAvailableSlot } from './availability-slot.types';
import type {
  CreateAvailabilitySlotBody,
  UpdateAvailabilitySlotBody,
  AdminListSlotsQuery,
  PatientAvailabilityQuery,
} from './availability-slot.validator';

export async function browseAvailableSlots(
  facilityId: string,
  query: PatientAvailabilityQuery,
): Promise<PatientAvailableSlot[]> {
  return withTenantContext(facilityId, async (tx) => {
    return listPatientAvailableSlots(facilityId, query, tx);
  });
}

export async function listAdminAvailabilitySlots(
  auth: AuthContext,
  query: AdminListSlotsQuery,
): Promise<{ rows: AdminAvailabilitySlot[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    const result = await listAdminSlots(
      facilityId,
      {
        serviceId: query.serviceId,
        date: query.date,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
        page: query.page,
        limit: query.limit,
      },
      tx,
    );
    return {
      rows: result.rows,
      pagination: { page: query.page, limit: query.limit, total: result.total },
    };
  });
}

export async function createAvailabilitySlot(
  auth: AuthContext,
  input: CreateAvailabilitySlotBody,
): Promise<AdminAvailabilitySlot> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const service = await findVaccineServiceById(input.serviceId, tx);
    if (!service) {
      throw new AppError('VACCINE_SERVICE_NOT_FOUND', 'Vaccine service not found', 404);
    }
    if (!service.isActive) {
      throw new AppError('VACCINE_SERVICE_INACTIVE', 'Vaccine service is not active', 422);
    }

    const row = await insertAvailabilitySlot(
      {
        facilityId,
        serviceId: input.serviceId,
        slotDate: input.slotDate,
        startTime: input.startTime,
        endTime: input.endTime,
        capacity: input.capacity,
        bookingType: input.bookingType,
        openCapacity: input.openCapacity ?? null,
        bookedCount: 0,
        isActive: true,
      },
      tx,
    );

    return {
      id: row.id,
      serviceId: row.serviceId,
      serviceName: service.name,
      slotDate: row.slotDate,
      startTime: row.startTime,
      endTime: row.endTime,
      capacity: row.capacity,
      bookingType: row.bookingType as 'STRICT' | 'OPEN',
      openCapacity: row.openCapacity,
      bookedCount: row.bookedCount,
      remaining: row.capacity,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  });
}

export async function updateAvailabilitySlotDetails(
  auth: AuthContext,
  id: string,
  input: UpdateAvailabilitySlotBody,
): Promise<AdminAvailabilitySlot> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const existing = await findSlotById(id, tx);
    if (!existing) {
      throw new AppError('SLOT_NOT_FOUND', 'Availability slot not found', 404);
    }

    const newCapacity = input.capacity ?? existing.capacity;
    if (newCapacity < existing.bookedCount) {
      throw new AppError(
        'SLOT_CAPACITY_BELOW_BOOKED',
        `Cannot set capacity to ${newCapacity} — slot has ${existing.bookedCount} existing booking(s)`,
        422,
      );
    }

    const row = await updateAvailabilitySlot(
      id,
      {
        capacity: input.capacity,
        openCapacity: input.openCapacity,
        isActive: input.isActive,
      },
      tx,
    );

    // Fetch service name for response
    const service = await findVaccineServiceById(row.serviceId, tx);

    return {
      id: row.id,
      serviceId: row.serviceId,
      serviceName: service?.name ?? '',
      slotDate: row.slotDate,
      startTime: row.startTime,
      endTime: row.endTime,
      capacity: row.capacity,
      bookingType: row.bookingType as 'STRICT' | 'OPEN',
      openCapacity: row.openCapacity,
      bookedCount: row.bookedCount,
      remaining: Math.max(0, row.capacity - row.bookedCount),
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  });
}

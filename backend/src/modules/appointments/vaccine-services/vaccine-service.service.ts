import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import {
  listActiveVaccineServices,
  listAllVaccineServices,
  findVaccineServiceById,
  checkVaccineServiceNameExists,
  insertVaccineService,
  updateVaccineService,
} from './vaccine-service.queries';
import type { PublicVaccineService, AdminVaccineService } from './vaccine-service.types';
import type { CreateVaccineServiceBody, UpdateVaccineServiceBody } from './vaccine-service.validator';

export async function listPublicVaccineServices(facilityId: string): Promise<PublicVaccineService[]> {
  return withTenantContext(facilityId, async (tx) => {
    return listActiveVaccineServices(facilityId, tx);
  });
}

export async function listAdminVaccineServices(auth: AuthContext): Promise<AdminVaccineService[]> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    return listAllVaccineServices(facilityId, tx);
  });
}

export async function createVaccineService(
  auth: AuthContext,
  input: CreateVaccineServiceBody,
): Promise<AdminVaccineService> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const exists = await checkVaccineServiceNameExists(facilityId, input.name, undefined, tx);
    if (exists) {
      throw new AppError(
        'VACCINE_SERVICE_NAME_EXISTS',
        `A vaccine service named "${input.name}" already exists`,
        422,
      );
    }

    const row = await insertVaccineService(
      {
        facilityId,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        eligibilityNotes: input.eligibilityNotes ?? null,
        doseNumber: input.doseNumber ?? null,
        isActive: true,
      },
      tx,
    );

    return row;
  });
}

export async function updateVaccineServiceDetails(
  auth: AuthContext,
  id: string,
  input: UpdateVaccineServiceBody,
): Promise<AdminVaccineService> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const existing = await findVaccineServiceById(id, tx);
    if (!existing) {
      throw new AppError('VACCINE_SERVICE_NOT_FOUND', 'Vaccine service not found', 404);
    }

    if (input.name !== undefined) {
      const exists = await checkVaccineServiceNameExists(facilityId, input.name, id, tx);
      if (exists) {
        throw new AppError(
          'VACCINE_SERVICE_NAME_EXISTS',
          `A vaccine service named "${input.name}" already exists`,
          422,
        );
      }
    }

    const row = await updateVaccineService(id, input, tx);
    return row;
  });
}

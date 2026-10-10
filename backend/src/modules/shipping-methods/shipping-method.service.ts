import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import {
  listActiveMethods,
  listAllMethods,
  findMethodById,
  checkNameExists,
  insertMethod,
  updateMethod,
  setMethodInactive,
} from './shipping-method.queries';
import type {
  ShippingMethod,
  CreateShippingMethodInput,
  UpdateShippingMethodInput,
} from './shipping-method.types';

// ── listActive ────────────────────────────────────────────────────────────

export async function listActive(facilityId: string): Promise<ShippingMethod[]> {
  return withTenantContext(facilityId, async (tx) => {
    return listActiveMethods(facilityId, tx);
  });
}

// ── listAll ───────────────────────────────────────────────────────────────

export async function listAll(facilityId: string): Promise<ShippingMethod[]> {
  return withTenantContext(facilityId, async (tx) => {
    return listAllMethods(facilityId, tx);
  });
}

// ── getById ───────────────────────────────────────────────────────────────

export async function getById(
  facilityId: string,
  id: string,
): Promise<ShippingMethod> {
  return withTenantContext(facilityId, async (tx) => {
    const method = await findMethodById(id, tx);
    if (!method) {
      throw new AppError('SHIPPING_METHOD_NOT_FOUND', 'Shipping method not found', 404);
    }
    return method;
  });
}

// ── create ────────────────────────────────────────────────────────────────

export async function create(
  facilityId: string,
  input: CreateShippingMethodInput,
  actorId: string,
): Promise<ShippingMethod> {
  return withTenantContext(facilityId, async (tx) => {
    if (input.estimatedDaysMax < input.estimatedDaysMin) {
      throw new AppError(
        'VALIDATION_ERROR',
        'estimatedDaysMax must be >= estimatedDaysMin',
        422,
      );
    }

    const nameExists = await checkNameExists(facilityId, input.name, undefined, tx);
    if (nameExists) {
      throw new AppError('SHIPPING_METHOD_NAME_EXISTS', 'A shipping method with this name already exists', 409);
    }

    const method = await insertMethod(
      {
        facilityId,
        name: input.name,
        description: input.description,
        flatRate: input.flatRate.toFixed(2),
        estimatedDaysMin: input.estimatedDaysMin,
        estimatedDaysMax: input.estimatedDaysMax,
        displayOrder: input.displayOrder ?? 0,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'shipping_method.created',
        resourceType: 'shipping_method',
        resourceId: method.id,
      },
      tx,
    );

    return method;
  });
}

// ── update ────────────────────────────────────────────────────────────────

export async function update(
  facilityId: string,
  id: string,
  input: UpdateShippingMethodInput,
  actorId: string,
): Promise<ShippingMethod> {
  return withTenantContext(facilityId, async (tx) => {
    const existing = await findMethodById(id, tx);
    if (!existing) {
      throw new AppError('SHIPPING_METHOD_NOT_FOUND', 'Shipping method not found', 404);
    }

    if (input.name && input.name !== existing.name) {
      const nameExists = await checkNameExists(facilityId, input.name, id, tx);
      if (nameExists) {
        throw new AppError('SHIPPING_METHOD_NAME_EXISTS', 'A shipping method with this name already exists', 409);
      }
    }

    const daysMin = input.estimatedDaysMin ?? existing.estimatedDaysMin;
    const daysMax = input.estimatedDaysMax ?? existing.estimatedDaysMax;
    if (daysMax < daysMin) {
      throw new AppError(
        'VALIDATION_ERROR',
        'estimatedDaysMax must be >= estimatedDaysMin',
        422,
      );
    }

    const updateData: Parameters<typeof updateMethod>[1] = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.flatRate !== undefined) updateData.flatRate = input.flatRate.toFixed(2);
    if (input.estimatedDaysMin !== undefined) updateData.estimatedDaysMin = input.estimatedDaysMin;
    if (input.estimatedDaysMax !== undefined) updateData.estimatedDaysMax = input.estimatedDaysMax;
    if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

    const method = await updateMethod(id, updateData, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'shipping_method.updated',
        resourceType: 'shipping_method',
        resourceId: id,
      },
      tx,
    );

    return method;
  });
}

// ── deactivate ────────────────────────────────────────────────────────────

export async function deactivate(
  facilityId: string,
  id: string,
  actorId: string,
): Promise<void> {
  return withTenantContext(facilityId, async (tx) => {
    const existing = await findMethodById(id, tx);
    if (!existing) {
      throw new AppError('SHIPPING_METHOD_NOT_FOUND', 'Shipping method not found', 404);
    }
    if (!existing.isActive) {
      throw new AppError('SHIPPING_METHOD_ALREADY_INACTIVE', 'Shipping method is already inactive', 422);
    }

    await setMethodInactive(id, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId,
        actorType: 'user',
        action: 'shipping_method.deactivated',
        resourceType: 'shipping_method',
        resourceId: id,
      },
      tx,
    );
  });
}

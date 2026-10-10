import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import {
  insertCompoundingRequest,
  insertCompoundingHistory,
  findCompoundingById,
  findCompoundingForPatient,
  findCompoundingDetailForPatient,
  listCompoundingForPatient,
  findCompoundingDetailForAdmin,
  listCompoundingForAdmin,
  updateCompoundingStatus,
} from './compounding.queries';
import { validateCompoundingTransition } from './compounding.types';
import type {
  CompoundingStatus,
  PatientCompoundingDetail,
  AdminCompoundingDetail,
  PatientCompoundingSummary,
} from './compounding.types';
import type {
  CreateCompoundingBody,
  ListCompoundingQuery,
  AdminListCompoundingQuery,
  AdminCompoundingStatusBody,
} from './compounding.validator';

// ── submitCompounding ─────────────────────────────────────────────────────

export async function submitCompounding(
  auth: AuthContext,
  input: CreateCompoundingBody,
): Promise<PatientCompoundingDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const { id } = await insertCompoundingRequest(
      {
        facilityId,
        patientId: auth.userId,
        compoundName: input.compoundName,
        strength: input.strength,
        form: input.form,
        quantity: input.quantity,
        specialInstructions: input.specialInstructions,
        prescriberName: input.prescriberName,
        fileReference: input.fileReference,
        status: 'submitted',
      },
      tx,
    );

    await insertCompoundingHistory(
      {
        requestId: id,
        facilityId,
        previousStatus: null,
        newStatus: 'submitted',
        changedById: null,
        note: null,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'compounding.submitted',
        resourceType: 'compounding_request',
        resourceId: id,
      },
      tx,
    );

    const detail = await findCompoundingDetailForPatient(facilityId, id, auth.userId, tx);
    return detail!;
  });
}

// ── listPatientCompounding ────────────────────────────────────────────────

export async function listPatientCompounding(
  auth: AuthContext,
  opts: ListCompoundingQuery,
): Promise<{ rows: PatientCompoundingSummary[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listCompoundingForPatient(
      facilityId,
      auth.userId,
      { status: opts.status as CompoundingStatus | undefined, page: opts.page, limit: opts.limit },
      tx,
    );
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getPatientCompoundingDetail ───────────────────────────────────────────

export async function getPatientCompoundingDetail(
  auth: AuthContext,
  id: string,
): Promise<PatientCompoundingDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findCompoundingDetailForPatient(facilityId, id, auth.userId, tx);
    if (!detail) {
      throw new AppError('COMPOUNDING_REQUEST_NOT_FOUND', 'Compounding request not found', 404);
    }

    if (detail.fileReference) {
      await createAuditEntry(
        {
          facilityId,
          actorId: auth.userId,
          actorType: 'user',
          action: 'compounding.file_accessed',
          resourceType: 'compounding_request',
          resourceId: id,
        },
        tx,
      );
    }

    return detail;
  });
}

// ── acceptQuote ───────────────────────────────────────────────────────────

export async function acceptQuote(auth: AuthContext, id: string): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findCompoundingForPatient(facilityId, id, auth.userId, tx);
    if (!existing) {
      throw new AppError('COMPOUNDING_REQUEST_NOT_FOUND', 'Compounding request not found', 404);
    }

    validateCompoundingTransition(existing.status as CompoundingStatus, 'accepted');

    await updateCompoundingStatus(id, { status: 'accepted', updatedAt: new Date() }, tx);

    await insertCompoundingHistory(
      {
        requestId: id,
        facilityId,
        previousStatus: existing.status,
        newStatus: 'accepted',
        changedById: auth.userId,
        note: null,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'compounding.quote_accepted',
        resourceType: 'compounding_request',
        resourceId: id,
      },
      tx,
    );
  });
}

// ── declineQuote ──────────────────────────────────────────────────────────

export async function declineQuote(auth: AuthContext, id: string, note?: string): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findCompoundingForPatient(facilityId, id, auth.userId, tx);
    if (!existing) {
      throw new AppError('COMPOUNDING_REQUEST_NOT_FOUND', 'Compounding request not found', 404);
    }

    validateCompoundingTransition(existing.status as CompoundingStatus, 'patient_declined');

    await updateCompoundingStatus(id, { status: 'patient_declined', updatedAt: new Date() }, tx);

    await insertCompoundingHistory(
      {
        requestId: id,
        facilityId,
        previousStatus: existing.status,
        newStatus: 'patient_declined',
        changedById: auth.userId,
        note: note ?? null,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'compounding.quote_declined',
        resourceType: 'compounding_request',
        resourceId: id,
      },
      tx,
    );
  });
}

// ── listAdminCompounding ──────────────────────────────────────────────────

export async function listAdminCompounding(
  auth: AuthContext,
  opts: AdminListCompoundingQuery,
): Promise<{ rows: (PatientCompoundingSummary & { patientName: string })[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listCompoundingForAdmin(facilityId, opts, tx);
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getAdminCompoundingDetail ─────────────────────────────────────────────

export async function getAdminCompoundingDetail(
  auth: AuthContext,
  id: string,
): Promise<AdminCompoundingDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findCompoundingDetailForAdmin(facilityId, id, tx);
    if (!detail) {
      throw new AppError('COMPOUNDING_REQUEST_NOT_FOUND', 'Compounding request not found', 404);
    }

    if (detail.fileReference) {
      await createAuditEntry(
        {
          facilityId,
          actorId: auth.userId,
          actorType: 'user',
          action: 'compounding.file_accessed',
          resourceType: 'compounding_request',
          resourceId: id,
          metadata: { role: 'admin' },
        },
        tx,
      );
    }

    return detail;
  });
}

// ── adminUpdateCompoundingStatus ──────────────────────────────────────────

export async function adminUpdateCompoundingStatus(
  auth: AuthContext,
  id: string,
  input: AdminCompoundingStatusBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findCompoundingById(id, tx);
    if (!existing) {
      throw new AppError('COMPOUNDING_REQUEST_NOT_FOUND', 'Compounding request not found', 404);
    }

    validateCompoundingTransition(
      existing.status as CompoundingStatus,
      input.newStatus as CompoundingStatus,
    );

    await updateCompoundingStatus(
      id,
      {
        status: input.newStatus as CompoundingStatus,
        quotedPrice: input.quotedPrice,
        quotedTurnaroundDays: input.quotedTurnaroundDays,
        internalNotes: input.internalNotes,
        updatedAt: new Date(),
      },
      tx,
    );

    await insertCompoundingHistory(
      {
        requestId: id,
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
        action: 'compounding.status_changed',
        resourceType: 'compounding_request',
        resourceId: id,
        metadata: { from: existing.status, to: input.newStatus },
      },
      tx,
    );
  });
}

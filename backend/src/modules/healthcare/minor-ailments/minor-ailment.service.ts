import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import {
  listActiveCatalog,
  listAllCatalog,
  findCatalogEntryById,
  checkCatalogNameExists,
  insertCatalogEntry,
  updateCatalogEntry,
  insertMinorAilmentRequest,
  insertMinorAilmentHistory,
  findMinorAilmentById,
  findMinorAilmentDetailForPatient,
  listMinorAilmentsForPatient,
  findMinorAilmentDetailForAdmin,
  listMinorAilmentsForAdmin,
  updateMinorAilmentRequest,
} from './minor-ailment.queries';
import { validateMinorAilmentTransition } from './minor-ailment.types';
import type {
  MinorAilmentStatus,
  CatalogEntry,
  PatientAssessmentDetail,
  AdminAssessmentDetail,
  PatientAssessmentSummary,
} from './minor-ailment.types';
import type {
  CreateAssessmentBody,
  ListAssessmentsQuery,
  AdminListAssessmentsQuery,
  CreateCatalogEntryBody,
  UpdateCatalogEntryBody,
  AdminAssessmentStatusBody,
} from './minor-ailment.validator';

// ── listPublicCatalog ─────────────────────────────────────────────────────
// Used by the public GET endpoint — no auth required.

export async function listPublicCatalog(facilityId: string): Promise<CatalogEntry[]> {
  return withTenantContext(facilityId, async (tx) => {
    return listActiveCatalog(facilityId, tx);
  });
}

// ── listAdminCatalog ──────────────────────────────────────────────────────

export async function listAdminCatalog(auth: AuthContext): Promise<CatalogEntry[]> {
  const facilityId = auth.facilityId!;
  return withTenantContext(facilityId, async (tx) => {
    return listAllCatalog(facilityId, tx);
  });
}

// ── createCatalogEntry ────────────────────────────────────────────────────

export async function createCatalogEntry(
  auth: AuthContext,
  input: CreateCatalogEntryBody,
): Promise<CatalogEntry> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const exists = await checkCatalogNameExists(facilityId, input.name, undefined, tx);
    if (exists) {
      throw new AppError('AILMENT_NAME_EXISTS', `An ailment named "${input.name}" already exists`, 409);
    }

    const entry = await insertCatalogEntry(
      {
        facilityId,
        name: input.name,
        description: input.description,
        displayOrder: input.displayOrder,
        isActive: true,
      },
      tx,
    );

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'ailment.catalog_created',
        resourceType: 'minor_ailment_catalog',
        resourceId: entry.id,
      },
      tx,
    );

    return entry;
  });
}

// ── updateCatalogEntryService ─────────────────────────────────────────────

export async function updateCatalogEntryService(
  auth: AuthContext,
  id: string,
  input: UpdateCatalogEntryBody,
): Promise<CatalogEntry> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const existing = await findCatalogEntryById(id, tx);
    if (!existing) {
      throw new AppError('AILMENT_NOT_FOUND', 'Ailment catalog entry not found', 404);
    }

    if (input.name) {
      const exists = await checkCatalogNameExists(facilityId, input.name, id, tx);
      if (exists) {
        throw new AppError('AILMENT_NAME_EXISTS', `An ailment named "${input.name}" already exists`, 409);
      }
    }

    const updated = await updateCatalogEntry(id, { ...input }, tx);
    return updated;
  });
}

// ── submitAssessment ──────────────────────────────────────────────────────

export async function submitAssessment(
  auth: AuthContext,
  input: CreateAssessmentBody,
): Promise<PatientAssessmentDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const ailment = await findCatalogEntryById(input.ailmentId, tx);
    if (!ailment) {
      throw new AppError('AILMENT_NOT_FOUND', 'Ailment not found in catalog', 422);
    }
    if (!ailment.isActive) {
      throw new AppError('AILMENT_INACTIVE', 'This ailment is not currently available for assessment', 422);
    }

    const { id } = await insertMinorAilmentRequest(
      {
        facilityId,
        patientId: auth.userId,
        ailmentId: input.ailmentId,
        symptoms: input.symptoms,
        duration: input.duration,
        currentMedications: input.currentMedications,
        healthHistory: input.healthHistory,
        status: 'submitted',
      },
      tx,
    );

    await insertMinorAilmentHistory(
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

    const detail = await findMinorAilmentDetailForPatient(facilityId, id, auth.userId, tx);
    return detail!;
  });
}

// ── listPatientAssessments ────────────────────────────────────────────────

export async function listPatientAssessments(
  auth: AuthContext,
  opts: ListAssessmentsQuery,
): Promise<{ rows: PatientAssessmentSummary[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listMinorAilmentsForPatient(
      facilityId,
      auth.userId,
      { status: opts.status as MinorAilmentStatus | undefined, page: opts.page, limit: opts.limit },
      tx,
    );
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getPatientAssessmentDetail ────────────────────────────────────────────

export async function getPatientAssessmentDetail(
  auth: AuthContext,
  id: string,
): Promise<PatientAssessmentDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findMinorAilmentDetailForPatient(facilityId, id, auth.userId, tx);
    if (!detail) {
      throw new AppError('AILMENT_NOT_FOUND', 'Assessment not found', 404);
    }
    return detail;
  });
}

// ── listAdminAssessments ──────────────────────────────────────────────────

export async function listAdminAssessments(
  auth: AuthContext,
  opts: AdminListAssessmentsQuery,
): Promise<{ rows: (PatientAssessmentSummary & { patientName: string })[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listMinorAilmentsForAdmin(facilityId, opts, tx);
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getAdminAssessmentDetail ──────────────────────────────────────────────

export async function getAdminAssessmentDetail(
  auth: AuthContext,
  id: string,
): Promise<AdminAssessmentDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findMinorAilmentDetailForAdmin(facilityId, id, tx);
    if (!detail) {
      throw new AppError('AILMENT_NOT_FOUND', 'Assessment not found', 404);
    }
    return detail;
  });
}

// ── updateAssessmentStatus ────────────────────────────────────────────────

export async function updateAssessmentStatus(
  auth: AuthContext,
  id: string,
  input: AdminAssessmentStatusBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findMinorAilmentById(id, tx);
    if (!existing) {
      throw new AppError('AILMENT_NOT_FOUND', 'Assessment not found', 404);
    }

    validateMinorAilmentTransition(
      existing.status as MinorAilmentStatus,
      input.newStatus as MinorAilmentStatus,
    );

    await updateMinorAilmentRequest(
      id,
      {
        status: input.newStatus as MinorAilmentStatus,
        treatmentNote: input.treatmentNote,
        internalNotes: input.internalNotes,
        updatedAt: new Date(),
      },
      tx,
    );

    await insertMinorAilmentHistory(
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
        action: 'ailment.status_changed',
        resourceType: 'minor_ailment_request',
        resourceId: id,
        metadata: { from: existing.status, to: input.newStatus },
      },
      tx,
    );
  });
}

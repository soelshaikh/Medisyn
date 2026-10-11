import { withTenantContext } from '@/lib/tenant-context';
import { AppError } from '@/lib/errors';
import { createAuditEntry } from '@/core/audit/audit.service';
import { createNotification } from '@/notifications/notifications.service';
import { fileStorage } from '@/lib/file-storage/file-storage.service';
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, MIME_TO_EXT } from '@/lib/file-storage/file-storage.types';
import type { AuthContext } from '@/core/auth/middleware/parse-jwt';
import {
  insertPrescriptionRequest,
  insertPrescriptionHistory,
  findPrescriptionById,
  findPrescriptionDetailForPatient,
  listPrescriptionsForPatient,
  findPrescriptionDetailForAdmin,
  listPrescriptionsForAdmin,
  updatePrescription,
  appendPrescriptionFileKey,
} from './prescription.queries';
import { validatePrescriptionTransition } from './prescription.types';
import type {
  PrescriptionStatus,
  PatientPrescriptionDetail,
  AdminPrescriptionDetail,
  PatientPrescriptionSummary,
} from './prescription.types';
import type {
  CreatePrescriptionBody,
  ListPrescriptionsQuery,
  AdminListPrescriptionsQuery,
  AdminPrescriptionStatusBody,
} from './prescription.validator';

// ── submitPrescription ────────────────────────────────────────────────────

export async function submitPrescription(
  auth: AuthContext,
  input: CreatePrescriptionBody,
): Promise<PatientPrescriptionDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const { id } = await insertPrescriptionRequest(
      {
        facilityId,
        patientId: auth.userId,
        type: input.type,
        medicationName: input.medicationName,
        dosage: input.dosage,
        prescriberName: input.prescriberName,
        prescriberFax: input.prescriberFax,
        fileReference: input.fileReference,
        status: 'submitted',
      },
      tx,
    );

    await insertPrescriptionHistory(
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
        action: 'prescription.submitted',
        resourceType: 'prescription_request',
        resourceId: id,
      },
      tx,
    );

    const detail = await findPrescriptionDetailForPatient(facilityId, id, auth.userId, tx);
    return detail!;
  });
}

// ── listPatientPrescriptions ──────────────────────────────────────────────

export async function listPatientPrescriptions(
  auth: AuthContext,
  opts: ListPrescriptionsQuery,
): Promise<{ rows: PatientPrescriptionSummary[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listPrescriptionsForPatient(
      facilityId,
      auth.userId,
      { status: opts.status as PrescriptionStatus | undefined, page: opts.page, limit: opts.limit },
      tx,
    );
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getPatientPrescriptionDetail ──────────────────────────────────────────

export async function getPatientPrescriptionDetail(
  auth: AuthContext,
  id: string,
): Promise<PatientPrescriptionDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findPrescriptionDetailForPatient(facilityId, id, auth.userId, tx);
    if (!detail) {
      throw new AppError('PRESCRIPTION_REQUEST_NOT_FOUND', 'Prescription request not found', 404);
    }

    if (detail.fileReference) {
      await createAuditEntry(
        {
          facilityId,
          actorId: auth.userId,
          actorType: 'user',
          action: 'prescription.file_accessed',
          resourceType: 'prescription_request',
          resourceId: id,
        },
        tx,
      );
    }

    return detail;
  });
}

// ── listAdminPrescriptions ────────────────────────────────────────────────

export async function listAdminPrescriptions(
  auth: AuthContext,
  opts: AdminListPrescriptionsQuery,
): Promise<{ rows: (PatientPrescriptionSummary & { patientName: string })[]; pagination: { page: number; limit: number; total: number } }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const result = await listPrescriptionsForAdmin(facilityId, opts, tx);
    return {
      rows: result.rows,
      pagination: { page: opts.page, limit: opts.limit, total: result.total },
    };
  });
}

// ── getAdminPrescriptionDetail ────────────────────────────────────────────

export async function getAdminPrescriptionDetail(
  auth: AuthContext,
  id: string,
): Promise<AdminPrescriptionDetail> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const detail = await findPrescriptionDetailForAdmin(facilityId, id, tx);
    if (!detail) {
      throw new AppError('PRESCRIPTION_REQUEST_NOT_FOUND', 'Prescription request not found', 404);
    }

    if (detail.fileReference) {
      await createAuditEntry(
        {
          facilityId,
          actorId: auth.userId,
          actorType: 'user',
          action: 'prescription.file_accessed',
          resourceType: 'prescription_request',
          resourceId: id,
          metadata: { role: 'admin' },
        },
        tx,
      );
    }

    return detail;
  });
}

// ── updatePrescriptionStatus ──────────────────────────────────────────────

export async function updatePrescriptionStatus(
  auth: AuthContext,
  id: string,
  input: AdminPrescriptionStatusBody,
): Promise<void> {
  const facilityId = auth.facilityId!;

  await withTenantContext(facilityId, async (tx) => {
    const existing = await findPrescriptionById(id, tx);
    if (!existing) {
      throw new AppError('PRESCRIPTION_REQUEST_NOT_FOUND', 'Prescription request not found', 404);
    }

    validatePrescriptionTransition(
      existing.status as PrescriptionStatus,
      input.newStatus as PrescriptionStatus,
    );

    await updatePrescription(
      id,
      {
        status: input.newStatus as PrescriptionStatus,
        dispenseNotes: input.dispenseNotes,
        internalNotes: input.internalNotes,
        updatedAt: new Date(),
      },
      tx,
    );

    await insertPrescriptionHistory(
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
        action: 'prescription.status_changed',
        resourceType: 'prescription_request',
        resourceId: id,
        metadata: { from: existing.status, to: input.newStatus },
      },
      tx,
    );

    await createNotification(tx, {
      facilityId,
      userId: existing.patientId,
      type: 'prescription_status_changed',
      title: 'Prescription update',
      body: `Your prescription status has been updated to: ${input.newStatus}.`,
      actionUrl: `${process.env.FRONTEND_URL ?? ''}/patient/prescriptions/${id}`,
    });
  });
}

// ── uploadPrescriptionFile ────────────────────────────────────────────────

export async function uploadPrescriptionFile(
  auth: AuthContext,
  prescriptionId: string,
  file: Express.Multer.File,
): Promise<{ fileKey: string }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const record = await findPrescriptionById(prescriptionId, tx);
    if (!record) {
      throw new AppError('NOT_FOUND', 'Prescription request not found', 404);
    }

    if (record.patientId !== auth.userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    const ext = file.originalname.includes('.')
      ? `.${file.originalname.split('.').pop()!.toLowerCase()}`
      : '';

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      throw new AppError('FILE_TYPE_NOT_ALLOWED', 'File type not allowed', 422);
    }

    if (file.size === 0) {
      throw new AppError('FILE_EMPTY', 'File is empty', 422);
    }

    const mappedExt = MIME_TO_EXT[file.mimetype]!;
    const fileKey = await fileStorage.uploadFile(
      file.buffer,
      file.mimetype,
      `${facilityId}/prescriptions`,
      mappedExt,
    );

    await appendPrescriptionFileKey(prescriptionId, fileKey, tx);

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'file.upload',
        resourceType: 'prescription_request',
        resourceId: prescriptionId,
        metadata: { fileKey, mimeType: file.mimetype, sizeBytes: file.size },
      },
      tx,
    );

    return { fileKey };
  });
}

// ── getPrescriptionFileUrl ────────────────────────────────────────────────

export async function getPrescriptionFileUrl(
  auth: AuthContext,
  prescriptionId: string,
  fileKey: string,
): Promise<{ url: string; expiresIn: number }> {
  const facilityId = auth.facilityId!;

  return withTenantContext(facilityId, async (tx) => {
    const record = await findPrescriptionById(prescriptionId, tx);
    if (!record) {
      throw new AppError('NOT_FOUND', 'Prescription request not found', 404);
    }

    if (record.patientId !== auth.userId) {
      throw new AppError('FORBIDDEN', 'Access denied', 403);
    }

    if (!record.fileKeys.includes(fileKey)) {
      throw new AppError('FORBIDDEN', 'File not associated with this prescription', 403);
    }

    const url = await fileStorage.getSignedUrl(fileKey);

    await createAuditEntry(
      {
        facilityId,
        actorId: auth.userId,
        actorType: 'user',
        action: 'file.sign_url',
        resourceType: 'prescription_request',
        resourceId: prescriptionId,
        metadata: { fileKey, expirySeconds: fileStorage.signedUrlExpiry },
      },
      tx,
    );

    return { url, expiresIn: fileStorage.signedUrlExpiry };
  });
}

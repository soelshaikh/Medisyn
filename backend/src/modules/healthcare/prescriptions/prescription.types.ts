import { AppError } from '@/lib/errors';

export type PrescriptionType = 'refill' | 'transfer' | 'new';

export type PrescriptionStatus = 'submitted' | 'under_review' | 'approved' | 'declined';

export const PRESCRIPTION_VALID_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  submitted:    ['under_review', 'approved', 'declined'],
  under_review: ['approved', 'declined'],
  approved:     [],
  declined:     [],
};

export function validatePrescriptionTransition(
  current: PrescriptionStatus,
  next: PrescriptionStatus,
): void {
  const allowed = PRESCRIPTION_VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'HEALTHCARE_INVALID_STATUS_TRANSITION',
      `Cannot transition prescription from '${current}' to '${next}'`,
      422,
    );
  }
}

export interface PrescriptionHistoryEntry {
  id: string;
  requestId: string;
  facilityId: string;
  previousStatus: PrescriptionStatus | null;
  newStatus: PrescriptionStatus;
  changedById: string | null;
  changedByName: string | null;
  note: string | null;
  createdAt: Date;
}

export interface PatientPrescriptionSummary {
  id: string;
  type: PrescriptionType;
  medicationName: string;
  dosage: string | null;
  status: PrescriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

// internalNotes intentionally absent — never exposed to patients
export interface PatientPrescriptionDetail extends PatientPrescriptionSummary {
  prescriberName: string | null;
  prescriberFax: string | null;
  fileReference: string | null;
  dispenseNotes: string | null;
  statusHistory: PrescriptionHistoryEntry[];
}

export interface AdminPrescriptionDetail extends PatientPrescriptionDetail {
  internalNotes: string | null;
  patientId: string;
  patientName: string;
  patientEmail: string;
}

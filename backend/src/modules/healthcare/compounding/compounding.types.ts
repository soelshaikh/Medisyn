import { AppError } from '@/lib/errors';

export type CompoundForm = 'tablet' | 'capsule' | 'liquid' | 'cream' | 'suppository' | 'other';

export type CompoundingStatus =
  | 'submitted'
  | 'under_review'
  | 'quoted'
  | 'accepted'
  | 'patient_declined'
  | 'ready'
  | 'completed'
  | 'declined';

export const COMPOUNDING_VALID_TRANSITIONS: Record<CompoundingStatus, CompoundingStatus[]> = {
  submitted:       ['under_review', 'quoted', 'declined'],
  under_review:    ['quoted', 'declined'],
  quoted:          ['accepted', 'patient_declined', 'declined'],
  accepted:        ['ready'],
  patient_declined: [],
  ready:           ['completed'],
  completed:       [],
  declined:        [],
};

export function validateCompoundingTransition(
  current: CompoundingStatus,
  next: CompoundingStatus,
): void {
  const allowed = COMPOUNDING_VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'HEALTHCARE_INVALID_STATUS_TRANSITION',
      `Cannot transition compounding request from '${current}' to '${next}'`,
      422,
    );
  }
}

export interface CompoundingHistoryEntry {
  id: string;
  requestId: string;
  facilityId: string;
  previousStatus: CompoundingStatus | null;
  newStatus: CompoundingStatus;
  changedById: string | null;
  changedByName: string | null;
  note: string | null;
  createdAt: Date;
}

export interface PatientCompoundingSummary {
  id: string;
  compoundName: string;
  form: CompoundForm;
  status: CompoundingStatus;
  quotedPrice: string | null;
  quotedTurnaroundDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// internalNotes intentionally absent — never exposed to patients
export interface PatientCompoundingDetail extends PatientCompoundingSummary {
  strength: string | null;
  quantity: string;
  specialInstructions: string | null;
  prescriberName: string | null;
  fileReference: string | null;
  statusHistory: CompoundingHistoryEntry[];
}

export interface AdminCompoundingDetail extends PatientCompoundingDetail {
  internalNotes: string | null;
  patientId: string;
  patientName: string;
  patientEmail: string;
}

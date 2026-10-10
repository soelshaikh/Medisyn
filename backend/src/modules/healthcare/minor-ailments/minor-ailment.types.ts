import { AppError } from '@/lib/errors';

export type MinorAilmentStatus = 'submitted' | 'under_review' | 'treated' | 'referred';

export const MINOR_AILMENT_VALID_TRANSITIONS: Record<MinorAilmentStatus, MinorAilmentStatus[]> = {
  submitted:    ['under_review', 'treated', 'referred'],
  under_review: ['treated', 'referred'],
  treated:      [],
  referred:     [],
};

export function validateMinorAilmentTransition(
  current: MinorAilmentStatus,
  next: MinorAilmentStatus,
): void {
  const allowed = MINOR_AILMENT_VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'HEALTHCARE_INVALID_STATUS_TRANSITION',
      `Cannot transition minor ailment assessment from '${current}' to '${next}'`,
      422,
    );
  }
}

export interface CatalogEntry {
  id: string;
  facilityId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MinorAilmentHistoryEntry {
  id: string;
  requestId: string;
  facilityId: string;
  previousStatus: MinorAilmentStatus | null;
  newStatus: MinorAilmentStatus;
  changedById: string | null;
  changedByName: string | null;
  note: string | null;
  createdAt: Date;
}

export interface PatientAssessmentSummary {
  id: string;
  ailmentId: string;
  ailmentName: string;
  symptoms: string;
  duration: string;
  status: MinorAilmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// treatmentNote IS patient-visible; internalNotes is intentionally absent
export interface PatientAssessmentDetail extends PatientAssessmentSummary {
  currentMedications: string | null;
  healthHistory: string | null;
  treatmentNote: string | null;
  statusHistory: MinorAilmentHistoryEntry[];
}

export interface AdminAssessmentDetail extends PatientAssessmentDetail {
  internalNotes: string | null;
  patientId: string;
  patientName: string;
  patientEmail: string;
}

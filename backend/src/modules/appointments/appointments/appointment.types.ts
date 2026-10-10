import { AppError } from '@/lib/errors';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

// All statuses are terminal from 'scheduled'
export const APPOINTMENT_VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled:  ['completed', 'cancelled', 'no_show'],
  completed:  [],
  cancelled:  [],
  no_show:    [],
};

export function validateAppointmentTransition(
  current: AppointmentStatus,
  next: AppointmentStatus,
): void {
  const allowed = APPOINTMENT_VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'APPOINTMENT_INVALID_STATUS_TRANSITION',
      `Cannot transition appointment from '${current}' to '${next}'`,
      422,
    );
  }
}

export interface AppointmentHistoryEntry {
  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  changedByName: string | null;
  note: string | null;
  createdAt: Date;
}

// Patient summary (no internalNotes)
export interface PatientAppointmentSummary {
  id: string;
  serviceName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  createdAt: Date;
}

// Patient detail — internalNotes structurally absent
export interface PatientAppointmentDetail extends PatientAppointmentSummary {
  durationMinutes: number;
  eligibilityNotes: string | null;
  statusHistory: AppointmentHistoryEntry[];
}

// Admin summary
export interface AdminAppointmentSummary {
  id: string;
  patientName: string;
  patientEmail: string;
  serviceName: string;
  slotDate: string;
  startTime: string;
  status: AppointmentStatus;
  createdAt: Date;
}

// Admin detail — internalNotes present
export interface AdminAppointmentDetail {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  serviceName: string;
  durationMinutes: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  internalNotes: string | null;
  status: AppointmentStatus;
  statusHistory: (AppointmentHistoryEntry & { changedByName: string | null })[];
  createdAt: Date;
}

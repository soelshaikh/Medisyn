import { z } from 'zod';

const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;
const ADMIN_STATUS_TRANSITIONS = ['completed', 'cancelled', 'no_show'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const BookAppointmentBodySchema = z.object({
  slotId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const CancelAppointmentBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export const ListPatientAppointmentsQuerySchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminListAppointmentsQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  slotId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  dateFrom: z.string().regex(DATE_RE).optional(),
  dateTo: z.string().regex(DATE_RE).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['slotDate:asc', 'slotDate:desc', 'createdAt:desc']).default('slotDate:asc'),
});

export const AdminUpdateStatusBodySchema = z.object({
  newStatus: z.enum(ADMIN_STATUS_TRANSITIONS),
  note: z.string().max(500).optional(),
});

export const AdminUpdateNotesBodySchema = z.object({
  notes: z.string().max(2000),
});

export type BookAppointmentBody = z.infer<typeof BookAppointmentBodySchema>;
export type CancelAppointmentBody = z.infer<typeof CancelAppointmentBodySchema>;
export type ListPatientAppointmentsQuery = z.infer<typeof ListPatientAppointmentsQuerySchema>;
export type AdminListAppointmentsQuery = z.infer<typeof AdminListAppointmentsQuerySchema>;
export type AdminUpdateStatusBody = z.infer<typeof AdminUpdateStatusBodySchema>;
export type AdminUpdateNotesBody = z.infer<typeof AdminUpdateNotesBodySchema>;

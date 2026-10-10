import { z } from 'zod';

const PRESCRIPTION_STATUSES = ['submitted', 'under_review', 'approved', 'declined'] as const;

export const CreatePrescriptionBodySchema = z.object({
  type: z.enum(['refill', 'transfer', 'new']),
  medicationName: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  prescriberName: z.string().max(200).optional(),
  prescriberFax: z.string().max(30).optional(),
  fileReference: z.string().optional(),
});

export const ListPrescriptionsQuerySchema = z.object({
  status: z.enum(PRESCRIPTION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminListPrescriptionsQuerySchema = z.object({
  status: z.enum(PRESCRIPTION_STATUSES).optional(),
  patientId: z.string().uuid().optional(),
  type: z.enum(['refill', 'transfer', 'new']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt:asc', 'createdAt:desc']).default('createdAt:desc'),
});

export const AdminPrescriptionStatusBodySchema = z.object({
  newStatus: z.enum(PRESCRIPTION_STATUSES),
  dispenseNotes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  note: z.string().max(500).optional(),
});

export type CreatePrescriptionBody = z.infer<typeof CreatePrescriptionBodySchema>;
export type ListPrescriptionsQuery = z.infer<typeof ListPrescriptionsQuerySchema>;
export type AdminListPrescriptionsQuery = z.infer<typeof AdminListPrescriptionsQuerySchema>;
export type AdminPrescriptionStatusBody = z.infer<typeof AdminPrescriptionStatusBodySchema>;

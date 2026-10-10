import { z } from 'zod';

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'ready',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export const ListPatientOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListAdminOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  patientId: z.string().uuid().optional(),
  orderNumber: z.string().max(20).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt:asc', 'createdAt:desc', 'total:asc', 'total:desc']).default('createdAt:desc'),
});

export const AdvanceStatusBodySchema = z.object({
  newStatus: z.enum(ORDER_STATUSES),
  note: z.string().max(500).optional(),
});

export const UpdateNotesBodySchema = z.object({
  notes: z.string().max(2000),
});

export const CancelOrderBodySchema = z.object({
  note: z.string().max(500).optional(),
});

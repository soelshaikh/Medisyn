import { z } from 'zod';

const COMPOUNDING_STATUSES = [
  'submitted',
  'under_review',
  'quoted',
  'accepted',
  'patient_declined',
  'ready',
  'completed',
  'declined',
] as const;

export const CreateCompoundingBodySchema = z.object({
  compoundName: z.string().min(1).max(200),
  strength: z.string().max(100).optional(),
  form: z.enum(['tablet', 'capsule', 'liquid', 'cream', 'suppository', 'other']),
  quantity: z.string().min(1).max(100),
  specialInstructions: z.string().max(1000).optional(),
  prescriberName: z.string().max(200).optional(),
  fileReference: z.string().optional(),
});

export const ListCompoundingQuerySchema = z.object({
  status: z.enum(COMPOUNDING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminListCompoundingQuerySchema = z.object({
  status: z.enum(COMPOUNDING_STATUSES).optional(),
  patientId: z.string().uuid().optional(),
  form: z.enum(['tablet', 'capsule', 'liquid', 'cream', 'suppository', 'other']).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt:asc', 'createdAt:desc']).default('createdAt:desc'),
});

export const AdminCompoundingStatusBodySchema = z
  .object({
    newStatus: z.enum(COMPOUNDING_STATUSES),
    quotedPrice: z.number().min(0).optional(),
    quotedTurnaroundDays: z.number().int().min(0).optional(),
    internalNotes: z.string().max(2000).optional(),
    note: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newStatus === 'quoted') {
      if (data.quotedPrice === undefined || data.quotedPrice === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quotedPrice'],
          message: 'quotedPrice is required when newStatus is "quoted"',
        });
      }
      if (data.quotedTurnaroundDays === undefined || data.quotedTurnaroundDays === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quotedTurnaroundDays'],
          message: 'quotedTurnaroundDays is required when newStatus is "quoted"',
        });
      }
    }
  });

export const DeclineQuoteBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export type CreateCompoundingBody = z.infer<typeof CreateCompoundingBodySchema>;
export type ListCompoundingQuery = z.infer<typeof ListCompoundingQuerySchema>;
export type AdminListCompoundingQuery = z.infer<typeof AdminListCompoundingQuerySchema>;
export type AdminCompoundingStatusBody = z.infer<typeof AdminCompoundingStatusBodySchema>;
export type DeclineQuoteBody = z.infer<typeof DeclineQuoteBodySchema>;

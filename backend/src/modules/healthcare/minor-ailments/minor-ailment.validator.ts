import { z } from 'zod';

const AILMENT_STATUSES = ['submitted', 'under_review', 'treated', 'referred'] as const;

export const CreateAssessmentBodySchema = z.object({
  ailmentId: z.string().uuid(),
  symptoms: z.string().min(10),
  duration: z.string().min(1).max(200),
  currentMedications: z.string().optional(),
  healthHistory: z.string().optional(),
});

export const ListAssessmentsQuerySchema = z.object({
  status: z.enum(AILMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AdminListAssessmentsQuerySchema = z.object({
  status: z.enum(AILMENT_STATUSES).optional(),
  ailmentId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt:asc', 'createdAt:desc']).default('createdAt:desc'),
});

export const CreateCatalogEntryBodySchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  displayOrder: z.coerce.number().int().default(0),
});

export const UpdateCatalogEntryBodySchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.coerce.number().int().optional(),
});

export const AdminAssessmentStatusBodySchema = z
  .object({
    newStatus: z.enum(AILMENT_STATUSES),
    treatmentNote: z.string().min(1).optional(),
    internalNotes: z.string().max(2000).optional(),
    note: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newStatus === 'treated' && !data.treatmentNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['treatmentNote'],
        message: 'treatmentNote is required when newStatus is "treated"',
      });
    }
  });

export type CreateAssessmentBody = z.infer<typeof CreateAssessmentBodySchema>;
export type ListAssessmentsQuery = z.infer<typeof ListAssessmentsQuerySchema>;
export type AdminListAssessmentsQuery = z.infer<typeof AdminListAssessmentsQuerySchema>;
export type CreateCatalogEntryBody = z.infer<typeof CreateCatalogEntryBodySchema>;
export type UpdateCatalogEntryBody = z.infer<typeof UpdateCatalogEntryBodySchema>;
export type AdminAssessmentStatusBody = z.infer<typeof AdminAssessmentStatusBodySchema>;

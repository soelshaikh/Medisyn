import { z } from 'zod';

const slugField = z
  .string()
  .max(255)
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
  .optional()
  .nullable();

export const CreateCategoryBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: slugField,
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const UpdateCategoryBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: slugField,
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

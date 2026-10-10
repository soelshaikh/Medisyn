import { z } from 'zod';

const numericString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal number (e.g. "9.99")');

const optionalNumericString = numericString.optional().nullable();

export const CreateVariantBodySchema = z.object({
  sku: z.string().min(1).max(100),
  dimensionValue: z.string().min(1).max(100),
  price: numericString,
  compareAtPrice: optionalNumericString,
});

export const UpdateVariantBodySchema = z.object({
  sku: z.string().min(1).max(100).optional(),
  dimensionValue: z.string().min(1).max(100).optional(),
  price: numericString.optional(),
  compareAtPrice: optionalNumericString,
  isActive: z.boolean().optional(),
});

export const CreateProductBodySchema = z
  .object({
    sku: z.string().min(1).max(100),
    name: z.string().min(1).max(255),
    price: numericString,
    categoryId: z.string().uuid().optional().nullable(),
    slug: z
      .string()
      .max(255)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional()
      .nullable(),
    description: z.string().optional().nullable(),
    shortDescription: z.string().max(500).optional().nullable(),
    brand: z.string().max(100).optional().nullable(),
    images: z.array(z.string().url()).max(20).optional(),
    compareAtPrice: optionalNumericString,
    variantDimensionLabel: z.string().max(100).optional().nullable(),
    lowStockThreshold: z.number().int().min(0).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    variants: z.array(CreateVariantBodySchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.variants && data.variants.length > 0 && !data.variantDimensionLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'variantDimensionLabel is required when variants are provided',
        path: ['variantDimensionLabel'],
      });
    }
  });

export const UpdateProductBodySchema = z
  .object({
    sku: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(255).optional(),
    price: numericString.optional(),
    categoryId: z.string().uuid().optional().nullable(),
    slug: z
      .string()
      .max(255)
      .regex(/^[a-z0-9-]+$/)
      .optional()
      .nullable(),
    description: z.string().optional().nullable(),
    shortDescription: z.string().max(500).optional().nullable(),
    brand: z.string().max(100).optional().nullable(),
    images: z.array(z.string().url()).max(20).optional(),
    compareAtPrice: optionalNumericString,
    variantDimensionLabel: z.string().max(100).optional().nullable(),
    lowStockThreshold: z.number().int().min(0).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

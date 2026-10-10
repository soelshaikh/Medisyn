import { z } from 'zod';

export const AddItemBodySchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99),
});

export const UpdateItemBodySchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

export const MergeCartBodySchema = z.object({
  cartToken: z.string().uuid(),
});

export type AddItemBody = z.infer<typeof AddItemBodySchema>;
export type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;
export type MergeCartBody = z.infer<typeof MergeCartBodySchema>;

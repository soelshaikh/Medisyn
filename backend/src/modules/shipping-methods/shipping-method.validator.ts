import { z } from 'zod';

export const CreateShippingMethodBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  flatRate: z.number().min(0),
  estimatedDaysMin: z.number().int().min(0),
  estimatedDaysMax: z.number().int().min(0),
  displayOrder: z.number().int().default(0),
});

export const UpdateShippingMethodBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  flatRate: z.number().min(0).optional(),
  estimatedDaysMin: z.number().int().min(0).optional(),
  estimatedDaysMax: z.number().int().min(0).optional(),
  displayOrder: z.number().int().optional(),
});

export type CreateShippingMethodBody = z.infer<typeof CreateShippingMethodBodySchema>;
export type UpdateShippingMethodBody = z.infer<typeof UpdateShippingMethodBodySchema>;

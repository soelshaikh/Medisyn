import { z } from 'zod';
import { INVENTORY_REASONS, type InventoryReason } from '../catalogue.types';

export const AdjustBodySchema = z.object({
  variantId: z.string().uuid().optional().nullable(),
  quantityDelta: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'quantityDelta cannot be zero' }),
  reason: z.enum(INVENTORY_REASONS as unknown as [InventoryReason, ...InventoryReason[]]),
  note: z.string().max(500).optional().nullable(),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const InventoryHistoryQuerySchema = PaginationQuerySchema.extend({
  variant_id: z.string().uuid().optional(),
});

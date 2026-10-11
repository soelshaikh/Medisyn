import { z } from 'zod';

export const ListEmailLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['queued', 'sent', 'failed', 'bounced']).optional(),
  recipient: z.string().max(320).optional(),
  template: z.string().max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const RetryEmailLogParamsSchema = z.object({
  id: z.string().uuid(),
});

export type ListEmailLogQuery = z.infer<typeof ListEmailLogQuerySchema>;
export type RetryEmailLogParams = z.infer<typeof RetryEmailLogParamsSchema>;

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

function defaultFrom(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().split('T')[0]!;
}

function defaultTo(): string {
  return new Date().toISOString().split('T')[0]!;
}

export const ReportQuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE, 'from must be YYYY-MM-DD').default(defaultFrom),
    to:   z.string().regex(ISO_DATE, 'to must be YYYY-MM-DD').default(defaultTo),
    period: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
    limit:  z.coerce.number().int().min(1).max(50).default(10),
  })
  .refine(
    (d) => new Date(d.from) <= new Date(d.to),
    { message: 'from must not be after to', path: ['from'] },
  )
  .refine(
    (d) =>
      (new Date(d.to).getTime() - new Date(d.from).getTime()) / MS_PER_DAY <= MAX_RANGE_DAYS,
    { message: 'Date range must not exceed 366 days', path: ['to'] },
  );

export type ReportQuery = z.infer<typeof ReportQuerySchema>;

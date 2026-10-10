import { z } from 'zod';

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateAvailabilitySlotBodySchema = z
  .object({
    serviceId: z.string().uuid(),
    slotDate: z.string().regex(DATE_RE, 'slotDate must be YYYY-MM-DD'),
    startTime: z.string().regex(TIME_RE, 'startTime must be HH:MM'),
    endTime: z.string().regex(TIME_RE, 'endTime must be HH:MM'),
    capacity: z.number().int().min(1),
    bookingType: z.enum(['STRICT', 'OPEN']),
    openCapacity: z.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endTime <= data.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be after startTime',
      });
    }
    if (data.bookingType === 'OPEN') {
      if (data.openCapacity === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['openCapacity'],
          message: 'openCapacity is required for OPEN slots',
        });
      } else if (data.openCapacity < data.capacity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['openCapacity'],
          message: 'openCapacity must be >= capacity',
        });
      }
    }
  });

export const UpdateAvailabilitySlotBodySchema = z.object({
  capacity: z.number().int().min(1).optional(),
  openCapacity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const AdminListSlotsQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(DATE_RE).optional(),
  dateFrom: z.string().regex(DATE_RE).optional(),
  dateTo: z.string().regex(DATE_RE).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PatientAvailabilityQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(DATE_RE).optional(),
});

export type CreateAvailabilitySlotBody = z.infer<typeof CreateAvailabilitySlotBodySchema>;
export type UpdateAvailabilitySlotBody = z.infer<typeof UpdateAvailabilitySlotBodySchema>;
export type AdminListSlotsQuery = z.infer<typeof AdminListSlotsQuerySchema>;
export type PatientAvailabilityQuery = z.infer<typeof PatientAvailabilityQuerySchema>;

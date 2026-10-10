import { z } from 'zod';

export const CreateVaccineServiceBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(1),
  eligibilityNotes: z.string().optional(),
  doseNumber: z.string().max(50).optional(),
});

export const UpdateVaccineServiceBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(1).optional(),
  eligibilityNotes: z.string().optional(),
  doseNumber: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
});

export type CreateVaccineServiceBody = z.infer<typeof CreateVaccineServiceBodySchema>;
export type UpdateVaccineServiceBody = z.infer<typeof UpdateVaccineServiceBodySchema>;

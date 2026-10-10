import { z } from 'zod';

export const RegisterBodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  facilitySlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'facilitySlug must only contain lowercase letters, numbers, and hyphens')
    .max(100),
});

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  facilitySlug: z.string().optional(),
});

export const ForgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const VerifyEmailBodySchema = z.object({
  token: z.string().min(1),
});

export const ResendVerificationBodySchema = z.object({
  email: z.string().email(),
});

export const SuperAdminLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type SuperAdminLoginBody = z.infer<typeof SuperAdminLoginBodySchema>;
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;
export type VerifyEmailBody = z.infer<typeof VerifyEmailBodySchema>;
export type ResendVerificationBody = z.infer<typeof ResendVerificationBodySchema>;

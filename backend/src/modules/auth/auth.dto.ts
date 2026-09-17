import { z } from "zod";

export const RegisterDto = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
              .regex(/[A-Z]/, "Must contain uppercase")
              .regex(/[0-9]/, "Must contain a number"),
  fullName: z.string().min(2, "Full name required").max(160),
  phone:    z.string().optional(),
});

export const LoginDto = z.object({
  email:    z.string().email(),
  password: z.string().min(1, "Password required"),
});

export const ForgotPasswordDto = z.object({
  email: z.string().email(),
});

export const ResetPasswordDto = z.object({
  token:    z.string().min(1),
  password: z.string().min(8)
              .regex(/[A-Z]/, "Must contain uppercase")
              .regex(/[0-9]/, "Must contain a number"),
});

export const VerifyEmailDto = z.object({
  token: z.string().min(1),
});

export type RegisterDtoType       = z.infer<typeof RegisterDto>;
export type LoginDtoType           = z.infer<typeof LoginDto>;
export type ForgotPasswordDtoType  = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType   = z.infer<typeof ResetPasswordDto>;
export type VerifyEmailDtoType     = z.infer<typeof VerifyEmailDto>;

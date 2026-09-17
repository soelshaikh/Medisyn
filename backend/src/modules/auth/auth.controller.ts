import type { Request, Response } from "express";
import { asyncHandler } from "@/common/utils/asyncHandler";
import { sendSuccess } from "@/common/utils/response";
import { AppError } from "@/common/middleware/error.middleware";
import * as authService from "./auth.service";
import {
  RegisterDto, LoginDto,
  ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto,
} from "./auth.dto";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth/refresh",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const dto = RegisterDto.parse(req.body);
  const result = await authService.register(dto);
  sendSuccess(res, { user: result.user }, "Registration successful — check your email to verify your account", 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const dto = LoginDto.parse(req.body);
  const result = await authService.login(dto);
  res.cookie("medisyn_refresh", result.refreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, "Login successful");
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.medisyn_refresh as string | undefined;
  if (!token) throw new AppError("Refresh token required", 401);
  const result = await authService.refresh(token);
  res.cookie("medisyn_refresh", result.refreshToken, REFRESH_COOKIE_OPTIONS);
  sendSuccess(res, { accessToken: result.accessToken }, "Token refreshed");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.medisyn_refresh as string | undefined;
  if (token) await authService.logout(token);
  res.clearCookie("medisyn_refresh", { path: "/api/v1/auth/refresh" });
  sendSuccess(res, null, "Logged out successfully");
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = VerifyEmailDto.parse(req.body);
  await authService.verifyEmail(token);
  sendSuccess(res, null, "Email verified successfully");
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = ForgotPasswordDto.parse(req.body);
  await authService.forgotPassword(email);
  sendSuccess(res, null, "If that email is registered, a reset link has been sent");
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const dto = ResetPasswordDto.parse(req.body);
  await authService.resetPassword(dto);
  sendSuccess(res, null, "Password reset successfully — you can now log in");
});

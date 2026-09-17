import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";
import type { AuthTokens, LoginRequest, RegisterRequest, User } from "@/types/auth";

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<{ user: User; accessToken: string } & AuthTokens>>(
      "/auth/login",
      data,
    ),

  register: (data: RegisterRequest) =>
    apiClient.post<ApiResponse<{ user: User }>>("/auth/register", data),

  logout: () => apiClient.post<ApiResponse<null>>("/auth/logout"),

  refresh: () =>
    apiClient.post<ApiResponse<AuthTokens>>("/auth/refresh"),

  verifyEmail: (token: string) =>
    apiClient.post<ApiResponse<null>>("/auth/verify-email", { token }),

  forgotPassword: (email: string) =>
    apiClient.post<ApiResponse<null>>("/auth/forgot-password", { email }),

  resetPassword: (data: { token: string; password: string }) =>
    apiClient.post<ApiResponse<null>>("/auth/reset-password", data),

  getMe: () =>
    apiClient.get<ApiResponse<User>>("/users/me"),
};

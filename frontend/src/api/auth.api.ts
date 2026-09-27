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

  registerClinic: (data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    clinicName: string;
    clinicAddress: string;
    licenseNumber?: string;
  }) =>
    apiClient.post<ApiResponse<{ user: User }>>("/auth/register", {
      email:    data.email,
      password: data.password,
      fullName: data.fullName,
      phone:    data.phone || undefined,
      role:     "clinic",
    }),

  registerPartner: (data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    pharmacyName: string;
    pharmacyAddress: string;
    licenseNumber?: string;
  }) =>
    apiClient.post<ApiResponse<{ user: User }>>("/auth/register", {
      email:    data.email,
      password: data.password,
      fullName: data.fullName,
      phone:    data.phone || undefined,
      role:     "pharmacy_partner",
    }),

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

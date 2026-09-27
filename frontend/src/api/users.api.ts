import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";
import type { User } from "@/types/auth";

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
}

export const usersApi = {
  getMe: () =>
    apiClient.get<ApiResponse<User>>("/users/me").then((r) => r.data.data),

  updateMe: (dto: UpdateProfileDto) =>
    apiClient.patch<ApiResponse<User>>("/users/me", dto).then((r) => r.data.data),
};

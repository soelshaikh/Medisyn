import apiClient from "@/lib/apiClient";
import type { AdminUser, ListResponse } from "@/types/admin";

const BASE = "/users";

export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AdminUser> }>(BASE, { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AdminUser }>(`${BASE}/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<{ data: AdminUser }>(`${BASE}/${id}/status`, { status }).then((r) => r.data.data),

  updateRoles: (id: string, roleIds: string[]) =>
    apiClient.patch<{ data: AdminUser }>(`${BASE}/${id}/roles`, { roleIds }).then((r) => r.data.data),
};

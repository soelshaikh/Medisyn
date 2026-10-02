import apiClient from "@/lib/apiClient";
import type { AdminUser } from "@/types/admin";

const BASE = "/users";

interface UserListResponse {
  data:  AdminUser[];
  total: number;
  page:  number;
  limit: number;
}

export interface UserSearchResult {
  _id:      string;
  uhid:     string | null;
  fullName: string;
  email:    string;
  phone:    string | null;
}

export const usersApi = {
  search: (q: string) =>
    apiClient
      .get<{ data: UserSearchResult[] }>(`${BASE}/search`, { params: { q } })
      .then((r) => r.data.data),

  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AdminUser[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(BASE, { params })
      .then((r): UserListResponse => ({
        data:  r.data.data,
        total: r.data.meta.total,
        page:  r.data.meta.page,
        limit: r.data.meta.limit,
      })),

  getById: (id: string) =>
    apiClient.get<{ data: AdminUser }>(`${BASE}/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<{ data: AdminUser }>(`${BASE}/${id}/status`, { status }).then((r) => r.data.data),

  updateRoles: (id: string, roleIds: string[]) =>
    apiClient.patch<{ data: AdminUser }>(`${BASE}/${id}/roles`, { roleIds }).then((r) => r.data.data),
};

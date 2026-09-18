import apiClient from "@/lib/apiClient";
import type { AdminRole } from "@/types/admin";

const BASE = "/admin/roles";

export const rolesApi = {
  list: () =>
    apiClient.get<{ data: AdminRole[] }>(BASE).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AdminRole }>(`${BASE}/${id}`).then((r) => r.data.data),

  create: (data: { name: string; slug: string; description?: string }) =>
    apiClient.post<{ data: AdminRole }>(BASE, data).then((r) => r.data.data),

  update: (id: string, data: { name?: string; description?: string }) =>
    apiClient.patch<{ data: AdminRole }>(`${BASE}/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    apiClient.delete(`${BASE}/${id}`).then((r) => r.data),

  setPermissions: (id: string, permissions: string[]) =>
    apiClient.put<{ data: AdminRole }>(`${BASE}/${id}/permissions`, { permissions }).then((r) => r.data.data),

  listPermissions: () =>
    apiClient.get<{ data: Array<{ key: string; group: string; description: string }> }>("/admin/permissions")
      .then((r) => r.data.data),
};

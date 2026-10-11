import apiClient from "@/lib/apiClient";
import type { AdminAskPharmacist, ListResponse } from "@/types/admin";

export const askPharmacistApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AdminAskPharmacist[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/ask-pharmacist",
        { params },
      )
      .then((r): ListResponse<AdminAskPharmacist> => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      })),

  getById: (id: string) =>
    apiClient.get<{ data: AdminAskPharmacist }>(`/admin/ask-pharmacist/${id}`).then((r) => r.data.data),

  respond: (id: string, responseText: string) =>
    apiClient.post(`/admin/ask-pharmacist/${id}/messages`, { body: responseText }).then((r) => r.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`/admin/ask-pharmacist/${id}/status`, { status, note }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.patch(`/admin/ask-pharmacist/${id}/notes`, { note }).then((r) => r.data),
};

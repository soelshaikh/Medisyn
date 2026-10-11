import apiClient from "@/lib/apiClient";
import type { AdminCompoundingRequest, ListResponse } from "@/types/admin";

export const compoundingApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AdminCompoundingRequest[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/compounding",
        { params },
      )
      .then((r): ListResponse<AdminCompoundingRequest> => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      })),

  getById: (id: string) =>
    apiClient.get<{ data: AdminCompoundingRequest }>(`/admin/compounding/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string, quoteAmount?: number | null, quoteNote?: string) =>
    apiClient.patch(`/admin/compounding/${id}/status`, { status, note, quoteAmount, quoteNote }).then((r) => r.data),

  // no standalone notes endpoint — status patch includes note field
  addNote: (id: string, note: string) =>
    apiClient.patch(`/admin/compounding/${id}/status`, { note }).then((r) => r.data),
};

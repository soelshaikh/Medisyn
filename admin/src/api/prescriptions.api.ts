import apiClient from "@/lib/apiClient";
import type { AdminPrescription, ListResponse } from "@/types/admin";

export const prescriptionsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AdminPrescription[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/prescriptions",
        { params },
      )
      .then((r): ListResponse<AdminPrescription> => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      })),

  getById: (id: string) =>
    apiClient.get<{ data: AdminPrescription }>(`/admin/prescriptions/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`/admin/prescriptions/${id}/status`, { status, note }).then((r) => r.data),

  // no notes-only endpoint on prescriptions backend — status update includes note field
  addNote: (id: string, note: string) =>
    apiClient.patch(`/admin/prescriptions/${id}/status`, { note }).then((r) => r.data),
};

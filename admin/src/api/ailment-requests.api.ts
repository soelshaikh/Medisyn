import apiClient from "@/lib/apiClient";
import type { AdminAilmentRequest, ListResponse } from "@/types/admin";

const BASE = "/ailment-requests";

export const ailmentRequestsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: ListResponse<AdminAilmentRequest> }>(`${BASE}/admin`, { params })
      .then((r) => r.data.data),

  getById: (id: string) =>
    apiClient
      .get<{ data: AdminAilmentRequest }>(`${BASE}/admin/${id}`)
      .then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`${BASE}/admin/${id}/status`, { status, note }).then((r) => r.data),

  respond: (id: string, responseText: string) =>
    apiClient.post(`${BASE}/admin/${id}/respond`, { responseText }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${BASE}/admin/${id}/notes`, { note }).then((r) => r.data),
};

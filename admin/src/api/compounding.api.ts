import apiClient from "@/lib/apiClient";
import type { AdminCompoundingRequest, ListResponse } from "@/types/admin";

const BASE = "/compounding";

export const compoundingApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AdminCompoundingRequest> }>(`${BASE}/admin`, { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AdminCompoundingRequest }>(`${BASE}/admin/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string, quoteAmount?: number | null, quoteNote?: string) =>
    apiClient.patch(`${BASE}/admin/${id}/status`, { status, note, quoteAmount, quoteNote }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${BASE}/admin/${id}/notes`, { note }).then((r) => r.data),
};

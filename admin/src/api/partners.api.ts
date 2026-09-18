import apiClient from "@/lib/apiClient";
import type { PartnerUser, ListResponse } from "@/types/admin";

const BASE = "/admin/partners";

export const partnersApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<PartnerUser> }>(BASE, { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: PartnerUser }>(`${BASE}/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${BASE}/${id}/notes`, { note }).then((r) => r.data),
};

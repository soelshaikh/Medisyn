import apiClient from "@/lib/apiClient";
import type { AdminOrder, ListResponse } from "@/types/admin";

const BASE = "/orders";

export const ordersApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AdminOrder> }>(`${BASE}/admin`, { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AdminOrder }>(`${BASE}/admin/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`${BASE}/admin/${id}/status`, { status, note }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${BASE}/admin/${id}/notes`, { note }).then((r) => r.data),
};

import apiClient from "@/lib/apiClient";
import type { AdminPrescription, ListResponse } from "@/types/admin";

const BASE = "/prescriptions";

export const prescriptionsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AdminPrescription> }>(`${BASE}/admin`, { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AdminPrescription }>(`${BASE}/admin/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`${BASE}/admin/${id}/status`, { status, note }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${BASE}/admin/${id}/notes`, { note }).then((r) => r.data),
};

import apiClient from "@/lib/apiClient";
import type { ClinicUser, ListResponse } from "@/types/admin";

const BASE = "/admin/clinics";

export const clinicsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<ClinicUser> }>(BASE, { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: ClinicUser }>(`${BASE}/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`${BASE}/${id}/status`, { status }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`${BASE}/${id}/notes`, { note }).then((r) => r.data),
};

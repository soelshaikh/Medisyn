import apiClient from "@/lib/apiClient";
import type { VaccineService, AppointmentSlot, AppointmentBooking, ListResponse } from "@/types/admin";

/* ── Vaccine Services ── */
export const vaccineServicesApi = {
  listAdmin: () =>
    apiClient.get<{ data: VaccineService[] }>("/vaccine-services/admin/all").then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: VaccineService }>("/vaccine-services", data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: VaccineService }>(`/vaccine-services/${id}`, data).then((r) => r.data.data),

  batchSortOrder: (items: { id: string; sortOrder: number }[]) =>
    apiClient.patch("/vaccine-services/admin/sort-order", { items }).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/vaccine-services/${id}`).then((r) => r.data),
};

/* ── Appointment Slots ── */
export const appointmentSlotsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AppointmentSlot> }>("/appointment-slots", { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AppointmentSlot }>(`/appointment-slots/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: AppointmentSlot }>("/appointment-slots", data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: AppointmentSlot }>(`/appointment-slots/${id}`, data).then((r) => r.data.data),
};

/* ── Bookings ── */
export const appointmentsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ data: ListResponse<AppointmentBooking> }>("/appointments/admin", { params }).then((r) => r.data.data),

  getById: (id: string) =>
    apiClient.get<{ data: AppointmentBooking }>(`/appointments/admin/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`/appointments/admin/${id}/status`, { status, note }).then((r) => r.data),

  setReply: (id: string, reply: string) =>
    apiClient.patch(`/appointments/admin/${id}/reply`, { reply }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.post(`/appointments/admin/${id}/notes`, { note }).then((r) => r.data),
};

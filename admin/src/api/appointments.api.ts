import apiClient from "@/lib/apiClient";
import type { VaccineService, AppointmentSlot, AppointmentBooking, ListResponse } from "@/types/admin";

/* ── Vaccine Services ── */
export const vaccineServicesApi = {
  listAdmin: () =>
    apiClient.get<{ data: VaccineService[] }>("/admin/vaccine-services").then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: VaccineService }>("/admin/vaccine-services", data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: VaccineService }>(`/admin/vaccine-services/${id}`, data).then((r) => r.data.data),

  // no backend route for sort-order or delete yet — will 404 at runtime
  batchSortOrder: (items: { id: string; sortOrder: number }[]) =>
    apiClient.patch("/admin/vaccine-services/sort-order", { items }).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/admin/vaccine-services/${id}`).then((r) => r.data),
};

/* ── Appointment Slots ── */
export const appointmentSlotsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AppointmentSlot[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/availability-slots",
        { params },
      )
      .then((r): ListResponse<AppointmentSlot> => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      })),

  // no GET /admin/availability-slots/:id on backend — pages should use list then filter
  getById: (id: string) =>
    apiClient.get<{ data: AppointmentSlot }>(`/admin/availability-slots/${id}`).then((r) => r.data.data),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: AppointmentSlot }>("/admin/availability-slots", data).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<{ data: AppointmentSlot }>(`/admin/availability-slots/${id}`, data).then((r) => r.data.data),
};

/* ── Bookings ── */
export const appointmentsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ data: AppointmentBooking[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/appointments",
        { params },
      )
      .then((r): ListResponse<AppointmentBooking> => ({
        data:  r.data.data,
        total: r.data.pagination.total,
        page:  r.data.pagination.page,
        limit: r.data.pagination.limit,
      })),

  getById: (id: string) =>
    apiClient.get<{ data: AppointmentBooking }>(`/admin/appointments/${id}`).then((r) => r.data.data),

  updateStatus: (id: string, status: string, note?: string) =>
    apiClient.patch(`/admin/appointments/${id}/status`, { status, note }).then((r) => r.data),

  // no /reply route on backend — use addNote
  setReply: (id: string, reply: string) =>
    apiClient.patch(`/admin/appointments/${id}/notes`, { note: reply }).then((r) => r.data),

  addNote: (id: string, note: string) =>
    apiClient.patch(`/admin/appointments/${id}/notes`, { note }).then((r) => r.data),
};

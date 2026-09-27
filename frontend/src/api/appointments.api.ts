import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface VaccineService {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  eligibilityNotes?: string;
  durationMinutes?: number;
  status: "active" | "inactive";
}

export interface AvailableSlot {
  _id: string;
  vaccineServiceId: string | VaccineService;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  capacityType: "strict" | "open";
  spotsLeft: number | null;
  isFullyBooked: boolean;
}

export interface AppointmentBooking {
  _id: string;
  slotId: string;
  vaccineServiceId: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  patientNotes?: string;
  adminReply?: string;
  slot?: AvailableSlot;
  vaccineService?: VaccineService;
  createdAt: string;
}

export interface BookingListData {
  docs: AppointmentBooking[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const appointmentsApi = {
  listServices: () =>
    apiClient
      .get<ApiResponse<VaccineService[]>>("/vaccine-services")
      .then((r) => r.data.data),

  getServiceBySlug: (slug: string) =>
    apiClient
      .get<ApiResponse<VaccineService>>(`/vaccine-services/by-slug/${slug}`)
      .then((r) => r.data.data),

  listAvailableSlots: (vaccineServiceId?: string) =>
    apiClient
      .get<ApiResponse<AvailableSlot[]>>("/appointment-slots/available", {
        params: vaccineServiceId ? { vaccineServiceId } : {},
      })
      .then((r) => r.data.data),

  listMyBookings: (page = 1, limit = 20) =>
    apiClient
      .get<ApiResponse<{ data: AppointmentBooking[]; total: number; page: number; limit: number }>>("/appointments/my", { params: { page, limit } })
      .then((r): BookingListData => {
        const d = r.data.data;
        return {
          docs: d.data ?? [],
          meta: { page: d.page ?? 1, limit: d.limit ?? limit, total: d.total ?? 0, totalPages: Math.ceil((d.total ?? 0) / (d.limit || limit)) },
        };
      }),

  book: (dto: { slotId: string; vaccineServiceId: string; patientNotes?: string }) =>
    apiClient
      .post<ApiResponse<AppointmentBooking>>("/appointments", dto)
      .then((r) => r.data.data),

  cancel: (id: string, reason?: string) =>
    apiClient
      .delete<ApiResponse<null>>(`/appointments/my/${id}`, { data: { reason } })
      .then((r) => r.data),

  submitInterest: (dto: {
    firstName: string; lastName?: string; email: string; phone: string;
    vaccineServiceName?: string; preferredDate?: string; preferredTime?: string;
    notes?: string; termsAccepted?: boolean;
  }) =>
    apiClient
      .post<ApiResponse<{ _id: string }>>("/appointment-interest", dto)
      .then((r) => r.data.data),
};

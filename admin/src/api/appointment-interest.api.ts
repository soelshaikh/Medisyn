import apiClient from "@/lib/apiClient";

export type InterestStatus = "new" | "contacted" | "resolved";

export interface AppointmentInterest {
  _id:                string;
  patientId?:         { _id: string; fullName: string; email: string } | null;
  firstName:          string;
  lastName:           string;
  email:              string;
  phone:              string;
  vaccineServiceName: string;
  preferredDate:      string;
  preferredTime:      string;
  notes:              string;
  termsAccepted:      boolean;
  status:             InterestStatus;
  createdAt:          string;
}

export interface InterestListData {
  data:  AppointmentInterest[];
  total: number;
  page:  number;
  limit: number;
}

export const appointmentInterestApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient
      .get<{ data: InterestListData }>("/appointment-interest/admin", { params })
      .then((r) => r.data.data),

  updateStatus: (id: string, status: InterestStatus, adminNote?: string) =>
    apiClient
      .patch(`/appointment-interest/admin/${id}/status`, { status, adminNote })
      .then((r) => r.data),
};

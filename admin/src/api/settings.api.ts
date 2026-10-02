import apiClient from "@/lib/apiClient";

export interface WorkingHours {
  day:       number; // 0=Sun … 6=Sat
  isOpen:    boolean;
  openTime:  string; // "HH:MM"
  closeTime: string; // "HH:MM"
}

export interface Holiday {
  _id:      string;
  date:     string; // "YYYY-MM-DD"
  name:     string;
  isClosed: boolean;
}

export interface PharmacySettings {
  _id:           string;
  pharmacyName:  string;
  phone:         string;
  email:         string;
  address:       string;
  city:          string;
  province:      string;
  postalCode:    string;
  licenseNumber: string;
  workingHours:  WorkingHours[];
  holidays:      Holiday[];
  emailVerificationRequired: boolean;
  updatedAt:     string;
}

export const settingsApi = {
  get: () =>
    apiClient
      .get<{ data: PharmacySettings }>("/settings")
      .then((r) => r.data.data),

  updateInfo: (data: Partial<Pick<PharmacySettings, "pharmacyName" | "phone" | "email" | "address" | "city" | "province" | "postalCode" | "licenseNumber">>) =>
    apiClient
      .patch<{ data: PharmacySettings }>("/settings/info", data)
      .then((r) => r.data.data),

  updateHours: (hours: WorkingHours[]) =>
    apiClient
      .put<{ data: PharmacySettings }>("/settings/hours", hours)
      .then((r) => r.data.data),

  addHoliday: (data: { date: string; name: string; isClosed: boolean }) =>
    apiClient
      .post<{ data: PharmacySettings }>("/settings/holidays", data)
      .then((r) => r.data.data),

  updateHoliday: (id: string, data: Partial<{ date: string; name: string; isClosed: boolean }>) =>
    apiClient
      .patch<{ data: PharmacySettings }>(`/settings/holidays/${id}`, data)
      .then((r) => r.data.data),

  deleteHoliday: (id: string) =>
    apiClient.delete(`/settings/holidays/${id}`).then((r) => r.data),

  updatePolicies: (data: { emailVerificationRequired?: boolean }) =>
    apiClient
      .patch<{ data: PharmacySettings }>("/settings/policies", data)
      .then((r) => r.data.data),
};

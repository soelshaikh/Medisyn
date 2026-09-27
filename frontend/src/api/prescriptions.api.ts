import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface PatientPrescription {
  _id: string;
  prescriptionNumber: string;
  prescriberName: string;
  prescriberPhone?: string;
  medicationName: string;
  dosage?: string;
  status: "active" | "expired" | "cancelled";
  refillsRemaining?: number;
  expiresAt?: string;
  notes?: string;
  createdAt: string;
}

export interface CreatePrescriptionDto {
  requestType?:          "standard" | "new_delivery" | "refill" | "transfer";
  prescriptionNumber?:   string;
  prescriberName?:       string;
  prescriberLicense?:    string;
  prescriberPhone?:      string;
  medicationName?:       string;
  dosage?:               string;
  refillsRemaining?:     number;
  expiresAt?:            string;
  notes?:                string;
  deliveryAddress?:      string;
  dateOfBirth?:          string;
  previousPharmacyName?: string;
  previousPharmacyPhone?: string;
  transferAll?:          boolean;
  rxNumbers?:            string[];
}

export interface PrescriptionsListData {
  docs: PatientPrescription[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface PrescriptionsRaw {
  data: PatientPrescription[];
  total: number;
  page: number;
  limit: number;
}

export const prescriptionsApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<ApiResponse<PrescriptionsRaw>>("/prescriptions/my", { params: { page, limit } })
      .then((r): PrescriptionsListData => {
        const d = r.data.data;
        return {
          docs: d.data ?? [],
          meta: { page: d.page ?? 1, limit: d.limit ?? limit, total: d.total ?? 0, totalPages: Math.ceil((d.total ?? 0) / (d.limit || limit)) },
        };
      }),

  create: (dto: CreatePrescriptionDto) =>
    apiClient
      .post<ApiResponse<PatientPrescription>>("/prescriptions", dto)
      .then((r) => r.data.data),
};

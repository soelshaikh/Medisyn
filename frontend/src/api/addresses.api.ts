import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface SavedAddress {
  _id:        string;
  label:      string;
  fullName:   string;
  phone:      string;
  address1:   string;
  address2:   string;
  city:       string;
  province:   string;
  postalCode: string;
  country:    string;
  isDefault:  boolean;
}

export interface AddressDto {
  label?:     string;
  fullName:   string;
  phone:      string;
  address1:   string;
  address2?:  string;
  city:       string;
  province:   string;
  postalCode: string;
  isDefault?: boolean;
}

const BASE = "/users/me/addresses";

export const addressesApi = {
  list: () =>
    apiClient.get<ApiResponse<SavedAddress[]>>(BASE).then((r) => r.data.data),

  add: (dto: AddressDto) =>
    apiClient.post<ApiResponse<SavedAddress[]>>(BASE, dto).then((r) => r.data.data),

  update: (id: string, dto: Partial<AddressDto>) =>
    apiClient.patch<ApiResponse<SavedAddress[]>>(`${BASE}/${id}`, dto).then((r) => r.data.data),

  remove: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`${BASE}/${id}`).then((r) => r.data),

  setDefault: (id: string) =>
    apiClient.patch<ApiResponse<SavedAddress[]>>(`${BASE}/${id}/default`).then((r) => r.data.data),
};

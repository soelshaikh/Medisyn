import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface AskPharmacistRequest {
  _id: string;
  topic?: string;
  subject: string;
  question: string;
  status: "open" | "answered" | "closed";
  responseText?: string;
  respondedAt?: string;
  fileUrl?: string;
  createdAt: string;
}

export interface CreateAskPharmacistDto {
  topic?: string;
  subject: string;
  question: string;
  fileUrl?: string;
}

export interface PharmacistTopic {
  _id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface AskListData {
  docs: AskPharmacistRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface AskRaw {
  data: AskPharmacistRequest[];
  total: number;
  page: number;
  limit: number;
}

export const askPharmacistApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<ApiResponse<AskRaw>>("/ask-pharmacist/my", { params: { page, limit } })
      .then((r): AskListData => {
        const d = r.data.data;
        return {
          docs: d.data ?? [],
          meta: { page: d.page ?? 1, limit: d.limit ?? limit, total: d.total ?? 0, totalPages: Math.ceil((d.total ?? 0) / (d.limit || limit)) },
        };
      }),

  create: (dto: CreateAskPharmacistDto) =>
    apiClient
      .post<ApiResponse<AskPharmacistRequest>>("/ask-pharmacist", dto)
      .then((r) => r.data.data),

  listTopics: () =>
    apiClient
      .get<ApiResponse<PharmacistTopic[]>>("/ask-pharmacist-topics")
      .then((r) => r.data.data),
};

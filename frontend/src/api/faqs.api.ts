import { apiClient } from "@/lib/apiClient";

export interface FAQItem {
  _id:         string;
  question:    string;
  answer:      string;
  category:    string;
  sortOrder:   number;
  isPublished: boolean;
}

export const faqsApi = {
  listPublic: (category?: string) =>
    apiClient
      .get<{ data: FAQItem[] }>("/faqs/public", { params: category ? { category } : {} })
      .then((r) => r.data.data),
};

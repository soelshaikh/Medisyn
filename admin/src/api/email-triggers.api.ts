import apiClient from "@/lib/apiClient";

export interface EmailTriggerConfig {
  _id:            string;
  module:         string;
  fromStatus:     string | null;
  toStatus:       string;
  enabled:        boolean;
  templateKey:    string;
  recipientTypes: string[];
  description:    string;
  updatedAt:      string;
}

export const emailTriggersApi = {
  list: (module?: string) =>
    apiClient
      .get<{ data: EmailTriggerConfig[] }>("/admin/email-triggers", { params: module ? { module } : {} })
      .then((r: { data: { data: EmailTriggerConfig[] } }) => r.data.data),

  update: (id: string, patch: { enabled?: boolean; recipientTypes?: string[] }) =>
    apiClient
      .patch<{ data: EmailTriggerConfig }>(`/admin/email-triggers/${id}`, patch)
      .then((r: { data: { data: EmailTriggerConfig } }) => r.data.data),
};

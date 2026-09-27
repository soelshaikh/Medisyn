import apiClient from "@/lib/apiClient";

export interface AdminNotification {
  _id:       string;
  type:      string;
  title:     string;
  message:   string;
  read:      boolean;
  readAt?:   string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<{ data: { data: AdminNotification[]; total: number } }>("/notifications", { params: { page, limit } })
      .then((r) => r.data.data),

  unreadCount: () =>
    apiClient
      .get<{ data: { count: number } }>("/notifications/unread-count")
      .then((r) => r.data.data.count),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.post("/notifications/read-all").then((r) => r.data),
};

import apiClient from "@/lib/apiClient";

export interface AdminNotification {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  read:      boolean;
  readAt?:   string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationsListResult {
  data:        AdminNotification[];
  total:       number;
  unreadCount: number;
}

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<{ success: true; data: { items: AdminNotification[]; unreadCount: number; pagination: { page: number; limit: number; total: number; totalPages: number } } }>(
        "/notifications",
        { params: { page, limit } },
      )
      .then((r): NotificationsListResult => ({
        data:        r.data.data.items,
        total:       r.data.data.pagination.total,
        unreadCount: r.data.data.unreadCount,
      })),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.post("/notifications/read-all").then((r) => r.data),
};

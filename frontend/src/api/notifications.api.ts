import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

export interface PatientNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationListData {
  docs: PatientNotification[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface NotificationsRaw {
  data: PatientNotification[];
  total: number;
  page: number;
  limit: number;
}

export const notificationsApi = {
  list: (page = 1, limit = 10) =>
    apiClient
      .get<ApiResponse<NotificationsRaw>>("/notifications", { params: { page, limit } })
      .then((r): NotificationListData => {
        const d = r.data.data;
        return {
          docs: d.data ?? [],
          meta: { page: d.page ?? 1, limit: d.limit ?? limit, total: d.total ?? 0, totalPages: Math.ceil((d.total ?? 0) / (d.limit || limit)) },
        };
      }),

  unreadCount: () =>
    apiClient
      .get<ApiResponse<{ count: number }>>("/notifications/unread-count")
      .then((r) => r.data.data.count),

  markRead: (id: string) =>
    apiClient.patch<ApiResponse<null>>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.post<ApiResponse<null>>("/notifications/read-all").then((r) => r.data),
};

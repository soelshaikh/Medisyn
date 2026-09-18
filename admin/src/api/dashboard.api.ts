import apiClient from "@/lib/apiClient";
import type { DashboardMetrics } from "@/types/admin";

export const dashboardApi = {
  metrics: () =>
    apiClient.get<{ data: DashboardMetrics }>("/admin/dashboard/metrics").then((r) => r.data.data),
};

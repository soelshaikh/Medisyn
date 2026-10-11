import apiClient from "@/lib/apiClient";
import type { DashboardMetrics } from "@/types/admin";

export const dashboardApi = {
  metrics: () =>
    apiClient.get<{ data: DashboardMetrics }>("/admin/reports/dashboard").then((r) => r.data.data),
};

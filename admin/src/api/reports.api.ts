import apiClient from "@/lib/apiClient";

export type ReportPreset = "today" | "yesterday" | "7d" | "30d" | "month";

export interface DateRange {
  preset?: ReportPreset;
  from?: string;
  to?: string;
}

export interface SalesReport {
  period:  { start: string; end: string };
  summary: {
    revenueCents:   number;
    revenueCAD:     string;
    orderCount:     number;
    aovCents:       number;
    aovCAD:         string;
    discountCents:  number;
    discountCAD:    string;
  };
  chart: Array<{ date: string; revenue: number; count: number }>;
}

export interface OrdersReport {
  period:      { start: string; end: string };
  byStatus:    Array<{ status: string; count: number }>;
  dailyChart:  Array<{ date: string; count: number }>;
  guestVsUser: Array<{ type: string; count: number }>;
}

export interface PatientsReport {
  period:         { start: string; end: string };
  allTimeTotal:   number;
  periodNewCount: number;
  activeCount:    number;
  dailyChart:     Array<{ date: string; count: number }>;
}

function toParams(range: DateRange): Record<string, string> {
  const params: Record<string, string> = {};
  if (range.preset) params.preset = range.preset;
  if (range.from)   params.from   = range.from;
  if (range.to)     params.to     = range.to;
  return params;
}

export const reportsApi = {
  sales:    (range: DateRange) =>
    apiClient.get<{ data: SalesReport }>("/admin/reports/sales", { params: toParams(range) }).then((r) => r.data.data),
  orders:   (range: DateRange) =>
    apiClient.get<{ data: OrdersReport }>("/admin/reports/orders", { params: toParams(range) }).then((r) => r.data.data),
  patients: (range: DateRange) =>
    apiClient.get<{ data: PatientsReport }>("/admin/reports/patients", { params: toParams(range) }).then((r) => r.data.data),
};

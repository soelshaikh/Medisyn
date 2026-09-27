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
  chart: Array<{ _id: string; revenue: number; count: number }>;
}

export interface OrdersReport {
  period:      { start: string; end: string };
  byStatus:    Array<{ _id: string; count: number }>;
  dailyChart:  Array<{ _id: string; count: number }>;
  guestVsUser: Array<{ _id: string; count: number }>;
}

export interface ProductsReport {
  period:       { start: string; end: string };
  topByQty:     Array<{ _id: string; name: string; qtySold: number; revenue: number }>;
  topByRevenue: Array<{ _id: string; name: string; qtySold: number; revenue: number }>;
}

export interface CustomersReport {
  period:         { start: string; end: string };
  allTimeTotal:   number;
  periodNewCount: number;
  activeCount:    number;
  dailyChart:     Array<{ _id: string; count: number }>;
}

export interface CouponsReport {
  period:     { start: string; end: string };
  withCoupon: Array<{ _id: string; count: number }>;
  topCoupons: Array<{ _id: string; usageCount: number; totalSavings: number }>;
  allCoupons: Array<{ _id: string; code: string; usageCount: number; usageLimit: number | null; discountType: string; discountValue: number }>;
}

function toParams(range: DateRange): Record<string, string> {
  const params: Record<string, string> = {};
  if (range.preset) params.preset = range.preset;
  if (range.from)   params.from   = range.from;
  if (range.to)     params.to     = range.to;
  return params;
}

export const reportsApi = {
  sales:     (range: DateRange) =>
    apiClient.get<{ data: SalesReport }>("/admin/reports/sales", { params: toParams(range) }).then((r) => r.data.data),
  orders:    (range: DateRange) =>
    apiClient.get<{ data: OrdersReport }>("/admin/reports/orders", { params: toParams(range) }).then((r) => r.data.data),
  products:  (range: DateRange) =>
    apiClient.get<{ data: ProductsReport }>("/admin/reports/products", { params: toParams(range) }).then((r) => r.data.data),
  customers: (range: DateRange) =>
    apiClient.get<{ data: CustomersReport }>("/admin/reports/customers", { params: toParams(range) }).then((r) => r.data.data),
  coupons:   (range: DateRange) =>
    apiClient.get<{ data: CouponsReport }>("/admin/reports/coupons", { params: toParams(range) }).then((r) => r.data.data),
};

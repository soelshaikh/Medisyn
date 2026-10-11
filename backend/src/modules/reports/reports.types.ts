export interface TrendBucket {
  bucket: string;
  revenue?: string;
  orderCount?: number;
  newPatients?: number;
}

export interface TopProduct {
  productId: string | null;
  productName: string;
  totalRevenue: string;
  unitsSold: number;
  orderCount: number;
}

export interface TopPatient {
  userId: string;
  firstName: string;
  lastName: string;
  orderCount: number;
  lifetimeSpend: string;
}

export interface SalesReportResult {
  period: string;
  from: string;
  to: string;
  summary: {
    totalRevenue: string;
    orderCount: number;
    averageOrderValue: string;
    revenueStatuses: string[];
  };
  trend: TrendBucket[];
  topProducts: TopProduct[];
}

export interface OrderReportResult {
  period: string;
  from: string;
  to: string;
  summary: {
    totalOrders: number;
    byStatus: {
      pending: number;
      confirmed: number;
      processing: number;
      ready: number;
      shipped: number;
      delivered: number;
      cancelled: number;
      refunded: number;
    };
    cancellationRate: number;
    averageFulfillmentHours: number | null;
  };
  trend: TrendBucket[];
}

export interface PatientReportResult {
  period: string;
  from: string;
  to: string;
  summary: {
    newPatientsInRange: number;
    totalActivePatients: number;
    retentionRate: number | null;
  };
  trend: TrendBucket[];
  topPatients: TopPatient[];
}

export interface DashboardResult {
  users:      { total: number; newToday: number };
  approvals:  { pendingClinics: number; pendingPartners: number };
  orders:     { total: number; today: number; pending: number; byStatus: Array<{ status: string; count: number }> };
  products:   { active: number; lowStock: number };
  revenue:    { totalCents: number; totalCAD: string };
  charts:     { dailyOrders: Array<{ date: string; count: number; revenue: number }> };
  healthcare: {
    pendingCompounding:  number;
    openAskPharmacist:   number;
    pendingAppointments: number;
    activePrescriptions: number;
  };
}

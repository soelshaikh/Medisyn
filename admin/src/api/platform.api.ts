import apiClient from "@/lib/apiClient";

export interface PlatformFacility {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deactivated";
  planId: string;
  planName: string;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFacilityDetail extends PlatformFacility {
  settings: Record<string, unknown>;
  planKey: string;
  prefix: string | null;
}

export interface PlatformPlan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface PlatformModule {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface PlatformPlanDetail extends PlatformPlan {
  modules: Array<{ id: string; key: string; name: string; description: string | null }>;
  facilityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStats {
  totalFacilities: number;
  activeFacilities: number;
  totalPatients: number;
  totalOrders: number;
  totalRevenueCad: string;
  totalSuperAdmins: number;
}

export interface PlatformSuperAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface FacilitySeatResource {
  resourceKey: string;
  roleName: string;
  planLimit: number;
  overrideLimit: number | null;
  effectiveLimit: number;
  currentUsage: number;
}

export interface FacilityStaffMember {
  healthProfessionalId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  joinedAt: string;
}

export const platformApi = {
  stats: () =>
    apiClient.get<{ data: PlatformStats }>("/admin/platform/stats").then((r) => r.data.data),

  plans: () =>
    apiClient.get<{ data: PlatformPlan[] }>("/admin/platform/plans").then((r) => r.data.data),

  listFacilities: (params: { page?: number; limit?: number; search?: string }) =>
    apiClient
      .get<{ data: PlatformFacility[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        "/admin/facilities",
        { params },
      )
      .then((r) => r.data),

  getFacility: (id: string) =>
    apiClient.get<{ data: PlatformFacilityDetail }>(`/admin/facilities/${id}`).then((r) => r.data.data),

  createFacility: (body: { name: string; slug: string; prefix: string; planId: string }) =>
    apiClient.post<{ data: { id: string } }>("/admin/facilities", body).then((r) => r.data.data),

  updateFacility: (id: string, body: { name?: string; status?: string; planId?: string }) =>
    apiClient.patch<{ data: unknown }>(`/admin/facilities/${id}`, body).then((r) => r.data.data),

  listSuperAdmins: () =>
    apiClient.get<{ data: PlatformSuperAdmin[] }>("/admin/platform/super-admins").then((r) => r.data.data),

  createSuperAdmin: (body: { email: string; password: string; firstName: string; lastName: string }) =>
    apiClient.post<{ data: { id: string } }>("/admin/platform/super-admins", body).then((r) => r.data.data),

  listModules: () =>
    apiClient.get<{ data: PlatformModule[] }>("/admin/platform/modules").then((r) => r.data.data),

  getPlan: (id: string) =>
    apiClient.get<{ data: PlatformPlanDetail }>(`/admin/platform/plans/${id}`).then((r) => r.data.data),

  createPlan: (body: { key: string; name: string; description?: string; moduleIds?: string[] }) =>
    apiClient.post<{ data: { id: string } }>("/admin/platform/plans", body).then((r) => r.data.data),

  updatePlan: (id: string, body: { name?: string; description?: string | null; isActive?: boolean }) =>
    apiClient.patch<{ data: unknown }>(`/admin/platform/plans/${id}`, body).then((r) => r.data.data),

  setPlanModules: (id: string, moduleIds: string[]) =>
    apiClient.put<{ data: unknown }>(`/admin/platform/plans/${id}/modules`, { moduleIds }).then((r) => r.data.data),

  getFacilitySeatConfig: (id: string) =>
    apiClient.get<{ data: FacilitySeatResource[] }>(`/admin/facilities/${id}/seat-config`).then((r) => r.data.data),

  setFacilitySeatOverride: (id: string, body: { resourceKey: string; limitValue: number }) =>
    apiClient.patch<{ data: unknown }>(`/admin/facilities/${id}/seat-config`, body).then((r) => r.data.data),

  listFacilityStaff: (id: string) =>
    apiClient.get<{ data: FacilityStaffMember[] }>(`/admin/facilities/${id}/staff`).then((r) => r.data.data),

  createFacilityStaff: (id: string, body: { email: string; password: string; firstName: string; lastName: string; roleName: string }) =>
    apiClient.post<{ data: { id: string } }>(`/admin/facilities/${id}/staff`, body).then((r) => r.data.data),
};

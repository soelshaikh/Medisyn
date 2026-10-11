"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { AdminSidebar } from "@/components/common/AdminSidebar";
import { AdminTopbar } from "@/components/common/AdminTopbar";
import { Spinner } from "@/components/ui/Spinner";

function NoFacilityBanner() {
  return (
    <div className="mx-6 mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-5 py-4">
      <AlertTriangle size={18} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
      <div className="text-[var(--font-size-sm)]">
        <p className="font-semibold text-[var(--color-text-primary)]">No facility selected</p>
        <p className="mt-0.5 text-[var(--color-text-secondary)]">
          You are logged in as platform super admin without a facility context. All data pages will return errors.{" "}
          <a
            href="/login?facility=YOUR_FACILITY_SLUG"
            className="underline text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            Sign in again with a facility slug
          </a>
          {" "}(e.g. <code className="bg-white px-1 rounded text-xs">?facility=test-pharmacy</code>).
        </p>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user } = useAdminAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace("/login");
  }, [_hasHydrated, isAuthenticated, router]);

  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Super admin logged in without a facility slug — decode JWT to check facilityId
  const isSuperAdminWithoutFacility = (() => {
    if (!user?.isSuperAdmin) return false;
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return false;
      const payload = JSON.parse(atob(token.split(".")[1]!));
      return !payload.facilityId;
    } catch { return false; }
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminTopbar />
        {isSuperAdminWithoutFacility && <NoFacilityBanner />}
        <main className="flex-1 overflow-y-auto p-[var(--space-6)]">
          {children}
        </main>
      </div>
    </div>
  );
}

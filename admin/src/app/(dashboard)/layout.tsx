"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { AdminSidebar } from "@/components/common/AdminSidebar";
import { AdminTopbar } from "@/components/common/AdminTopbar";
import { Spinner } from "@/components/ui/Spinner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated } = useAdminAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace("/login");
  }, [_hasHydrated, isAuthenticated, router]);

  // Wait for Zustand to rehydrate from localStorage before making any auth decision
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-[var(--space-6)]">
          {children}
        </main>
      </div>
    </div>
  );
}

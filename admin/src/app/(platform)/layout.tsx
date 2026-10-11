"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { PlatformSidebar } from "@/components/common/PlatformSidebar";
import { AdminTopbar } from "@/components/common/AdminTopbar";
import { Spinner } from "@/components/ui/Spinner";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user } = useAdminAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.replace("/login"); return; }
    if (!user?.isSuperAdmin) { router.replace("/dashboard"); }
  }, [_hasHydrated, isAuthenticated, user, router]);

  if (!_hasHydrated || !isAuthenticated || !user?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-surface)]">
      <PlatformSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-[var(--space-6)]">
          {children}
        </main>
      </div>
    </div>
  );
}

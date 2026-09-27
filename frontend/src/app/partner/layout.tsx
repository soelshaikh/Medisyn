"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Building2, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";

const NAV_ITEMS: PortalNavItem[] = [
  { href: "/partner",         label: "Dashboard",            icon: LayoutDashboard },
  { href: "/partner/profile", label: "Pharmacy Profile",     icon: Building2 },
  { href: "/contact",         label: "Contact MediSyn",      icon: Mail },
];

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
    } else if (user.role !== "pharmacy_partner") {
      router.replace("/login");
    }
  }, [isAuthenticated, user, router, _hasHydrated]);

  if (!_hasHydrated || !isAuthenticated || !user || user.role !== "pharmacy_partner") {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <PortalShell
      title="Pharmacy Partner Portal"
      navItems={NAV_ITEMS}
      userName={user.fullName}
      userSubtitle={user.email}
    >
      {children}
    </PortalShell>
  );
}

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LayoutDashboard, Building2, Mail } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";

const NAV_ITEMS: PortalNavItem[] = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/profile", label: "Pharmacy Profile", icon: Building2 },
  { href: "/contact", label: "Contact MediSyn", icon: Mail },
];

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "pharmacy_partner") redirect("/login");

  return (
    <PortalShell title="Pharmacy Partner Portal" navItems={NAV_ITEMS} userName={user.fullName} userSubtitle={user.email}>
      {children}
    </PortalShell>
  );
}

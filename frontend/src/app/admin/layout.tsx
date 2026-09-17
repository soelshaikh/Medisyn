import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Store,
  FileText,
  MessageCircleQuestion,
  CalendarHeart,
  Stethoscope,
  HelpCircle,
  ScrollText,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";

const NAV_ITEMS: PortalNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/clinics", label: "Clinics", icon: Building2 },
  { href: "/admin/pharmacy-partners", label: "Pharmacy Partners", icon: Store },
  { href: "/admin/prescriptions", label: "Prescriptions", icon: FileText },
  { href: "/admin/ask-a-pharmacist", label: "Ask a Pharmacist", icon: MessageCircleQuestion },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarHeart },
  { href: "/admin/minor-ailments", label: "Minor Ailments", icon: Stethoscope },
  { href: "/admin/faqs", label: "FAQ Management", icon: HelpCircle },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login");
  if (["suspended", "deactivated"].includes(user.status)) redirect("/login");

  return (
    <PortalShell
      title={`Admin Portal · ${user.adminRole?.replace("_", " ") ?? "staff"}`}
      navItems={NAV_ITEMS}
      userName={user.fullName}
      userSubtitle={user.email}
    >
      {children}
    </PortalShell>
  );
}

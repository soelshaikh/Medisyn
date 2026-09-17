import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LayoutDashboard, User, FileText, MessageCircleQuestion, CalendarHeart, Stethoscope } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";

const NAV_ITEMS: PortalNavItem[] = [
  { href: "/patient", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: FileText },
  { href: "/patient/ask-a-pharmacist", label: "Ask a Pharmacist", icon: MessageCircleQuestion },
  { href: "/patient/appointments", label: "Vaccines & Appointments", icon: CalendarHeart },
  { href: "/patient/minor-ailments", label: "Minor Ailments", icon: Stethoscope },
  { href: "/patient/profile", label: "My Profile", icon: User },
];

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "patient") redirect("/login");
  if (user.status !== "active") redirect("/login");

  return (
    <PortalShell title="Patient Portal" navItems={NAV_ITEMS} userName={user.fullName} userSubtitle={user.email}>
      {children}
    </PortalShell>
  );
}

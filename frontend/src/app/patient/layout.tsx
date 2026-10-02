"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, User, FileText, MessageCircleQuestion, CalendarHeart, Stethoscope, MapPin, ShoppingBag, Receipt, MessageCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";

const NAV_ITEMS: PortalNavItem[] = [
  { href: "/patient",                  label: "Dashboard",              icon: LayoutDashboard },
  { href: "/patient/prescriptions",    label: "Prescriptions",          icon: FileText },
  { href: "/patient/ask-a-pharmacist", label: "Ask a Pharmacist",       icon: MessageCircleQuestion },
  { href: "/patient/appointments",     label: "Vaccines & Appointments", icon: CalendarHeart },
  { href: "/patient/minor-ailments",   label: "Minor Ailments",         icon: Stethoscope },
  { href: "/patient/orders",           label: "My Orders",              icon: ShoppingBag },
  { href: "/patient/invoices",         label: "My Invoices",            icon: Receipt },
  { href: "/patient/messages",         label: "Messages",               icon: MessageCircle },
  { href: "/patient/addresses",        label: "My Addresses",           icon: MapPin },
  { href: "/patient/profile",          label: "My Profile",             icon: User },
];

export default function PatientLayout({ children }: { children: ReactNode }) {
  const router  = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
    } else if (user.role !== "patient") {
      router.replace("/login");
    }
  }, [isAuthenticated, user, router, _hasHydrated]);

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== "patient") {
    return null;
  }

  return (
    <PortalShell
      title="Patient Portal"
      navItems={NAV_ITEMS}
      userName={user.fullName}
      userSubtitle={user.email}
    >
      {children}
    </PortalShell>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Bookings",           href: "/appointments/bookings" },
  { label: "Availability Slots", href: "/appointments/slots" },
  { label: "Vaccine Services",   href: "/appointments/services" },
  { label: "Interest Requests",  href: "/appointments/interest" },
];

export default function AppointmentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Appointments</h1>
        <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-1">
          Manage vaccine appointment bookings, slots, and service catalog
        </p>
      </div>

      {/* Tab nav */}
      <div className="border-b border-[var(--color-border)]">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "pb-3 text-[var(--font-size-sm)] font-medium border-b-2 transition-colors",
                  active
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ShieldCheck, Key,
  ClipboardList, Package, ShoppingCart, Calendar,
  MessageSquare, Pill, BarChart3, FileText, Settings,
} from "lucide-react";
import { useAdminAuthStore } from "@/stores/adminAuthStore";

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/dashboard",         icon: LayoutDashboard,  permission: null },
  { label: "Users",           href: "/users",             icon: Users,            permission: "users.read" },
  { label: "Roles",           href: "/roles",             icon: ShieldCheck,      permission: "roles.read" },
  { label: "Permissions",     href: "/permissions",       icon: Key,              permission: "permissions.read" },
  { label: "Orders",          href: "/orders",            icon: ShoppingCart,     permission: "orders.read" },
  { label: "Products",        href: "/products",          icon: Package,          permission: "products.read" },
  { label: "Prescriptions",   href: "/prescriptions",     icon: ClipboardList,    permission: "prescriptions.read" },
  { label: "Compounding",     href: "/compounding",       icon: Pill,             permission: "compounding.read" },
  { label: "Ask Pharmacist",  href: "/ask-pharmacist",    icon: MessageSquare,    permission: "ask-pharmacist.read" },
  { label: "Appointments",    href: "/appointments",      icon: Calendar,         permission: "appointments.read" },
  { label: "Reports",         href: "/reports",           icon: BarChart3,        permission: "reports.read" },
  { label: "Audit Log",       href: "/audit",             icon: FileText,         permission: "audit.read" },
  { label: "Settings",        href: "/settings",          icon: Settings,         permission: "settings.read" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, hasPermission } = useAdminAuthStore();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission),
  );

  return (
    <aside
      className="w-[var(--sidebar-width)] bg-[var(--color-white)] border-r border-[var(--color-border)]
                 flex flex-col shrink-0 h-full overflow-y-auto"
    >
      {/* Logo */}
      <div className="px-[var(--space-6)] py-[var(--space-5)] border-b border-[var(--color-border)]">
        <span className="text-[var(--font-size-xl)] font-[var(--font-weight-bold)] text-[var(--color-primary)]">
          MediSyn
        </span>
        <span className="ml-2 text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-[var(--font-weight-medium)]">
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-[var(--space-3)] py-[var(--space-4)]">
        <ul className="flex flex-col gap-1">
          {visibleItems.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "flex items-center gap-3 px-[var(--space-3)] py-[var(--space-2)]",
                    "rounded-[var(--radius-md)] text-[var(--font-size-sm)] font-[var(--font-weight-medium)]",
                    "transition-colors duration-[var(--transition-fast)]",
                    active
                      ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      {user && (
        <div className="px-[var(--space-4)] py-[var(--space-4)] border-t border-[var(--color-border)]">
          <p className="text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--color-text-primary)] truncate">
            {user.fullName}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] truncate">
            {user.email}
          </p>
        </div>
      )}
    </aside>
  );
}

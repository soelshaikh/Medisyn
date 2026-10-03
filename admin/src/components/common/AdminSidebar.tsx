"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShieldCheck, ShoppingCart, Pill,
  BarChart3, FileText, Settings, Layers, Receipt,
  ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useAdminAuthStore } from "@/stores/adminAuthStore";

/* ── Feature flags — set to true to show a section, false to hide ── */
const NAV_FLAGS = {
  dashboard:      true,
  accessControl:  true,
  commerce:       true,
  inventory:      true,
  invoices:       true,
  healthcare:     true,
  reports:        true,
  auditLog:       true,
  settings:       true,
} as const;

/* ── Nav structure ── */
interface NavLeaf  { label: string; href: string; permission?: string | null; }
interface NavGroup { type: "group";  label: string; icon: React.ElementType; permission?: string | null; children: NavLeaf[]; }
interface NavLink  { type: "link";   label: string; href:  string; icon: React.ElementType; permission?: string | null; }
type NavItem = NavLink | NavGroup;

const NAV: NavItem[] = [
  ...(NAV_FLAGS.dashboard     ? [{ type: "link" as const, label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: null }] : []),
  ...(NAV_FLAGS.accessControl ? [{
    type: "group" as const, label: "Access Control", icon: ShieldCheck, permission: "roles.read",
    children: [
      { label: "Patients",      href: "/users/patients", permission: "users.read" },
      { label: "Staff Members", href: "/users/staff",    permission: "users.read" },
      { label: "Roles",         href: "/roles",          permission: "roles.read" },
      { label: "Permissions",   href: "/permissions",    permission: "permissions.read" },
    ],
  }] : []),
  ...(NAV_FLAGS.commerce ? [{
    type: "group" as const, label: "Commerce", icon: ShoppingCart, permission: "orders.read",
    children: [
      { label: "Orders",     href: "/orders",     permission: "orders.read" },
      { label: "Products",   href: "/products",   permission: "products.read" },
      { label: "Categories", href: "/categories", permission: "products.read" },
      { label: "Brands",     href: "/brands",     permission: "products.read" },
      { label: "Coupons",    href: "/coupons",    permission: "orders.read" },
    ],
  }] : []),
  ...(NAV_FLAGS.inventory ? [{
    type: "group" as const, label: "Inventory", icon: Layers, permission: "inventory.read",
    children: [
      { label: "Near Expiry",    href: "/inventory/near-expiry", permission: "inventory.read" },
      { label: "Movement Log",   href: "/inventory/movements",   permission: "inventory.movements.read" },
    ],
  }] : []),
  ...(NAV_FLAGS.invoices ? [{
    type: "group" as const, label: "Billing", icon: Receipt, permission: "invoices.read",
    children: [
      { label: "All Invoices",   href: "/invoices",          permission: "invoices.read" },
      { label: "New Adhoc",      href: "/invoices/new",      permission: "invoices.create" },
      { label: "Reports",        href: "/invoices/reports",  permission: "invoices.reports" },
    ],
  }] : []),
  ...(NAV_FLAGS.healthcare ? [{
    type: "group" as const, label: "Healthcare", icon: Pill, permission: "prescriptions.read",
    children: [
      { label: "Prescriptions",  href: "/prescriptions",         permission: "prescriptions.read" },
      { label: "Compounding",    href: "/compounding",           permission: "compounding.read" },
      { label: "Ask Pharmacist", href: "/ask-pharmacist",        permission: "ask-pharmacist.read" },
      { label: "AP Topics",      href: "/ask-pharmacist/topics", permission: "ask-pharmacist.topics.manage" },
      { label: "Appointments",   href: "/appointments",          permission: "appointments.read" },
      { label: "Ailment Catalog",   href: "/minor-ailments",          permission: "minor-ailments.catalog.read" },
      { label: "Ailment Requests",  href: "/minor-ailments/requests", permission: "minor-ailments.requests.read" },
      { label: "Clinics",        href: "/clinics",               permission: "users.read" },
      { label: "Partners",       href: "/partners",              permission: "users.read" },
    ],
  }] : []),
  ...(NAV_FLAGS.reports  ? [{ type: "link" as const, label: "Reports",   href: "/reports", icon: BarChart3, permission: "reports.read" }] : []),
  ...(NAV_FLAGS.auditLog ? [{ type: "link" as const, label: "Audit Log", href: "/audit",   icon: FileText,  permission: "audit.read"  }] : []),
  ...(NAV_FLAGS.settings ? [{
    type: "group" as const, label: "Settings", icon: Settings, permission: "settings.read",
    children: [
      { label: "Pharmacy Info & Hours", href: "/settings",                  permission: "settings.read" },
      { label: "Email Triggers",        href: "/settings/email-triggers",   permission: "email-triggers.read" },
      { label: "FAQs",                  href: "/faqs",                      permission: "content.faqs.read" },
    ],
  }] : []),
];

export function AdminSidebar() {
  const pathname        = usePathname();
  const { user, hasPermission } = useAdminAuthStore();

  /* ── collapsed state (persisted) ── */
  // Always start false to match SSR; read localStorage after mount to avoid hydration mismatch
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("admin-sidebar-collapsed") === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  }

  /* ── group open state ── */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV.forEach((item) => {
      if (item.type === "group" && item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
        init[item.label] = true;
      }
    });
    return init;
  });

  function toggleGroup(label: string) {
    if (collapsed) { setCollapsed(false); localStorage.setItem("admin-sidebar-collapsed", "false"); }
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function can(p?: string | null) { return p === null || p === undefined || hasPermission(p); }

  function isGroupActive(children: NavLeaf[]) {
    return children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-full bg-[var(--color-white)] border-r border-[var(--color-border)] overflow-hidden transition-all duration-200 ease-in-out"
      style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
    >
      {/* ── Logo + toggle ── */}
      <div className="flex items-center justify-between px-4 py-[var(--space-5)] border-b border-[var(--color-border)] shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="text-[var(--font-size-xl)] font-bold text-[var(--color-primary)] leading-none whitespace-nowrap">MediSyn</span>
            <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-medium whitespace-nowrap">ADMIN</span>
          </div>
        )}
        {collapsed && (
          <span className="text-[var(--font-size-xl)] font-bold text-[var(--color-primary)] mx-auto">M</span>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={[
            "shrink-0 p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)]",
            "hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors",
            collapsed ? "mx-auto" : "",
          ].join(" ")}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            if (!can(item.permission)) return null;

            /* ── Flat link ── */
            if (item.type === "link") {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon   = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={[
                      "flex items-center gap-3 rounded-[var(--radius-md)] transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                      active
                        ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-semibold"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]",
                    ].join(" ")}
                  >
                    <Icon size={17} className="shrink-0" />
                    {!collapsed && <span className="text-[var(--font-size-sm)] truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            }

            /* ── Group ── */
            const visibleChildren = item.children.filter((c) => can(c.permission));
            if (visibleChildren.length === 0) return null;

            const groupActive = isGroupActive(visibleChildren);
            const open        = !collapsed && (openGroups[item.label] ?? groupActive);
            const Icon        = item.icon;

            return (
              <li key={item.label}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(item.label)}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "w-full flex items-center rounded-[var(--radius-md)] transition-colors",
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                    groupActive && !open
                      ? "text-[var(--color-primary-dark)] font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-[var(--font-size-sm)] truncate">{item.label}</span>
                      <span className="text-[var(--color-text-muted)] shrink-0">
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </span>
                    </>
                  )}
                </button>

                {/* Children — tree-line style */}
                {open && (
                  <ul
                    className="mt-0.5 mb-1 ml-[22px] pl-3 flex flex-col gap-0.5"
                    style={{ borderLeft: "2px solid var(--color-border)" }}
                  >
                    {visibleChildren.map((child) => {
                      const active = pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={[
                              "flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] text-[var(--font-size-sm)] transition-colors",
                              active
                                ? "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] font-semibold"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]",
                            ].join(" ")}
                          >
                            {/* Connector dot */}
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                              style={{ background: active ? "var(--color-primary)" : "var(--color-border)" }}
                            />
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User ── */}
      {user && (
        <div className={["shrink-0 border-t border-[var(--color-border)]", collapsed ? "px-2 py-3 flex justify-center" : "px-4 py-3"].join(" ")}>
          {collapsed ? (
            <div
              title={`${user.fullName} (${user.email})`}
              className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[var(--font-size-sm)] cursor-default"
            >
              {user.fullName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <>
              <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] truncate">{user.fullName}</p>
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] truncate">{user.email}</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Shield, LayoutGrid, PanelLeftClose, PanelLeftOpen, ArrowLeft,
} from "lucide-react";
import { useAdminAuthStore } from "@/stores/adminAuthStore";

const NAV = [
  { label: "Platform Dashboard", href: "/platform/dashboard",    icon: LayoutDashboard },
  { label: "Facilities",         href: "/platform/facilities",   icon: Building2       },
  { label: "Plans",              href: "/platform/plans",        icon: LayoutGrid      },
  { label: "Super Admins",       href: "/platform/super-admins", icon: Shield          },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { user } = useAdminAuthStore();

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("platform-sidebar-collapsed") === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("platform-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <aside
      className="flex flex-col shrink-0 h-full bg-[var(--color-white)] border-r border-[var(--color-border)] overflow-hidden transition-all duration-200 ease-in-out"
      style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
    >
      {/* ── Logo + toggle ── */}
      <div className="flex items-center justify-between px-4 py-[var(--space-5)] border-b border-[var(--color-border)] shrink-0">
        {!collapsed && (
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="text-[var(--font-size-xl)] font-bold text-[var(--color-primary)] leading-none whitespace-nowrap">
              MediSyn
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-widest whitespace-nowrap mt-0.5">
              Platform Admin
            </span>
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
          })}
        </ul>

        {/* ── Switch to facility view ── */}
        {!collapsed && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="px-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide font-semibold mb-1">
              Facility view
            </p>
            <Link
              href="/login?facility="
              className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-[var(--font-size-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ArrowLeft size={15} className="shrink-0" />
              Sign in to a facility
            </Link>
          </div>
        )}
      </nav>

      {/* ── User ── */}
      {user && (
        <div className={["shrink-0 border-t border-[var(--color-border)]", collapsed ? "px-2 py-3 flex justify-center" : "px-4 py-3"].join(" ")}>
          {collapsed ? (
            <div
              title={`${user.fullName} (${user.email})`}
              className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-[var(--font-size-sm)] cursor-default"
            >
              {user.fullName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] bg-[var(--color-primary)] text-white px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
                  Super Admin
                </span>
              </div>
              <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] truncate">{user.fullName}</p>
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] truncate">{user.email}</p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

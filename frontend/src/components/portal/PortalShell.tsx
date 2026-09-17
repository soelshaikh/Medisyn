import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { logoutUser } from "@/actions/auth";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export default function PortalShell({
  title,
  navItems,
  userName,
  userSubtitle,
  children,
}: {
  title: string;
  navItems: PortalNavItem[];
  userName: string;
  userSubtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:px-6">
      <aside className="shrink-0 lg:w-64">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{title}</p>
            <p className="mt-1 truncate font-display text-base font-semibold text-ink-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">{userSubtitle}</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-800 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logoutUser} className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { dashboardApi } from "@/api/dashboard.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import {
  Users, ShoppingCart, Package, DollarSign,
  TrendingUp, AlertTriangle, Clock, CheckCircle,
  FlaskConical, MessageSquare, Calendar, FileText,
} from "lucide-react";

function StatCard({
  label, value, sub, icon: Icon, accent = false, href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={[
        "bg-white rounded-[var(--radius-lg)] border shadow-[var(--shadow-sm)] px-6 py-5",
        "flex items-start gap-4 transition-shadow",
        href ? "hover:shadow-[var(--shadow-md)] cursor-pointer" : "",
        accent ? "border-[var(--color-primary)]" : "border-[var(--color-border)]",
      ].join(" ")}
    >
      <div
        className={[
          "w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0",
          accent
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
        ].join(" ")}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</p>
        {sub && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const QUICK_LINKS = [
  { label: "New Order",       href: "/orders",          icon: ShoppingCart, color: "text-[var(--color-primary)]",  bg: "bg-[var(--color-primary-light)]" },
  { label: "Add Product",     href: "/products",        icon: Package,       color: "text-[var(--color-success)]",  bg: "bg-[var(--color-success-light)]" },
  { label: "Prescriptions",   href: "/prescriptions",   icon: FileText,      color: "text-[var(--color-info)]",     bg: "bg-[var(--color-info-light)]"    },
  { label: "Compounding",     href: "/compounding",     icon: FlaskConical,  color: "text-[var(--color-warning)]",  bg: "bg-[var(--color-warning-light)]" },
  { label: "Ask Pharmacist",  href: "/ask-pharmacist",  icon: MessageSquare, color: "text-[var(--color-primary)]",  bg: "bg-[var(--color-primary-light)]" },
  { label: "Appointments",    href: "/appointments",    icon: Calendar,      color: "text-[var(--color-success)]",  bg: "bg-[var(--color-success-light)]" },
  { label: "Users",           href: "/users",           icon: Users,         color: "text-[var(--color-info)]",     bg: "bg-[var(--color-info-light)]"    },
  { label: "Reports",         href: "/reports",         icon: TrendingUp,    color: "text-[var(--color-warning)]",  bg: "bg-[var(--color-warning-light)]" },
];

function QuickLinks() {
  return (
    <div>
      <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
        Quick Access
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {QUICK_LINKS.map((ql) => {
          const Icon = ql.icon;
          return (
            <Link
              key={ql.href}
              href={ql.href}
              className="flex flex-col items-center gap-2 bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-3 py-4 hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)] transition-all text-center group"
            >
              <div className={["w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center", ql.bg, ql.color].join(" ")}>
                <Icon size={16} />
              </div>
              <span className="text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors leading-tight">
                {ql.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MiniBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] w-28 shrink-0 capitalize">
        {label.replace(/_/g, " ")}
      </span>
      <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-primary)] w-6 text-right">
        {count}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: m, isLoading, isError } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn:  dashboardApi.metrics,
    refetchInterval: 60_000,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="Live overview — refreshes every 60 seconds" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5 h-24 animate-pulse">
              <div className="h-3 bg-[var(--color-surface)] rounded w-24 mb-3" />
              <div className="h-7 bg-[var(--color-surface)] rounded w-16" />
            </div>
          ))}
        </div>
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      </div>
    );
  }

  if (isError || !m) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="Live overview — refreshes every 60 seconds" />
        <div className="bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-[var(--radius-lg)] px-6 py-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[var(--color-error)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Could not load dashboard metrics</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] mt-0.5">Make sure the backend server is running and you are logged in with a valid admin account.</p>
          </div>
        </div>
        <QuickLinks />
      </div>
    );
  }

  const maxOrderStatus = Math.max(...(m.orders.byStatus?.map((s) => s.count) ?? [1]));
  const maxDailyOrders = Math.max(...(m.charts.dailyOrders?.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Live overview — refreshes every 60 seconds"
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={m.users.total.toLocaleString()}
          sub={`+${m.users.newToday} today`}
          icon={Users}
          href="/users"
        />
        <StatCard
          label="Total Orders"
          value={m.orders.total.toLocaleString()}
          sub={`${m.orders.today} today · ${m.orders.pending} pending`}
          icon={ShoppingCart}
          href="/orders"
        />
        <StatCard
          label="Active Products"
          value={m.products.active.toLocaleString()}
          sub={m.products.lowStock > 0 ? `${m.products.lowStock} low stock` : "All stocked"}
          icon={Package}
          href="/products"
        />
        <StatCard
          label="Total Revenue"
          value={`$${Number(m.revenue.totalCAD).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`}
          sub="CAD, all time (excl. cancelled)"
          icon={DollarSign}
          accent
        />
      </div>

      {/* Approvals banner */}
      {(m.approvals.pendingClinics > 0 || m.approvals.pendingPartners > 0) && (
        <div className="flex items-center gap-3 bg-[var(--color-warning-light)] border border-[var(--color-warning)] rounded-[var(--radius-lg)] px-5 py-4">
          <AlertTriangle size={18} className="text-[var(--color-warning)] shrink-0" />
          <div className="text-[var(--font-size-sm)]">
            <span className="font-semibold text-[var(--color-text-primary)]">Pending approvals: </span>
            <span className="text-[var(--color-text-secondary)]">
              {m.approvals.pendingClinics > 0 && (
                <Link href="/clinics?status=pending_approval" className="underline hover:text-[var(--color-primary)]">
                  {m.approvals.pendingClinics} clinic{m.approvals.pendingClinics !== 1 ? "s" : ""}
                </Link>
              )}
              {m.approvals.pendingClinics > 0 && m.approvals.pendingPartners > 0 && " · "}
              {m.approvals.pendingPartners > 0 && (
                <Link href="/partners?status=pending_approval" className="underline hover:text-[var(--color-primary)]">
                  {m.approvals.pendingPartners} partner{m.approvals.pendingPartners !== 1 ? "s" : ""}
                </Link>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by status */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle size={16} className="text-[var(--color-primary)]" />
            <h3 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">
              Orders by Status
            </h3>
          </div>
          <div className="space-y-3">
            {(m.orders.byStatus ?? []).map((s) => (
              <MiniBar key={s._id} label={s._id} count={s.count} max={maxOrderStatus} />
            ))}
            {(m.orders.byStatus ?? []).length === 0 && (
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No order data yet.</p>
            )}
          </div>
        </div>

        {/* Daily orders — last 7 days */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-[var(--color-primary)]" />
            <h3 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">
              Orders — Last 7 Days
            </h3>
          </div>
          {(m.charts.dailyOrders ?? []).length === 0 ? (
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No order data yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-28">
              {m.charts.dailyOrders.map((d) => {
                const barHeight = maxDailyOrders > 0 ? Math.round((d.count / maxDailyOrders) * 100) : 0;
                return (
                  <div key={d._id} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group relative">
                    <div
                      className="w-full bg-[var(--color-primary)] rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity"
                      style={{ height: `${Math.max(barHeight, 4)}%` }}
                    />
                    <span className="text-[10px] text-[var(--color-text-muted)] truncate w-full text-center">
                      {d._id.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Healthcare KPIs */}
      {m.healthcare && (
        <div>
          <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            Healthcare
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Pending Compounding"
              value={m.healthcare.pendingCompounding}
              sub="submitted or reviewing"
              icon={FlaskConical}
              href="/compounding?status=submitted"
            />
            <StatCard
              label="Open Ask Pharmacist"
              value={m.healthcare.openAskPharmacist}
              sub="awaiting response"
              icon={MessageSquare}
              href="/ask-pharmacist?status=open"
            />
            <StatCard
              label="Pending Appointments"
              value={m.healthcare.pendingAppointments}
              sub="pending or confirmed"
              icon={Calendar}
              href="/appointments/bookings?status=pending"
            />
            <StatCard
              label="Active Prescriptions"
              value={m.healthcare.activePrescriptions}
              sub="currently active"
              icon={FileText}
              href="/prescriptions"
            />
          </div>
        </div>
      )}

      {/* Quick access shortcuts */}
      <QuickLinks />

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5 flex items-center gap-4">
          <Clock size={18} className="text-[var(--color-warning)]" />
          <div>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] uppercase tracking-wide font-medium">Pending Orders</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{m.orders.pending}</p>
          </div>
        </div>
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5 flex items-center gap-4">
          <AlertTriangle size={18} className="text-[var(--color-error)]" />
          <div>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] uppercase tracking-wide font-medium">Low Stock Items</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{m.products.lowStock}</p>
          </div>
        </div>
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5 flex items-center gap-4">
          <Users size={18} className="text-[var(--color-success)]" />
          <div>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] uppercase tracking-wide font-medium">New Patients Today</p>
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{m.users.newToday}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Users, ShoppingCart, DollarSign, Shield, Plus } from "lucide-react";
import { platformApi } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

function StatCard({
  label, value, sub, icon: Icon, href,
}: { label: string; value: string | number; sub?: string; icon: React.ElementType; href?: string }) {
  const inner = (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5 flex items-start gap-4 hover:shadow-[var(--shadow-md)] transition-shadow">
      <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</p>
        {sub && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function PlatformDashboardPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["platform-stats"],
    queryFn:  platformApi.stats,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Platform Overview"
          description="Platform-wide metrics across all facilities"
        />
        <Button asChild>
          <Link href="/platform/facilities/new">
            <Plus size={15} className="mr-1.5" /> New Facility
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      )}

      {isError && (
        <div className="bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-[var(--radius-lg)] px-6 py-4 text-[var(--font-size-sm)] text-[var(--color-error)]">
          Could not load platform stats. Make sure the backend is running.
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard
              label="Total Facilities"
              value={stats.totalFacilities}
              sub={`${stats.activeFacilities} active`}
              icon={Building2}
              href="/platform/facilities"
            />
            <StatCard
              label="Total Patients"
              value={stats.totalPatients.toLocaleString()}
              sub="across all facilities"
              icon={Users}
            />
            <StatCard
              label="Total Orders"
              value={stats.totalOrders.toLocaleString()}
              sub="shipped or delivered"
              icon={ShoppingCart}
            />
            <StatCard
              label="Total Revenue"
              value={`$${Number(stats.totalRevenueCad).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`}
              sub="CAD, all time"
              icon={DollarSign}
            />
            <StatCard
              label="Super Admins"
              value={stats.totalSuperAdmins}
              sub="platform administrators"
              icon={Shield}
              href="/platform/super-admins"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/platform/facilities/new"
              className="flex items-center gap-4 bg-white rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] px-6 py-5 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors group"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] group-hover:bg-white text-[var(--color-primary)] flex items-center justify-center shrink-0">
                <Plus size={20} />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text-primary)] text-[var(--font-size-sm)]">Create a new facility</p>
                <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Onboard a new pharmacy or clinic</p>
              </div>
            </Link>

            <Link
              href="/platform/super-admins"
              className="flex items-center gap-4 bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5 hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <p className="font-semibold text-[var(--color-text-primary)] text-[var(--font-size-sm)]">Manage super admins</p>
                <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Add or view platform administrators</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

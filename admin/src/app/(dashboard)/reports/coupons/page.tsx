"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { reportsApi, type ReportPreset } from "@/api/reports.api";
import { Spinner } from "@/components/ui/Spinner";
import FilterPanel from "@/components/reports/FilterPanel";
import ExportBar from "@/components/reports/ExportBar";
import { ReportKpiCard, ReportHorizBar, ReportSection, ReportEmpty } from "@/components/reports/shared";
import { exportCouponsExcel, exportCouponsPdf } from "@/lib/exportReports";

const DEFAULT: ReportPreset = "7d";

export default function CouponsReportPage() {
  const [draft,   setDraft]   = useState<ReportPreset>(DEFAULT);
  const [applied, setApplied] = useState<ReportPreset>(DEFAULT);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report-coupons", applied],
    queryFn:  () => reportsApi.coupons({ preset: applied }),
  });

  const withCount    = data?.withCoupon.find((r) => r._id === "with_coupon")?.count ?? 0;
  const withoutCount = data?.withCoupon.find((r) => r._id === "no_coupon")?.count   ?? 0;
  const couponTotal  = withCount + withoutCount || 1;
  const maxUsage     = Math.max(...(data?.topCoupons.map((c) => c.usageCount) ?? [0]), 1);

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        <Link href="/reports" className="hover:text-[var(--color-primary)] transition-colors">Reports</Link>
        <ChevronRight size={11} />
        <span className="text-[var(--color-text-secondary)]">Coupons Report</span>
      </nav>

      <div className="border-l-4 border-[var(--color-error)] pl-3">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">Coupons Report</h1>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Coupon usage rate, top codes by redemptions, and all-time discount summary.
        </p>
      </div>

      <FilterPanel
        preset={draft}
        onPresetChange={setDraft}
        onApply={() => setApplied(draft)}
        onReset={() => { setDraft(DEFAULT); setApplied(DEFAULT); }}
      />

      {(isLoading || isFetching) && !data && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ReportKpiCard label="Orders with Coupon"    value={withCount.toLocaleString()}    sub={`${Math.round((withCount / couponTotal) * 100)}% of orders this period`}    accentColor="var(--color-error)" />
            <ReportKpiCard label="Orders without Coupon" value={withoutCount.toLocaleString()} sub={`${Math.round((withoutCount / couponTotal) * 100)}% of orders this period`} accentColor="var(--color-text-muted)" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ReportSection
              title="Top Coupons This Period"
              action={<ExportBar onExcel={() => exportCouponsExcel(data, applied)} onPdf={() => exportCouponsPdf(data, applied)} />}
            >
              {data.topCoupons.length === 0 ? <ReportEmpty /> : (
                <div className="space-y-2.5">
                  {data.topCoupons.map((c) => (
                    <ReportHorizBar key={c._id} label={c._id} count={c.usageCount} max={maxUsage} sub={`$${(c.totalSavings / 100).toFixed(2)} savings given`} />
                  ))}
                </div>
              )}
            </ReportSection>

            <ReportSection title="All Coupons">
              {data.allCoupons.length === 0 ? <ReportEmpty /> : (
                <div className="overflow-auto">
                  <table className="w-full text-[var(--font-size-xs)]">
                    <thead>
                      <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                        <th className="pb-1.5 pr-3 font-medium">Code</th>
                        <th className="pb-1.5 pr-3 font-medium">Type</th>
                        <th className="pb-1.5 pr-3 font-medium text-right">Value</th>
                        <th className="pb-1.5 font-medium text-right">Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {data.allCoupons.map((c) => (
                        <tr key={c._id} className="hover:bg-[var(--color-surface)]">
                          <td className="py-1.5 pr-3 font-mono font-semibold text-[var(--color-text-primary)]">{c.code}</td>
                          <td className="py-1.5 pr-3 text-[var(--color-text-secondary)] capitalize">{c.discountType.replace(/_/g, " ")}</td>
                          <td className="py-1.5 pr-3 text-right text-[var(--color-text-secondary)]">
                            {c.discountType === "percentage" ? `${c.discountValue}%` : `$${(c.discountValue / 100).toFixed(2)}`}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-[var(--color-text-primary)]">
                            {c.usageCount}
                            {c.usageLimit !== null && <span className="font-normal text-[var(--color-text-muted)]">/{c.usageLimit}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportSection>
          </div>
        </>
      )}
    </div>
  );
}

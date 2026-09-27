"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { reportsApi, type ReportPreset } from "@/api/reports.api";
import { Spinner } from "@/components/ui/Spinner";
import FilterPanel from "@/components/reports/FilterPanel";
import ExportBar from "@/components/reports/ExportBar";
import {
  ReportKpiCard, ReportBarChart, ReportHorizBar, ReportSection, ReportEmpty,
} from "@/components/reports/shared";
import { exportOrdersExcel, exportOrdersPdf } from "@/lib/exportReports";

const DEFAULT: ReportPreset = "7d";

export default function OrdersReportPage() {
  const [draft,   setDraft]   = useState<ReportPreset>(DEFAULT);
  const [applied, setApplied] = useState<ReportPreset>(DEFAULT);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report-orders", applied],
    queryFn:  () => reportsApi.orders({ preset: applied }),
  });

  const guestCount = data?.guestVsUser.find((g) => g._id === "guest")?.count ?? 0;
  const regCount   = data?.guestVsUser.find((g) => g._id === "registered")?.count ?? 0;
  const total      = guestCount + regCount || 1;
  const maxStatus  = Math.max(...(data?.byStatus.map((s) => s.count) ?? [0]), 1);

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        <Link href="/reports" className="hover:text-[var(--color-primary)] transition-colors">Reports</Link>
        <ChevronRight size={11} />
        <span className="text-[var(--color-text-secondary)]">Orders Report</span>
      </nav>

      <div className="border-l-4 border-[var(--color-info)] pl-3">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">Orders Report</h1>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Order volume by status, guest vs. registered breakdown, and daily trend.
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
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <ReportKpiCard label="Total Orders"       value={(guestCount + regCount).toLocaleString()} accentColor="var(--color-info)" />
            <ReportKpiCard label="Guest Orders"       value={guestCount.toLocaleString()} sub={`${Math.round((guestCount / total) * 100)}% of period total`} accentColor="var(--color-warning)" />
            <ReportKpiCard label="Registered Orders"  value={regCount.toLocaleString()}   sub={`${Math.round((regCount / total) * 100)}% of period total`}   accentColor="var(--color-success)" />
            <ReportKpiCard label="Status Categories"  value={data.byStatus.length}        sub="distinct order statuses" accentColor="var(--color-primary)" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ReportSection
              title="Orders by Status"
              action={<ExportBar onExcel={() => exportOrdersExcel(data, applied)} onPdf={() => exportOrdersPdf(data, applied)} />}
            >
              {data.byStatus.length === 0 ? <ReportEmpty /> : (
                <div className="space-y-2.5">
                  {data.byStatus.map((s) => (
                    <ReportHorizBar key={s._id} label={s._id.replace(/_/g, " ")} count={s.count} max={maxStatus} />
                  ))}
                </div>
              )}
            </ReportSection>

            <ReportSection title="Daily Orders">
              {data.dailyChart.length === 0 ? <ReportEmpty /> : <ReportBarChart rows={data.dailyChart} valueKey="count" color="var(--color-info)" />}
            </ReportSection>
          </div>
        </>
      )}
    </div>
  );
}

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
  ReportKpiCard, ReportBarChart, ReportSection, ReportEmpty,
} from "@/components/reports/shared";
import { exportSalesExcel, exportSalesPdf } from "@/lib/exportReports";

const DEFAULT: ReportPreset = "7d";

export default function SalesReportPage() {
  const [draft,   setDraft]   = useState<ReportPreset>(DEFAULT);
  const [applied, setApplied] = useState<ReportPreset>(DEFAULT);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report-sales", applied],
    queryFn:  () => reportsApi.sales({ preset: applied }),
  });

  const fmt = (cad: string) =>
    `$${Number(cad).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        <Link href="/reports" className="hover:text-[var(--color-primary)] transition-colors">Reports</Link>
        <ChevronRight size={11} />
        <span className="text-[var(--color-text-secondary)]">Sales Report</span>
      </nav>

      {/* Compact page title */}
      <div className="border-l-4 border-[var(--color-success)] pl-3">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">Sales Report</h1>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Revenue, average order value, discounts and daily sales breakdown.
        </p>
      </div>

      {/* Filter panel */}
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
            <ReportKpiCard label="Total Revenue"   value={fmt(data.summary.revenueCAD)}             sub="excl. cancelled orders"  accentColor="var(--color-success)" />
            <ReportKpiCard label="Total Orders"    value={data.summary.orderCount.toLocaleString()} accentColor="var(--color-info)" />
            <ReportKpiCard label="Avg Order Value" value={fmt(data.summary.aovCAD)}                 accentColor="var(--color-primary)" />
            <ReportKpiCard label="Total Discounts" value={fmt(data.summary.discountCAD)}            sub="from coupon codes"        accentColor="var(--color-warning)" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <ReportSection
              title="Daily Revenue"
              action={<ExportBar onExcel={() => exportSalesExcel(data, applied)} onPdf={() => exportSalesPdf(data, applied)} />}
            >
              {data.chart.length === 0 ? <ReportEmpty /> : <ReportBarChart rows={data.chart} valueKey="revenue" color="var(--color-success)" />}
            </ReportSection>

            <ReportSection title="Daily Orders">
              {data.chart.length === 0 ? <ReportEmpty /> : <ReportBarChart rows={data.chart} valueKey="count" color="var(--color-info)" />}
            </ReportSection>
          </div>
        </>
      )}
    </div>
  );
}

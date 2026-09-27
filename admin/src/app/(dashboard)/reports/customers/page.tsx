"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { reportsApi, type ReportPreset } from "@/api/reports.api";
import { Spinner } from "@/components/ui/Spinner";
import FilterPanel from "@/components/reports/FilterPanel";
import ExportBar from "@/components/reports/ExportBar";
import { ReportKpiCard, ReportBarChart, ReportSection, ReportEmpty } from "@/components/reports/shared";
import { exportCustomersExcel, exportCustomersPdf } from "@/lib/exportReports";

const DEFAULT: ReportPreset = "7d";

export default function CustomersReportPage() {
  const [draft,   setDraft]   = useState<ReportPreset>(DEFAULT);
  const [applied, setApplied] = useState<ReportPreset>(DEFAULT);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report-customers", applied],
    queryFn:  () => reportsApi.customers({ preset: applied }),
  });

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        <Link href="/reports" className="hover:text-[var(--color-primary)] transition-colors">Reports</Link>
        <ChevronRight size={11} />
        <span className="text-[var(--color-text-secondary)]">Customers Report</span>
      </nav>

      <div className="border-l-4 border-[var(--color-primary)] pl-3">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">Customers Report</h1>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Patient registrations, active buyers, and daily new patient acquisition trend.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ReportKpiCard label="All-Time Patients" value={data.allTimeTotal.toLocaleString()}    accentColor="var(--color-primary)" />
            <ReportKpiCard label="New This Period"   value={data.periodNewCount.toLocaleString()}  sub="registered patients"          accentColor="var(--color-success)" />
            <ReportKpiCard label="Active Buyers"     value={data.activeCount.toLocaleString()}     sub="placed an order this period"  accentColor="var(--color-warning)" />
          </div>

          <ReportSection
            title="New Patient Registrations — Daily"
            action={<ExportBar onExcel={() => exportCustomersExcel(data, applied)} onPdf={() => exportCustomersPdf(data, applied)} />}
          >
            {data.dailyChart.length === 0 ? <ReportEmpty /> : <ReportBarChart rows={data.dailyChart} valueKey="count" color="var(--color-success)" />}
          </ReportSection>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { reportsApi, type ReportPreset } from "@/api/reports.api";
import { Spinner } from "@/components/ui/Spinner";
import FilterPanel from "@/components/reports/FilterPanel";
import ExportBar from "@/components/reports/ExportBar";
import { ReportHorizBar, ReportSection, ReportEmpty } from "@/components/reports/shared";
import { exportProductsExcel, exportProductsPdf } from "@/lib/exportReports";

const DEFAULT: ReportPreset = "7d";

export default function ProductsReportPage() {
  const [draft,   setDraft]   = useState<ReportPreset>(DEFAULT);
  const [applied, setApplied] = useState<ReportPreset>(DEFAULT);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report-products", applied],
    queryFn:  () => reportsApi.products({ preset: applied }),
  });

  const maxQty = Math.max(...(data?.topByQty.map((p) => p.qtySold) ?? [0]), 1);
  const maxRev = Math.max(...(data?.topByRevenue.map((p) => p.revenue) ?? [0]), 1);

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
        <Link href="/reports" className="hover:text-[var(--color-primary)] transition-colors">Reports</Link>
        <ChevronRight size={11} />
        <span className="text-[var(--color-text-secondary)]">Products Report</span>
      </nav>

      <div className="border-l-4 border-[var(--color-warning)] pl-3">
        <h1 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">Products Report</h1>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Top products ranked by units sold and by revenue for the selected period.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ReportSection
            title="Top 10 — Units Sold"
            action={<ExportBar onExcel={() => exportProductsExcel(data, applied)} onPdf={() => exportProductsPdf(data, applied)} />}
          >
            {data.topByQty.length === 0 ? <ReportEmpty /> : (
              <div className="space-y-2.5">
                {data.topByQty.map((p) => (
                  <ReportHorizBar key={p._id} label={p.name} count={p.qtySold} max={maxQty} sub={`$${(p.revenue / 100).toFixed(2)} revenue`} />
                ))}
              </div>
            )}
          </ReportSection>

          <ReportSection title="Top 10 — Revenue">
            {data.topByRevenue.length === 0 ? <ReportEmpty /> : (
              <div className="space-y-2.5">
                {data.topByRevenue.map((p) => (
                  <ReportHorizBar key={p._id} label={p.name} count={p.qtySold} max={maxRev} sub={`$${(p.revenue / 100).toFixed(2)}`} />
                ))}
              </div>
            )}
          </ReportSection>
        </div>
      )}
    </div>
  );
}

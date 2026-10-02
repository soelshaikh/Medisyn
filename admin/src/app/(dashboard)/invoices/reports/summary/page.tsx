"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterPanel, FilterField } from "@/components/common/FilterPanel";
import { Spinner }    from "@/components/ui/Spinner";
import { Button }     from "@/components/ui/Button";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/DateRangePicker";
import { invoicesApi } from "@/api/invoices.api";

function cad(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

const EMPTY_RANGE: DateRangeValue = { from: "", to: "" };

export default function InvoiceSummaryReportPage() {
  const qc = useQueryClient();

  const [pending, setPending] = useState<DateRangeValue>(EMPTY_RANGE);
  const [applied, setApplied] = useState<DateRangeValue>(EMPTY_RANGE);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-summary", applied.from, applied.to],
    queryFn:  () => invoicesApi.summary({
      dateFrom: applied.from || undefined,
      dateTo:   applied.to   || undefined,
    }),
  });

  function applyFilters() { setApplied({ ...pending }); }
  function resetFilters()  { setPending(EMPTY_RANGE); setApplied(EMPTY_RANGE); }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Refund Report"
        description="Revenue, tax, discounts, payment status breakdown, and refund analysis"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["invoice-summary"] })}
            >
              Refresh
            </Button>
            <Link href="/invoices/reports">
              <Button size="sm" variant="outline"><ArrowLeft size={14} className="mr-1.5" />All Reports</Button>
            </Link>
          </div>
        }
      />

      <FilterPanel onApply={applyFilters} onReset={resetFilters} columns={3} title="Date Range Filter">
        <FilterField label="Date Range">
          <DateRangePicker
            value={pending}
            onChange={(v) => setPending(v)}
            placeholder="All time"
          />
        </FilterField>
      </FilterPanel>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* ── Billing summary ─────────────────────────────────────────── */}
          <SectionHeader icon={<BarChart3 size={16} />} title="Billing Summary" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Total Revenue"   value={cad(data.totalRevenue)}      sub="all issued invoices" />
            <KpiCard label="Total Collected" value={cad(data.totalPaid)}         sub="payments received" />
            <KpiCard label="Outstanding"     value={cad(data.totalDue)}          sub="amount still owed" color={data.totalDue > 0 ? "var(--color-error)" : undefined} />
            <KpiCard label="Tax Collected"   value={cad(data.totalTax)}          sub="GST/HST/PST" />
            <KpiCard label="Discounts"       value={cad(data.totalDiscount)}     sub="coupon + adjustments" />
            <KpiCard label="Total Invoices"  value={String(data.count)}          sub={`${data.ecommerceCount} order · ${data.adhocCount} adhoc`} />
          </div>

          {/* ── Payment status breakdown ─────────────────────────────────── */}
          <SectionHeader icon={<BarChart3 size={16} />} title="Payment Status" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Unpaid"       value={String(data.unpaidCount)}   sub="no payment received" color="var(--color-error)" />
            <KpiCard label="Partial Paid" value={String(data.partialCount)}  sub="partial payment" color="var(--color-warning)" />
            <KpiCard label="Paid"         value={String(data.paidCount)}     sub="fully collected" color="var(--color-success)" />
          </div>

          {/* ── Refund report ────────────────────────────────────────────── */}
          <SectionHeader icon={<RefreshCw size={16} />} title="Refund Report" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Total Refunded"   value={cad(data.refunds.totalRefunded)}        sub="completed refunds" color="var(--color-error)" />
            <KpiCard label="Pending Refunds"  value={String(data.refunds.pendingCount)}       sub={`${cad(data.refunds.pendingAmount)} awaiting processing`} color={data.refunds.pendingCount > 0 ? "var(--color-warning)" : undefined} />
            <KpiCard label="Completed"        value={String(data.refunds.completedCount)}     sub="processed successfully" color="var(--color-success)" />
            <KpiCard label="Failed"           value={String(data.refunds.failedCount)}        sub="could not be processed" />
            <KpiCard label="Cancelled"        value={String(data.refunds.cancelledCount)}     sub="refund voided" />
          </div>

          {/* ── Refunds by method ────────────────────────────────────────── */}
          <SectionHeader icon={<RefreshCw size={16} />} title="Refunds by Method" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Cash"       value={String(data.refunds.byMethod.cash)}       sub="refunds" />
            <KpiCard label="Card"       value={String(data.refunds.byMethod.card)}       sub="refunds" />
            <KpiCard label="E-Transfer" value={String(data.refunds.byMethod.eTransfer)}  sub="refunds" />
            <KpiCard label="Cheque"     value={String(data.refunds.byMethod.cheque)}     sub="refunds" />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <h2 className="text-[var(--font-size-sm)] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{title}</h2>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
          <p
            className="mt-1 text-[var(--font-size-2xl)] font-bold"
            style={{ color: color ?? "var(--color-text-primary)" }}
          >
            {value}
          </p>
          <p className="mt-0.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{sub}</p>
        </div>
        <BarChart3 size={20} className="text-[var(--color-border)]" />
      </div>
    </div>
  );
}

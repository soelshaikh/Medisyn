"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { PageHeader }    from "@/components/common/PageHeader";
import { FilterPanel, FilterField } from "@/components/common/FilterPanel";
import { DataGrid, type DataGridColumn, type SortState } from "@/components/common/DataGrid";
import { Pagination }    from "@/components/ui/Pagination";
import { Select }        from "@/components/ui/Select";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/DateRangePicker";
import { Button }        from "@/components/ui/Button";
import { invoicesApi }   from "@/api/invoices.api";
import type { AdminInvoice } from "@/types/admin";

const STATUS_OPTS = [
  { value: "",                 label: "All Statuses" },
  { value: "draft",            label: "Draft" },
  { value: "finalized",        label: "Finalized" },
  { value: "cancelled",        label: "Cancelled" },
  { value: "system_cancelled", label: "System Cancelled" },
];
const PAYMENT_STATUS_OPTS = [
  { value: "",              label: "All Payment Statuses" },
  { value: "unpaid",        label: "Unpaid" },
  { value: "partial_paid",  label: "Partially Paid" },
  { value: "paid",          label: "Paid" },
  { value: "overpaid",      label: "Overpaid" },
  { value: "cancelled",     label: "Cancelled" },
  { value: "system_cancelled", label: "System Cancelled" },
];
const TYPE_OPTS = [
  { value: "",          label: "All Types" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "adhoc",     label: "Adhoc" },
];

function cad(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

const PAGE_SIZE = 25;

interface Filters {
  type:          string;
  status:        string;
  paymentStatus: string;
  dateRange:     DateRangeValue;
}

const DEFAULT_FILTERS: Filters = { type: "", status: "", paymentStatus: "", dateRange: { from: "", to: "" } };

export default function InvoicesPage() {
  const qc = useQueryClient();

  const [pending,      setPending]      = useState<Filters>(DEFAULT_FILTERS);
  const [applied,      setApplied]      = useState<Filters>(DEFAULT_FILTERS);
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState("");
  const [sort,         setSort]         = useState<SortState>({ key: "issuedAt", dir: "desc" });
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(inv: AdminInvoice) {
    setDownloadingId(inv._id);
    try { await invoicesApi.downloadPdf(inv._id, `${inv.invoiceNumber}.pdf`); }
    finally { setDownloadingId(null); }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["invoices-admin", page, applied],
    queryFn: () => invoicesApi.list({
      page,
      limit:  PAGE_SIZE,
      ...(search                      ? { search }                              : {}),
      ...(applied.type                ? { type: applied.type }                  : {}),
      ...(applied.status              ? { status: applied.status }              : {}),
      ...(applied.paymentStatus       ? { paymentStatus: applied.paymentStatus } : {}),
      ...(applied.dateRange.from      ? { dateFrom: applied.dateRange.from }    : {}),
      ...(applied.dateRange.to        ? { dateTo:   applied.dateRange.to }      : {}),
    }),
  });

  const invoices: AdminInvoice[] = data?.data ?? [];
  const total      = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? Math.ceil(total / PAGE_SIZE);

  function applyFilters() { setApplied({ ...pending }); setPage(1); }
  function resetFilters()  { setPending(DEFAULT_FILTERS); setApplied(DEFAULT_FILTERS); setPage(1); }

  function handleExport() {
    const rows = [
      ["Invoice #", "Type", "Status", "Payment Status", "Customer", "Email", "Order #", "Total", "Paid", "Due", "Issued"],
      ...invoices.map((inv) => [
        inv.invoiceNumber, inv.type, inv.status, inv.paymentStatus,
        inv.customerName, inv.customerEmail,
        inv.orderNumber ?? "",
        cad(inv.total), cad(inv.amountPaid), cad(inv.amountDue),
        inv.issuedAt ? fmtDate(inv.issuedAt) : "",
      ]),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "invoices.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataGridColumn<AdminInvoice>[] = [
    {
      key: "invoiceNumber", header: "Invoice #", sortable: true,
      render: (inv) => (
        <Link
          href={`/invoices/${inv._id}`}
          className="font-mono font-semibold text-[var(--color-primary)] hover:underline"
        >
          {inv.invoiceNumber}
        </Link>
      ),
    },
    {
      key: "type", header: "Type", sortable: true,
      render: (inv) => (
        <span className={[
          "rounded-full px-2 py-0.5 text-[var(--font-size-xs)] font-semibold",
          inv.type === "ecommerce"
            ? "bg-[var(--color-info-light)] text-[var(--color-info)]"
            : "bg-[var(--color-warning-light)] text-[var(--color-warning)]",
        ].join(" ")}>
          {inv.type === "ecommerce" ? "Ecommerce" : "Adhoc"}
        </span>
      ),
    },
    {
      key: "customer", header: "Customer",
      render: (inv) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{inv.customerName}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{inv.customerEmail}</p>
        </div>
      ),
    },
    {
      key: "orderNumber", header: "Order",
      render: (inv) => inv.orderNumber
        ? <span className="font-mono text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{inv.orderNumber}</span>
        : <span className="text-[var(--color-text-muted)]">—</span>,
    },
    {
      key: "total", header: "Total", sortable: true, align: "right",
      render: (inv) => <span className="font-semibold text-[var(--color-text-primary)]">{cad(inv.total)}</span>,
    },
    {
      key: "status", header: "Status", sortable: true,
      render: (inv) => {
        const map: Record<string, [string, string]> = {
          draft:            ["bg-[var(--color-warning-light)]      text-[var(--color-warning)]",      "Draft"],
          finalized:        ["bg-[var(--color-success-light)]      text-[var(--color-success)]",      "Finalized"],
          cancelled:        ["bg-[var(--color-error-light)]        text-[var(--color-error)]",        "Cancelled"],
          system_cancelled: ["bg-[var(--color-surface)]            text-[var(--color-text-muted)]",   "Sys. Cancelled"],
        };
        const [cls, label] = map[inv.status] ?? ["bg-[var(--color-surface)] text-[var(--color-text-muted)]", inv.status];
        return <span className={`rounded-full px-2 py-0.5 text-[var(--font-size-xs)] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
      },
    },
    {
      key: "paymentStatus", header: "Payment", sortable: true,
      render: (inv) => {
        const map: Record<string, [string, string]> = {
          unpaid:           ["bg-[var(--color-error-light)]        text-[var(--color-error)]",        "Unpaid"],
          partial_paid:     ["bg-[var(--color-warning-light)]      text-[var(--color-warning)]",      "Partial"],
          paid:             ["bg-[var(--color-success-light)]      text-[var(--color-success)]",      "Paid"],
          overpaid:         ["bg-[var(--color-info-light)]         text-[var(--color-info)]",         "Overpaid"],
          cancelled:        ["bg-[var(--color-surface)]            text-[var(--color-text-muted)]",   "Cancelled"],
          system_cancelled: ["bg-[var(--color-surface)]            text-[var(--color-text-muted)]",   "Sys. Cancelled"],
        };
        const [cls, label] = map[inv.paymentStatus] ?? ["bg-[var(--color-surface)] text-[var(--color-text-muted)]", inv.paymentStatus];
        return <span className={`rounded-full px-2 py-0.5 text-[var(--font-size-xs)] font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
      },
    },
    {
      key: "amountDue", header: "Due", align: "right",
      render: (inv) => (
        <span className={inv.amountDue > 0 ? "font-semibold text-[var(--color-error)]" : "text-[var(--color-text-muted)]"}>
          {cad(inv.amountDue)}
        </span>
      ),
    },
    {
      key: "issuedAt", header: "Issued", sortable: true,
      render: (inv) => (
        <span className="whitespace-nowrap text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {inv.issuedAt ? fmtDate(inv.issuedAt) : "—"}
        </span>
      ),
    },
    {
      key: "pdf", header: "",
      render: (inv) => (
        <button
          type="button"
          disabled={downloadingId === inv._id}
          onClick={() => handleDownload(inv)}
          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline text-[var(--font-size-xs)] disabled:opacity-50 disabled:cursor-wait"
          title="Download PDF"
        >
          {downloadingId === inv._id
            ? <Loader2 size={13} className="animate-spin" />
            : <Download size={13} />}
          PDF
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description="Ecommerce and adhoc invoice management"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/invoices/reports">
              <Button size="sm" variant="outline">Reports</Button>
            </Link>
            <Link href="/invoices/new">
              <Button size="sm"><Plus size={14} className="mr-1.5" />New Adhoc Invoice</Button>
            </Link>
          </div>
        }
      />

      <FilterPanel onApply={applyFilters} onReset={resetFilters} columns={4}>
        <FilterField label="Issue Date">
          <DateRangePicker
            value={pending.dateRange}
            onChange={(v) => setPending((p) => ({ ...p, dateRange: v }))}
            placeholder="Any date"
          />
        </FilterField>

        <FilterField label="Type">
          <Select
            value={pending.type}
            onChange={(v) => setPending((p) => ({ ...p, type: v }))}
            options={TYPE_OPTS}
            placeholder="All Types"
          />
        </FilterField>

        <FilterField label="Status">
          <Select
            value={pending.status}
            onChange={(v) => setPending((p) => ({ ...p, status: v }))}
            options={STATUS_OPTS}
            placeholder="All Statuses"
          />
        </FilterField>

        <FilterField label="Payment Status">
          <Select
            value={pending.paymentStatus}
            onChange={(v) => setPending((p) => ({ ...p, paymentStatus: v }))}
            options={PAYMENT_STATUS_OPTS}
            placeholder="All Payment Statuses"
          />
        </FilterField>
      </FilterPanel>

      <DataGrid
        columns={columns}
        data={invoices}
        keyFn={(inv) => inv._id}
        loading={isLoading}
        emptyTitle="No invoices found"
        emptyDescription="No invoices match the current filters."
        emptyIcon={<FileText size={36} />}
        summary={total > 0 ? [{ label: "Total Invoices", value: String(total) }] : undefined}
        search={search}
        onSearch={(q) => { setSearch(q); setPage(1); }}
        searchPlaceholder="Invoice #, email, order #…"
        onExport={handleExport}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["invoices-admin"] })}
        sort={sort}
        onSort={(key, dir) => setSort({ key, dir })}
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

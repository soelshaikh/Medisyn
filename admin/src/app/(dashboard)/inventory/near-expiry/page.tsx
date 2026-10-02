"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader }    from "@/components/common/PageHeader";
import { FilterPanel, FilterField } from "@/components/common/FilterPanel";
import { DataGrid, type DataGridColumn } from "@/components/common/DataGrid";
import { Select }        from "@/components/ui/Select";
import { inventoryApi }  from "@/api/products.api";

const WINDOW_OPTIONS = [
  { value: "30",  label: "30 days" },
  { value: "60",  label: "60 days" },
  { value: "90",  label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
];

interface NearExpiryBatch {
  _id:             string;
  productId:       string;
  batchNumber:     string;
  expiryDate:      string;
  currentQty:      number;
  status:          string;
  supplier:        string | null;
  daysUntilExpiry: number;
  product:         { _id: string; name: string; sku: string };
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
function expiryBadge(days: number) {
  if (days <= 0)  return { label: "Expired",       cls: "bg-[var(--color-error-light)]   text-[var(--color-error)]"   };
  if (days <= 30) return { label: `${days}d left`,  cls: "bg-[var(--color-error-light)]   text-[var(--color-error)]"   };
  if (days <= 90) return { label: `${days}d left`,  cls: "bg-[var(--color-warning-light)] text-[var(--color-warning)]" };
  return            { label: `${days}d left`,  cls: "bg-[var(--color-info-light)]    text-[var(--color-info)]"    };
}

interface Filters { window: string; }

export default function NearExpiryPage() {
  const qc = useQueryClient();

  const [pending, setPending] = useState<Filters>({ window: "90" });
  const [applied, setApplied] = useState<Filters>({ window: "90" });
  const [search,  setSearch]  = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["near-expiry", applied.window],
    queryFn:  () => inventoryApi.nearExpiry(Number(applied.window)),
  });

  const batches: NearExpiryBatch[] = data ?? [];
  const filtered = batches.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.batchNumber.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      b.product?.sku?.toLowerCase().includes(q)
    );
  });

  function applyFilters() { setApplied({ ...pending }); }
  function resetFilters()  { const d: Filters = { window: "90" }; setPending(d); setApplied(d); }

  function handleExport() {
    const rows = [
      ["Product", "SKU", "Batch #", "Expiry", "Days Left", "Qty", "Supplier"],
      ...filtered.map((b) => {
        const days_ = Math.round(b.daysUntilExpiry ?? daysUntil(b.expiryDate));
        return [b.product?.name ?? "", b.product?.sku ?? "", b.batchNumber, fmtDate(b.expiryDate), String(days_), String(b.currentQty), b.supplier ?? ""];
      }),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "near-expiry.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataGridColumn<NearExpiryBatch>[] = [
    {
      key: "product", header: "Product", sortable: true,
      render: (b) => {
        const days_ = Math.round(b.daysUntilExpiry ?? daysUntil(b.expiryDate));
        return (
          <div className="flex items-center gap-2">
            {days_ <= 30 && <AlertTriangle size={13} className="shrink-0 text-[var(--color-error)]" />}
            {days_ > 30 && days_ <= 90 && <AlertTriangle size={13} className="shrink-0 text-[var(--color-warning)]" />}
            <span className="font-medium text-[var(--color-text-primary)]">{b.product?.name ?? "—"}</span>
          </div>
        );
      },
    },
    {
      key: "sku", header: "SKU",
      render: (b) => <span className="font-mono text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{b.product?.sku ?? "—"}</span>,
    },
    {
      key: "batchNumber", header: "Batch #", sortable: true,
      render: (b) => <span className="font-mono font-semibold text-[var(--color-text-primary)]">{b.batchNumber}</span>,
    },
    {
      key: "expiryDate", header: "Expiry", sortable: true,
      render: (b) => <span className="text-[var(--color-text-secondary)]">{fmtDate(b.expiryDate)}</span>,
    },
    {
      key: "daysLeft", header: "Days Left", sortable: true, align: "center",
      render: (b) => {
        const days_ = Math.round(b.daysUntilExpiry ?? daysUntil(b.expiryDate));
        const badge = expiryBadge(days_);
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-[var(--font-size-xs)] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "currentQty", header: "Qty", sortable: true, align: "right",
      render: (b) => <span className="font-semibold text-[var(--color-text-primary)]">{b.currentQty}</span>,
    },
    {
      key: "supplier", header: "Supplier",
      render: (b) => <span className="text-[var(--color-text-secondary)]">{b.supplier ?? <span className="text-[var(--color-text-muted)]">—</span>}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Near-Expiry Batches"
        description="Batches expiring within the selected window — prioritise these for fulfillment (FEFO)"
      />

      <FilterPanel onApply={applyFilters} onReset={resetFilters} columns={3}>
        <FilterField label="Expiry Window">
          <Select
            value={pending.window}
            onChange={(v) => setPending((p) => ({ ...p, window: v }))}
            options={WINDOW_OPTIONS}
            placeholder="Select window…"
          />
        </FilterField>
      </FilterPanel>

      <DataGrid
        columns={columns}
        data={filtered}
        keyFn={(b) => b._id}
        loading={isLoading}
        emptyTitle="No near-expiry batches"
        emptyDescription={`No active batches expiring within ${applied.window} days.`}
        summary={filtered.length > 0 ? [
          { label: "Total Records", value: String(filtered.length) },
        ] : undefined}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search batch or product…"
        onExport={handleExport}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["near-expiry"] })}
      />
    </div>
  );
}

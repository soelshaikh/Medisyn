"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { PageHeader }    from "@/components/common/PageHeader";
import { EmptyState }    from "@/components/common/EmptyState";
import { FilterPanel, FilterField } from "@/components/common/FilterPanel";
import { DataGrid, type DataGridColumn, type SortState } from "@/components/common/DataGrid";
import { Pagination }    from "@/components/ui/Pagination";
import { Select }        from "@/components/ui/Select";
import { inventoryApi }  from "@/api/products.api";
import type { InventoryMovement } from "@/types/admin";

const MOVEMENT_TYPE_OPTIONS = [
  { value: "",                  label: "All Types" },
  { value: "batch_received",    label: "Received" },
  { value: "order_fulfilled",   label: "Fulfilled" },
  { value: "order_cancelled",   label: "Cancelled" },
  { value: "manual_adjustment", label: "Adjustment" },
  { value: "batch_recalled",    label: "Recalled" },
  { value: "expired_writeoff",  label: "Writeoff" },
];

const TYPE_LABELS: Record<string, string> = {
  batch_received:    "Received",
  order_fulfilled:   "Fulfilled",
  order_cancelled:   "Cancelled",
  manual_adjustment: "Adjustment",
  batch_recalled:    "Recalled",
  expired_writeoff:  "Writeoff",
};

const TYPE_COLORS: Record<string, string> = {
  batch_received:    "bg-[var(--color-success-light)]  text-[var(--color-success)]",
  order_fulfilled:   "bg-[var(--color-error-light)]    text-[var(--color-error)]",
  order_cancelled:   "bg-[var(--color-info-light)]     text-[var(--color-info)]",
  manual_adjustment: "bg-[var(--color-warning-light)]  text-[var(--color-warning)]",
  batch_recalled:    "bg-[var(--color-error-light)]    text-[var(--color-error)]",
  expired_writeoff:  "bg-[var(--color-surface)]        text-[var(--color-text-muted)]",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const PAGE_LIMIT = 50;

/* Pending filter state — committed only on Apply */
interface Filters { movementType: string; }

export default function MovementsPage() {
  const qc = useQueryClient();

  /* Pending (form) state */
  const [pending, setPending] = useState<Filters>({ movementType: "" });
  /* Applied (query) state */
  const [applied, setApplied] = useState<Filters>({ movementType: "" });

  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<SortState>({ key: "createdAt", dir: "desc" });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-movements", page, applied.movementType],
    queryFn:  () => inventoryApi.allMovements({
      page,
      limit: PAGE_LIMIT,
      ...(applied.movementType ? { movementType: applied.movementType } : {}),
    }),
  });

  const movements: InventoryMovement[] = data?.data ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  /* Client-side search */
  const filtered = movements.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.batchNumber.toLowerCase().includes(q) ||
      (m.orderNumber ?? "").toLowerCase().includes(q) ||
      (m.notes ?? "").toLowerCase().includes(q)
    );
  });

  function applyFilters() {
    setApplied({ ...pending });
    setPage(1);
  }

  function resetFilters() {
    const empty: Filters = { movementType: "" };
    setPending(empty);
    setApplied(empty);
    setPage(1);
  }

  function handleSort(key: string, dir: "asc" | "desc") {
    setSort({ key, dir });
  }

  function handleExport() {
    /* CSV export — placeholder */
    const rows = [
      ["Type", "Batch #", "Qty", "Before", "After", "Order", "Notes", "Date"],
      ...filtered.map((m) => [
        TYPE_LABELS[m.movementType] ?? m.movementType,
        m.batchNumber,
        String(m.qty),
        String(m.qtyBefore),
        String(m.qtyAfter),
        m.orderNumber ?? "",
        m.notes ?? "",
        fmtDate(m.createdAt),
      ]),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "movements.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const columns: DataGridColumn<InventoryMovement>[] = [
    {
      key: "movementType", header: "Type", sortable: true,
      render: (m) => (
        <span className={`rounded-full px-2.5 py-0.5 text-[var(--font-size-xs)] font-semibold ${TYPE_COLORS[m.movementType] ?? ""}`}>
          {TYPE_LABELS[m.movementType] ?? m.movementType}
        </span>
      ),
    },
    {
      key: "batchNumber", header: "Batch #", sortable: true,
      render: (m) => <span className="font-mono font-semibold text-[var(--color-text-primary)]">{m.batchNumber}</span>,
    },
    {
      key: "qty", header: "Qty", sortable: true, align: "right",
      render: (m) => (
        <span className={`font-mono font-bold ${m.qty > 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
          {m.qty > 0 ? `+${m.qty}` : m.qty}
        </span>
      ),
    },
    {
      key: "qtyBefore", header: "Before → After", align: "right",
      render: (m) => <span className="font-mono text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{m.qtyBefore} → {m.qtyAfter}</span>,
    },
    {
      key: "orderNumber", header: "Order",
      render: (m) => m.orderNumber
        ? <span className="font-mono text-[var(--font-size-xs)] text-[var(--color-primary)]">{m.orderNumber}</span>
        : <span className="text-[var(--color-text-muted)]">—</span>,
    },
    {
      key: "notes", header: "Notes",
      render: (m) => (
        <span className="text-[var(--color-text-secondary)] truncate max-w-[180px] block" title={m.notes}>
          {m.notes || <span className="text-[var(--color-text-muted)]">—</span>}
        </span>
      ),
    },
    {
      key: "createdAt", header: "Date", sortable: true,
      render: (m) => <span className="whitespace-nowrap text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDate(m.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory Movement Log"
        description="Complete audit trail of every stock change across all batches"
      />

      <FilterPanel
        onApply={applyFilters}
        onReset={resetFilters}
        columns={3}
      >
        <FilterField label="Movement Type">
          <Select
            value={pending.movementType}
            onChange={(v) => setPending((p) => ({ ...p, movementType: v }))}
            options={MOVEMENT_TYPE_OPTIONS}
            placeholder="All Types"
          />
        </FilterField>
      </FilterPanel>

      <DataGrid
        columns={columns}
        data={filtered}
        keyFn={(m) => m._id}
        loading={isLoading}
        emptyTitle="No movements found"
        emptyDescription="No inventory movements match the current filters."
        summary={total > 0 ? [
          { label: "Total Records", value: String(total) },
        ] : undefined}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search batch, order, notes…"
        onExport={handleExport}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["inventory-movements"] })}
        sort={sort}
        onSort={handleSort}
      />

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

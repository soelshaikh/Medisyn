"use client";

import { Search, Printer, Download, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/common/EmptyState";

/* ── Column definition ─────────────────────────────────────────────────────── */

export interface DataGridColumn<T> {
  key:       string;
  header:    string;
  sortable?: boolean;
  width?:    string;
  align?:    "left" | "right" | "center";
  render:    (row: T, rowIndex: number) => React.ReactNode;
}

/* ── Summary items displayed above the table ───────────────────────────────── */

export interface GridSummaryItem {
  label: string;
  value: string;
}

/* ── Sort state ─────────────────────────────────────────────────────────────── */

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

/* ── Props ──────────────────────────────────────────────────────────────────── */

interface DataGridProps<T> {
  columns:           DataGridColumn<T>[];
  data:              T[];
  keyFn:             (row: T) => string;

  loading?:          boolean;
  emptyTitle?:       string;
  emptyDescription?: string;
  emptyIcon?:        React.ReactNode;

  /* Summary bar */
  summary?:          GridSummaryItem[];

  /* Search */
  search?:           string;
  onSearch?:         (q: string) => void;
  searchPlaceholder?: string;

  /* Action buttons */
  onExport?:         () => void;
  onPrint?:          () => void;
  onRefresh?:        () => void;

  /* Sorting */
  sort?:             SortState;
  onSort?:           (key: string, dir: "asc" | "desc") => void;
}

const ALIGN_CLASS = { left: "text-left", right: "text-right", center: "text-center" };

export function DataGrid<T>({
  columns, data, keyFn,
  loading,
  emptyTitle       = "No records found",
  emptyDescription = "Nothing to show here yet.",
  emptyIcon,
  summary,
  search, onSearch, searchPlaceholder = "Search…",
  onExport, onPrint, onRefresh,
  sort, onSort,
}: DataGridProps<T>) {

  function handleSortClick(col: DataGridColumn<T>) {
    if (!col.sortable || !onSort) return;
    if (sort?.key === col.key) {
      onSort(col.key, sort.dir === "asc" ? "desc" : "asc");
    } else {
      onSort(col.key, "asc");
    }
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sort?.key !== colKey) return <ArrowUpDown size={12} className="opacity-40" />;
    return sort.dir === "asc"
      ? <ArrowUp   size={12} className="text-[var(--color-primary)]" />
      : <ArrowDown size={12} className="text-[var(--color-primary)]" />;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
      {/* ── Summary + toolbar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Left: summary items */}
        <div className="flex items-center gap-1 text-[var(--font-size-xs)] text-[var(--color-text-muted)] flex-wrap">
          {summary?.map((s, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-[var(--color-border)] mx-1">·</span>}
              <span className="font-medium text-[var(--color-text-secondary)]">{s.label}:</span>
              <span className="font-semibold text-[var(--color-text-primary)]">{s.value}</span>
            </span>
          ))}
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSearch !== undefined && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search ?? ""}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 pr-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-[var(--font-size-xs)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-52"
              />
            </div>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Printer size={13} />Print
            </button>
          )}

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Download size={13} />Export
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-[var(--font-size-sm)]">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={[
                    "px-4 py-3",
                    "text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]",
                    ALIGN_CLASS[col.align ?? "left"],
                    col.sortable && onSort ? "cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors" : "",
                  ].join(" ")}
                  onClick={() => handleSortClick(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Spinner size="md" />
                    <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Loading…</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={keyFn(row)} className="hover:bg-[var(--color-surface)] transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={["px-4 py-3 text-[var(--color-text-primary)]", ALIGN_CLASS[col.align ?? "left"]].join(" ")}
                    >
                      {col.render(row, rowIndex)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

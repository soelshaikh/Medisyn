"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, CornerDownLeft } from "lucide-react";

interface FilterPanelProps {
  /** Filter field elements — rendered in a responsive CSS grid */
  children:         React.ReactNode;
  onApply:          () => void;
  onReset:          () => void;
  title?:           string;
  /** Number of columns in the filter grid — default 3 */
  columns?:         2 | 3 | 4 | 6;
  defaultCollapsed?: boolean;
  /** Extra row below the grid (e.g. "Group by" pills) */
  extra?:           React.ReactNode;
}

const COL_CLASS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

export function FilterPanel({
  children, onApply, onReset,
  title = "Filters",
  columns = 3,
  defaultCollapsed = false,
  extra,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Header — blue left accent bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] border-l-[3px] border-l-[var(--color-primary)]">
        <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-primary)]">
          {title}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pt-4 pb-3 space-y-4">
          {/* Filter fields grid */}
          <div className={`grid gap-x-4 gap-y-3 ${COL_CLASS[columns] ?? COL_CLASS[3]}`}>
            {children}
          </div>

          {/* Optional extra row (e.g. Group by pills) */}
          {extra && (
            <div className="pt-1">
              {extra}
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onApply}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[var(--font-size-xs)] font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Apply
              <CornerDownLeft size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── FilterField — labelled wrapper for a single filter inside FilterPanel ── */
interface FilterFieldProps {
  label:     string;
  children:  React.ReactNode;
  /** Span multiple grid columns */
  span?:     2 | 3;
}

export function FilterField({ label, children, span }: FilterFieldProps) {
  const spanClass = span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "";
  return (
    <div className={spanClass}>
      <p className="text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

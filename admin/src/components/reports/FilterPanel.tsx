"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReportPreset } from "@/api/reports.api";

const DATE_PRESETS: { label: string; value: ReportPreset }[] = [
  { label: "Today",        value: "today"     },
  { label: "Yesterday",    value: "yesterday" },
  { label: "Last 7 Days",  value: "7d"        },
  { label: "Last 30 Days", value: "30d"       },
  { label: "This Month",   value: "month"     },
];

interface FilterPanelProps {
  preset:         ReportPreset;
  onPresetChange: (p: ReportPreset) => void;
  onApply:        () => void;
  onReset:        () => void;
  children?:      React.ReactNode;
}

export default function FilterPanel({
  preset, onPresetChange, onApply, onReset, children,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-primary)]">
          Filters
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pt-3 pb-2.5 space-y-3">
          {/* Date & Time Range row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)] whitespace-nowrap shrink-0">
              Date &amp; Time Range
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => onPresetChange(p.value)}
                  className={[
                    "px-3 py-1 rounded-[var(--radius-md)] text-[11px] font-medium border transition-colors",
                    preset === p.value
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Extra per-report filters */}
          {children && <div className="flex flex-wrap gap-x-4 gap-y-2">{children}</div>}

          {/* Action row */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <button
              onClick={onReset}
              className="px-3 py-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Reset
            </button>
            <button
              onClick={onApply}
              className="flex items-center gap-1 px-4 py-1 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[11px] font-semibold hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Apply
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

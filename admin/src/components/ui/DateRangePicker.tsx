"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import {
  format, subDays, startOfMonth, endOfMonth, startOfYear,
  subMonths, startOfQuarter, parseISO, isValid,
} from "date-fns";
import { CalendarDays, X } from "lucide-react";

export interface DateRangeValue {
  from: string; /* YYYY-MM-DD */
  to:   string; /* YYYY-MM-DD */
}

const PRESETS: { label: string; fn: () => { from: Date; to: Date } }[] = [
  { label: "Today",        fn: () => { const t = new Date(); return { from: t, to: t }; } },
  { label: "Yesterday",    fn: () => { const t = subDays(new Date(), 1); return { from: t, to: t }; } },
  { label: "Last 7 Days",  fn: () => ({ from: subDays(new Date(), 6),  to: new Date() }) },
  { label: "Last 30 Days", fn: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Month",   fn: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "Last Month",   fn: () => { const lm = subMonths(new Date(), 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; } },
  { label: "This Quarter", fn: () => ({ from: startOfQuarter(new Date()), to: new Date() }) },
  { label: "This Year",    fn: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

interface DateRangePickerProps {
  value:     DateRangeValue;
  onChange:  (v: DateRangeValue) => void;
  label?:    string;
  hint?:     string;
  error?:    string;
  disabled?: boolean;
  placeholder?: string;
}

function toDate(s: string): Date | undefined {
  if (!s) return undefined;
  const d = parseISO(s);
  return isValid(d) ? d : undefined;
}

const DISPLAY_FMT = "d MMM yyyy";

export function DateRangePicker({
  value, onChange, label, hint, error, disabled,
  placeholder = "Select date range…",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const fromDate = toDate(value.from);
  const toDate_  = toDate(value.to);
  const selected = fromDate ? { from: fromDate, to: toDate_ } : undefined;

  function handleSelect(range: { from?: Date; to?: Date } | undefined) {
    if (!range) { onChange({ from: "", to: "" }); return; }
    onChange({
      from: range.from ? format(range.from, "yyyy-MM-dd") : "",
      to:   range.to   ? format(range.to,   "yyyy-MM-dd") : "",
    });
  }

  function applyPreset(fn: () => { from: Date; to: Date }) {
    const r = fn();
    onChange({ from: format(r.from, "yyyy-MM-dd"), to: format(r.to, "yyyy-MM-dd") });
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange({ from: "", to: "" });
  }

  const displayText = fromDate
    ? toDate_ && toDate_.getTime() !== fromDate.getTime()
      ? `${format(fromDate, DISPLAY_FMT)} → ${format(toDate_, DISPLAY_FMT)}`
      : format(fromDate, DISPLAY_FMT)
    : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
      )}

      <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={[
              "flex w-full items-center justify-between gap-2",
              "rounded-[var(--radius-md)] border px-3 py-2",
              "text-[var(--font-size-sm)] text-left bg-white",
              "outline-none focus:ring-2 transition-colors duration-[var(--transition-fast)]",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              error
                ? "border-[var(--color-error)] focus:ring-[var(--color-error-light)]"
                : "border-[var(--color-border)] hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-light)]",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
              <CalendarDays size={14} className="text-[var(--color-text-muted)] shrink-0" />
              <span className={[
                "truncate",
                displayText ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]",
              ].join(" ")}>
                {displayText ?? placeholder}
              </span>
            </div>
            {displayText && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={clear}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange({ from: "", to: "" }); } }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors shrink-0"
              >
                <X size={13} />
              </span>
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={4}
            align="start"
            className={[
              "z-[var(--z-modal)] flex",
              "bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)]",
              "shadow-[var(--shadow-xl)] overflow-hidden animate-fade-in",
            ].join(" ")}
          >
            {/* Preset sidebar */}
            <div className="w-36 shrink-0 border-r border-[var(--color-border)] py-2 bg-[var(--color-surface)]">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.fn)}
                  className="w-full text-left px-4 py-2 text-[var(--font-size-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary-dark)] transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Dual calendar */}
            <div className="p-3">
              <DayPicker
                mode="range"
                numberOfMonths={2}
                hideNavigation
                selected={selected}
                onSelect={handleSelect as never}
                classNames={{
                  root:            "rdp",
                  months:          "flex gap-6",
                  month:           "space-y-3",
                  month_caption:   "flex items-center justify-between px-1",
                  caption_label:   "text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]",
                  nav:             "flex items-center gap-1",
                  button_previous: "p-1 rounded-[var(--radius-md)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors",
                  button_next:     "p-1 rounded-[var(--radius-md)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors",
                  month_grid:      "w-full border-collapse",
                  weekdays:        "flex",
                  weekday:         "w-7 text-center text-[var(--font-size-xs)] font-medium text-[var(--color-text-muted)] pb-1",
                  week:            "flex mt-0.5",
                  day:             "w-7 h-7 text-center p-0",
                  day_button:      "w-7 h-7 rounded-[var(--radius-md)] text-[var(--font-size-xs)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-light)] transition-colors",
                  selected:        "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] rounded-[var(--radius-md)]",
                  range_start:     "!bg-[var(--color-primary)] !text-white rounded-r-none",
                  range_middle:    "!bg-[var(--color-primary-light)] !text-[var(--color-text-primary)] rounded-none",
                  range_end:       "!bg-[var(--color-primary)] !text-white rounded-l-none",
                  today:           "font-bold text-[var(--color-primary)]",
                  disabled:        "opacity-30 cursor-not-allowed",
                  outside:         "opacity-40",
                }}
              />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {hint  && !error && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{hint}</p>}
      {error &&           <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{error}</p>}
    </div>
  );
}

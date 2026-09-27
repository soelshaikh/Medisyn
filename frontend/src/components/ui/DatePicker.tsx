"use client";

import { useState, useRef, useEffect, useId } from "react";
import { DayPicker } from "react-day-picker";
import { format, isValid } from "date-fns";
import { CalendarDays, X } from "lucide-react";

interface DatePickerProps {
  label?: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Select a date",
  minDate,
  maxDate,
  error,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);
  const id              = useId();

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const displayValue = value && isValid(value) ? format(value, "MMM d, yyyy") : "";

  function handleSelect(date: Date | undefined) {
    onChange(date);
    setOpen(false);
  }

  return (
    <div className={`w-full ${className ?? ""}`} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-900 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger input */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={[
            "w-full flex items-center justify-between gap-2",
            "rounded-xl border bg-white px-3.5 py-2.5",
            "text-sm text-left transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-500",
            error
              ? "border-red-400 focus:ring-red-100"
              : open
              ? "border-brand-500 ring-2 ring-brand-100"
              : "border-ink-200 hover:border-brand-300",
            disabled ? "cursor-not-allowed opacity-60 bg-ink-50" : "cursor-pointer",
          ].join(" ")}
        >
          <span className={displayValue ? "text-ink-900" : "text-ink-400"}>
            {displayValue || placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
                onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onChange(undefined))}
                className="p-0.5 rounded text-ink-400 hover:text-ink-700 transition-colors"
                aria-label="Clear date"
              >
                <X size={13} />
              </span>
            )}
            <CalendarDays size={15} className="text-ink-400" />
          </span>
        </button>

        {/* Calendar popover */}
        {open && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-ink-200 bg-white shadow-xl p-3 min-w-[280px]">
            <DayPicker
              mode="single"
              selected={value}
              onSelect={handleSelect}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              defaultMonth={value ?? minDate ?? new Date()}
              classNames={{
                root:            "text-sm select-none",
                months:          "flex flex-col",
                month:           "space-y-2",
                month_caption:   "flex items-center justify-between px-1 mb-1",
                caption_label:   "font-semibold text-ink-900 text-sm",
                nav:             "flex items-center gap-1",
                button_previous: [
                  "inline-flex items-center justify-center w-7 h-7 rounded-lg",
                  "border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-brand-300",
                  "transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                ].join(" "),
                button_next: [
                  "inline-flex items-center justify-center w-7 h-7 rounded-lg",
                  "border border-ink-200 text-ink-500 hover:bg-ink-50 hover:border-brand-300",
                  "transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                ].join(" "),
                month_grid:  "w-full border-collapse",
                weekdays:    "flex mb-1",
                weekday:     "w-9 h-8 flex items-center justify-center text-xs font-medium text-ink-400",
                week:        "flex",
                day:         "w-9 h-9 p-0",
                day_button: [
                  "w-full h-full flex items-center justify-center rounded-xl text-sm",
                  "transition-colors hover:bg-brand-50 hover:text-brand-700",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
                  "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-inherit",
                ].join(" "),
                selected:  "[&>button]:bg-brand-600 [&>button]:text-white [&>button]:hover:bg-brand-700 [&>button]:hover:text-white [&>button]:font-semibold",
                today:     "[&>button]:font-bold [&>button]:text-brand-600 [&>button]:ring-1 [&>button]:ring-brand-300",
                outside:   "opacity-30",
                hidden:    "invisible",
                range_start: "",
                range_end:   "",
                range_middle: "",
              }}
            />
          </div>
        )}
      </div>

      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}

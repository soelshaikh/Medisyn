"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, parseISO, isValid } from "date-fns";
import { CalendarDays, X } from "lucide-react";

interface DatePickerProps {
  label?: string;
  hint?: string;
  error?: string;
  value: string;        // ISO date string "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({ label, hint, error, value, onChange, placeholder = "Pick a date…", disabled, minDate, maxDate }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected: Date | undefined = value
    ? (() => { const d = parseISO(value); return isValid(d) ? d : undefined; })()
    : undefined;

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

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
              "text-[var(--font-size-sm)] text-left",
              "bg-white transition-colors duration-[var(--transition-fast)]",
              "outline-none focus:ring-2",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              error
                ? "border-[var(--color-error)] focus:ring-[var(--color-error-light)]"
                : "border-[var(--color-border)] hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-light)]",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CalendarDays size={14} className="text-[var(--color-text-muted)] shrink-0" />
              <span className={selected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>
                {selected ? format(selected, "MMM d, yyyy") : placeholder}
              </span>
            </div>
            {selected && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={clear}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(""); } }}
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
              "z-[var(--z-modal)]",
              "bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)]",
              "shadow-[var(--shadow-lg)] p-3",
              "animate-fade-in",
            ].join(" ")}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              classNames={{
                root:            "rdp",
                months:          "flex gap-4",
                month:           "space-y-3",
                month_caption:   "flex items-center justify-between px-1",
                caption_label:   "text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]",
                nav:             "flex items-center gap-1",
                button_previous: "p-1 rounded-[var(--radius-md)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors",
                button_next:     "p-1 rounded-[var(--radius-md)] hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors",
                month_grid:      "w-full border-collapse",
                weekdays:        "flex",
                weekday:         "w-9 text-center text-[var(--font-size-xs)] font-medium text-[var(--color-text-muted)] pb-1",
                week:            "flex mt-1",
                day:             "w-9 h-9 text-center p-0",
                day_button:      "w-9 h-9 rounded-[var(--radius-md)] text-[var(--font-size-sm)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-light)] transition-colors",
                selected:        "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] rounded-[var(--radius-md)]",
                today:           "font-semibold text-[var(--color-primary)]",
                disabled:        "opacity-30 cursor-not-allowed",
                outside:         "opacity-40",
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {hint && !error && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{error}</p>}
    </div>
  );
}

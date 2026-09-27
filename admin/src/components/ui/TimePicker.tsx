"use client";

import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Clock } from "lucide-react";

interface TimePickerProps {
  label?: string;
  hint?: string;
  error?: string;
  value: string;          // "HH:MM" 24h
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1);           // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);           // 0,5,10…55

function to24(h: number, m: number, period: "AM" | "PM"): string {
  let hour = h % 12;
  if (period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parse24(val: string): { hour: number; minute: number; period: "AM" | "PM" } {
  const [hStr, mStr] = (val || "09:00").split(":");
  const h24 = parseInt(hStr, 10);
  const m   = parseInt(mStr, 10);
  const period: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  return { hour, minute: m, period };
}

export function fmt12h(val: string): string {
  if (!val) return "";
  const { hour, minute, period } = parse24(val);
  return `${hour}:${String(minute).padStart(2, "0")} ${period}`;
}

function ScrollList({ items, selected, onSelect, format }: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector(`[data-active="true"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div ref={ref} className="h-48 overflow-y-auto scrollbar-thin">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          data-active={v === selected}
          onClick={() => onSelect(v)}
          className={[
            "w-full text-center py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] transition-colors",
            v === selected
              ? "bg-[var(--color-primary)] text-white font-semibold"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)]",
          ].join(" ")}
        >
          {format ? format(v) : String(v).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}

export function TimePicker({ label, hint, error, value, onChange, placeholder = "Pick a time…", disabled }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const { hour, minute, period } = parse24(value || "09:00");

  function update(h: number, m: number, p: "AM" | "PM") {
    onChange(to24(h, m, p));
  }

  const display = value ? fmt12h(value) : "";

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
              "flex w-full items-center gap-2",
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
            <Clock size={14} className="text-[var(--color-text-muted)] shrink-0" />
            <span className={display ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>
              {display || placeholder}
            </span>
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
              "w-52",
            ].join(" ")}
          >
            <div className="flex gap-2">
              {/* Hours */}
              <div className="flex-1">
                <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] text-center mb-1">Hour</p>
                <ScrollList
                  items={HOURS}
                  selected={hour}
                  onSelect={(h) => update(h, minute, period)}
                  format={(v) => String(v)}
                />
              </div>

              {/* Minutes */}
              <div className="flex-1">
                <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] text-center mb-1">Min</p>
                <ScrollList
                  items={MINUTES}
                  selected={MINUTES.includes(minute) ? minute : 0}
                  onSelect={(m) => update(hour, m, period)}
                />
              </div>

              {/* AM / PM */}
              <div className="flex flex-col gap-1 justify-center">
                <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] text-center mb-1">
                  &nbsp;
                </p>
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update(hour, minute, p)}
                    className={[
                      "px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--font-size-sm)] font-semibold transition-colors",
                      p === period
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-light)]",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[var(--font-size-sm)] font-semibold py-1.5 hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Done
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {hint  && !error && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{error}</p>}
    </div>
  );
}

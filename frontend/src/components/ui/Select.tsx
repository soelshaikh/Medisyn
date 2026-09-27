"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  error,
  disabled,
  className,
  triggerClassName,
}: SelectProps) {
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);
  const id                  = useId();
  const selected            = options.find((o) => o.value === value);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className={`w-full ${className ?? ""}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-ink-900 mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {/* Trigger */}
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
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
            triggerClassName ?? "",
          ].join(" ")}
        >
          <span className={selected ? "text-ink-900" : "text-ink-400"}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={15}
            className={[
              "shrink-0 text-ink-400 transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-full w-max overflow-auto rounded-xl border border-ink-200 bg-white shadow-lg"
            style={{ maxHeight: "15rem" }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={[
                      "flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left transition-colors whitespace-nowrap",
                      isSelected
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-ink-700 hover:bg-ink-50 hover:text-ink-900",
                    ].join(" ")}
                  >
                    {opt.label}
                    {isSelected && <Check size={13} className="shrink-0 text-brand-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

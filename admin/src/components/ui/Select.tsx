"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ label, hint, error, value, onChange, options, placeholder = "Select…", disabled }: SelectProps) {
  const selected = options.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
      )}

      <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={[
            "flex w-full items-center justify-between",
            "rounded-[var(--radius-md)] border px-3 py-2",
            "text-[var(--font-size-sm)] text-left",
            "transition-colors duration-[var(--transition-fast)]",
            "outline-none focus:ring-2",
            "bg-white",
            disabled ? "opacity-50 cursor-not-allowed" : "",
            error
              ? "border-[var(--color-error)] focus:ring-[var(--color-error-light)]"
              : "border-[var(--color-border)] hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-light)]",
          ].join(" ")}
        >
          <RadixSelect.Value placeholder={<span className="text-[var(--color-text-muted)]">{placeholder}</span>}>
            {selected?.label ?? <span className="text-[var(--color-text-muted)]">{placeholder}</span>}
          </RadixSelect.Value>
          <RadixSelect.Icon>
            <ChevronDown size={14} className="text-[var(--color-text-muted)] shrink-0 ml-2" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className={[
              "z-[var(--z-modal)] min-w-[var(--radix-select-trigger-width)]",
              "bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)]",
              "shadow-[var(--shadow-lg)]",
              "animate-fade-in",
              "overflow-hidden",
            ].join(" ")}
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={[
                    "flex items-center justify-between gap-3",
                    "rounded-[var(--radius-md)] px-3 py-2",
                    "text-[var(--font-size-sm)] text-[var(--color-text-primary)]",
                    "outline-none select-none",
                    "transition-colors duration-[var(--transition-fast)]",
                    opt.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer data-[highlighted]:bg-[var(--color-primary-light)] data-[highlighted]:text-[var(--color-primary-dark)]",
                  ].join(" ")}
                >
                  <div>
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                    {opt.description && (
                      <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5">{opt.description}</p>
                    )}
                  </div>
                  <RadixSelect.ItemIndicator>
                    <Check size={13} className="text-[var(--color-primary)] shrink-0" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {hint && !error && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{error}</p>}
    </div>
  );
}

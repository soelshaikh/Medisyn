"use client";

import type { InputHTMLAttributes } from "react";

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
}

export function NumberInput({ label, hint, error, value, onChange, allowDecimal = false, className, ...rest }: NumberInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x", "z"].includes(e.key)) return;
    if (allowDecimal && e.key === ".") return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d+$/;
    if (!pattern.test(text)) e.preventDefault();
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
      )}
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={[
          "w-full rounded-[var(--radius-md)] border px-3 py-2",
          "text-[var(--font-size-sm)] text-[var(--color-text-primary)]",
          "transition-colors duration-[var(--transition-fast)]",
          "placeholder:text-[var(--color-text-muted)]",
          error
            ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error-light)]"
            : "border-[var(--color-border)] hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]",
          "outline-none focus:ring-2",
          className ?? "",
        ].join(" ")}
        {...rest}
      />
      {hint && !error && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{error}</p>}
    </div>
  );
}

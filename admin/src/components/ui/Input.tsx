"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, fullWidth = true, className = "", id, ...rest }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={fullWidth ? "w-full" : ""}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute inset-y-0 left-3 flex items-center text-[var(--color-text-muted)] pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={[
              "w-full rounded-[var(--radius-md)] border bg-[var(--color-white)]",
              "text-[var(--font-size-md)] text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-muted)]",
              "px-3 py-2.5 transition-all duration-[var(--transition-fast)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 focus:border-[var(--color-primary)]",
              "disabled:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60",
              error
                ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
                : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
              leftIcon  ? "pl-10" : "",
              rightIcon ? "pr-10" : "",
              className,
            ].filter(Boolean).join(" ")}
            {...rest}
          />

          {rightIcon && (
            <span className="absolute inset-y-0 right-3 flex items-center text-[var(--color-text-muted)]">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-[var(--font-size-sm)] text-[var(--color-error)]">{error}</p>
        )}
        {!error && hint && (
          <p className="mt-1.5 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

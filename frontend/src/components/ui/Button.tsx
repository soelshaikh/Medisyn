"use client";

import { forwardRef } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:   "bg-[var(--color-primary)] text-[var(--color-white)] hover:bg-[var(--color-primary-dark)] border border-transparent",
  secondary: "bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] border border-[var(--color-border)]",
  outline:   "bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] border border-[var(--color-primary)]",
  ghost:     "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] border border-transparent",
  danger:    "bg-[var(--color-error)] text-[var(--color-white)] hover:bg-[var(--color-error-dark)] border border-transparent",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-[var(--font-size-sm)] px-3 py-1.5 gap-1.5",
  md: "text-[var(--font-size-md)] px-4 py-2.5 gap-2",
  lg: "text-[var(--font-size-lg)] px-6 py-3 gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className = "",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          "inline-flex items-center justify-center font-[var(--font-weight-medium)]",
          "rounded-[var(--radius-md)] transition-all duration-[var(--transition-base)]",
          "focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {loading ? (
          <Spinner size={size === "lg" ? "md" : "sm"} color="current" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";

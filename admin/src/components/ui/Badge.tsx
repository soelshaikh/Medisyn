"use client";

type Variant = "default" | "primary" | "success" | "warning" | "error" | "info";
type Size    = "sm" | "md";

interface BadgeProps {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] border-[var(--color-primary)]",
  success: "bg-[var(--color-success-light)] text-[var(--color-success-dark)] border-[var(--color-success-border)]",
  warning: "bg-[var(--color-warning-light)] text-[var(--color-warning-dark)] border-[var(--color-warning-border)]",
  error:   "bg-[var(--color-error-light)] text-[var(--color-error-dark)] border-[var(--color-error-border)]",
  info:    "bg-[var(--color-info-light)] text-[var(--color-info-dark)] border-[var(--color-info-border)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-[var(--font-size-xs)] px-2 py-0.5",
  md: "text-[var(--font-size-sm)] px-2.5 py-1",
};

export function Badge({ variant = "default", size = "sm", children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center font-[var(--font-weight-medium)]",
        "rounded-[var(--radius-full)] border",
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

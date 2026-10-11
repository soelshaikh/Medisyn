"use client";

type Variant = "default" | "primary" | "success" | "warning" | "error" | "info";
type Size    = "sm" | "md";

interface BadgeProps {
  variant?: Variant;
  size?: Size;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]",
  primary: "bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)]",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error:   "bg-red-50 text-red-600 border-red-200",
  info:    "bg-sky-50 text-sky-700 border-sky-200",
};

const dotStyles: Partial<Record<Variant, string>> = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  error:   "bg-red-500",
  info:    "bg-sky-500",
  primary: "bg-[var(--color-primary)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-[var(--font-size-xs)] px-2.5 py-1 gap-1.5",
  md: "text-[var(--font-size-sm)] px-3 py-1.5 gap-2",
};

export function Badge({ variant = "default", size = "sm", dot = false, children, className = "" }: BadgeProps) {
  const dotColor = dotStyles[variant];

  return (
    <span
      className={[
        "inline-flex items-center font-semibold tracking-wide",
        "rounded-[var(--radius-full)] border",
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(" ")}
    >
      {dot && dotColor && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      )}
      {children}
    </span>
  );
}

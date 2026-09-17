"use client";

type Size  = "xs" | "sm" | "md" | "lg";
type Color = "primary" | "white" | "current";

interface SpinnerProps {
  size?: Size;
  color?: Color;
  className?: string;
}

const sizeMap: Record<Size, string> = {
  xs: "w-3 h-3 border",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

const colorMap: Record<Color, string> = {
  primary: "border-[var(--color-primary)] border-t-transparent",
  white:   "border-white border-t-transparent",
  current: "border-current border-t-transparent opacity-70",
};

export function Spinner({ size = "md", color = "primary", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        "inline-block rounded-full animate-spin",
        sizeMap[size],
        colorMap[color],
        className,
      ].join(" ")}
    />
  );
}

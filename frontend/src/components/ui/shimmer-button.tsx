import Link from "next/link";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
}

const VARIANTS = {
  primary:
    "bg-brand-600 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 px-7 py-3.5",
  outline:
    "border border-slate-300 text-ink-900 hover:border-brand-400 hover:text-brand-700 px-7 py-3.5",
  ghost:
    "border border-white/40 text-white hover:bg-white/10 px-7 py-3.5",
};

export function ShimmerButton({
  href,
  children,
  className,
  variant = "primary",
}: ShimmerButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex overflow-hidden rounded-full text-center text-sm font-semibold transition focus-visible:outline-none",
        VARIANTS[variant],
        className
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/20 transition-transform duration-700 group-hover:translate-x-[200%]"
      />
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

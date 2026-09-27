import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface BentoGridProps {
  className?: string;
  children: React.ReactNode;
}

interface BentoGridItemProps {
  className?: string;
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({ className, title, description, Icon }: BentoGridItemProps) {
  return (
    <div
      className={cn(
        "group/bento flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white transition-transform duration-200 group-hover/bento:scale-110">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 font-display text-sm font-semibold text-ink-900">{title}</div>
        <div className="text-xs leading-relaxed text-slate-600">{description}</div>
      </div>
    </div>
  );
}

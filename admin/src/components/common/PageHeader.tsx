"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Inline filter controls — rendered between title and actions in the same row */
  filters?: React.ReactNode;
  /** Shows a refresh icon that calls this handler */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Shows a back arrow that calls router.back() or a custom handler */
  onBack?: (() => void) | "auto";
}

export function PageHeader({ title, description, actions, filters, onRefresh, refreshing, onBack }: PageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack === "auto" ? () => router.back() : onBack;

  return (
    <div className="flex items-center gap-3 mb-[var(--space-3)]">
      {handleBack && (
        <button
          onClick={handleBack}
          className="shrink-0 p-1 rounded-[var(--radius-md)] text-[var(--color-text-muted)]
                     hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]
                     transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Title + count */}
      <div className="shrink-0 min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[var(--font-size-xl)] font-bold text-[var(--color-text-primary)] leading-tight">
            {title}
          </h1>
          {description && (
            <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
              {description}
            </span>
          )}
        </div>
      </div>

      {/* Inline filters grow to fill available space */}
      {filters && <div className="flex items-center gap-2 flex-1 min-w-0">{filters}</div>}

      {/* Refresh + action buttons — always grouped together on the right */}
      {(onRefresh || actions) && (
        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)]
                         hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]
                         transition-colors disabled:opacity-50"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

"use client";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-[var(--space-16)] px-[var(--space-8)] text-center">
      {icon && (
        <div className="mb-[var(--space-4)] text-[var(--color-text-muted)]">{icon}</div>
      )}
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--color-text-primary)]">
        {title}
      </h3>
      {description && (
        <p className="mt-[var(--space-2)] text-[var(--font-size-md)] text-[var(--color-text-secondary)] max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-[var(--space-6)]">{action}</div>}
    </div>
  );
}

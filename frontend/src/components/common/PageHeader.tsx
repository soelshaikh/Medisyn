"use client";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-[var(--space-6)]">
      <div>
        <h1
          className="text-[var(--font-size-2xl)] font-[var(--font-weight-bold)]
                     text-[var(--color-text-primary)] leading-[var(--line-height-tight)]"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[var(--font-size-md)] text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

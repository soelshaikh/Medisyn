interface EmptyStateProps {
  icon?:        React.ReactNode;
  title?:       string;
  description?: string;
  action?:      React.ReactNode;
}

export function EmptyState({
  icon,
  title       = "No records found",
  description = "Nothing to show here yet.",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center select-none">
      <div className="mb-5 animate-float">
        {icon ?? (
          <svg width="110" height="95" viewBox="0 0 110 95" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="55" cy="90" rx="26" ry="4" fill="var(--color-border)" opacity="0.5" />
            <rect x="30" y="18" width="52" height="62" rx="7" fill="var(--color-surface-alt)" stroke="var(--color-border)" strokeWidth="1.5" />
            <rect x="22" y="12" width="52" height="62" rx="7" fill="white" stroke="var(--color-border)" strokeWidth="1.5" />
            <rect x="22" y="12" width="52" height="14" rx="7" fill="var(--color-primary-light)" />
            <rect x="22" y="19" width="52" height="7" fill="var(--color-primary-light)" />
            <rect x="32" y="34" width="32" height="3.5" rx="1.75" fill="var(--color-surface-alt)" />
            <rect x="32" y="43" width="24" height="3.5" rx="1.75" fill="var(--color-surface-alt)" />
            <rect x="32" y="52" width="28" height="3.5" rx="1.75" fill="var(--color-surface-alt)" />
            <circle cx="70" cy="66" r="14" fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth="2" opacity="0.9" />
            <circle cx="68" cy="64" r="6" stroke="var(--color-primary)" strokeWidth="2" fill="none" />
            <line x1="73" y1="69" x2="78" y2="74" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="24" r="5" fill="var(--color-primary-light)" />
            <circle cx="95" cy="20" r="4" fill="var(--color-accent-light)" />
            <circle cx="98" cy="52" r="3" fill="var(--color-primary-light)" />
            <circle cx="16" cy="65" r="3" fill="var(--color-surface-alt)" />
          </svg>
        )}
      </div>
      <h3 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

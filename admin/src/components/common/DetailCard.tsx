interface FieldDef {
  label: string;
  value: React.ReactNode;
}

interface DetailCardProps {
  title:    string;
  fields:   FieldDef[];
  cols?:    1 | 2 | 3;
  action?:  React.ReactNode;
}

export function DetailCard({ title, fields, cols = 2, action }: DetailCardProps) {
  const gridClass = cols === 3
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4"
    : cols === 1
      ? "grid grid-cols-1 gap-y-4"
      : "grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4";

  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      <div className="px-6 py-5">
        <dl className={gridClass}>
          {fields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-[var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
                {label}
              </dt>
              <dd className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
                {value ?? <span className="text-[var(--color-text-muted)]">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

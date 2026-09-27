/* Shared presentational components for individual report pages */

export function ReportKpiCard({
  label, value, sub, accentColor = "var(--color-primary)",
}: {
  label:        string;
  value:        string | number;
  sub?:         string;
  accentColor?: string;
}) {
  return (
    <div
      className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-4 py-3"
      style={{ borderTopColor: accentColor, borderTopWidth: 3 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-0.5">
        {label}
      </p>
      <p className="text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

export function ReportBarChart({
  rows, labelKey = "_id", valueKey, color = "var(--color-primary)",
}: {
  rows:      Array<Record<string, unknown>>;
  labelKey?: string;
  valueKey:  string;
  color?:    string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1 h-28 mt-1">
      {rows.map((row, i) => {
        const val = Number(row[valueKey]) || 0;
        const pct = Math.max(Math.round((val / max) * 100), 2);
        const label = String(row[labelKey] ?? i).slice(-5);
        return (
          <div
            key={String(row[labelKey] ?? i)}
            className="flex flex-col items-center gap-0.5 flex-1 min-w-0 group relative"
          >
            <span className="absolute -top-4 text-[9px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {val.toLocaleString()}
            </span>
            <div
              className="w-full rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity"
              style={{ height: `${pct}%`, backgroundColor: color }}
            />
            <span className="text-[9px] text-[var(--color-text-muted)] truncate w-full text-center">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ReportHorizBar({
  label, count, max, sub,
}: { label: string; count: number; max: number; sub?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] truncate leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">{sub}</p>}
      </div>
      <div className="flex-1 h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-primary)] w-8 text-right shrink-0">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

export function ReportSection({
  title, children, action,
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ReportEmpty() {
  return (
    <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] py-6 text-center">
      No data for this period.
    </p>
  );
}

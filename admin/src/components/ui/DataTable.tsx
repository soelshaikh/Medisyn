import { Spinner } from "./Spinner";
import { EmptyState } from "@/components/common/EmptyState";

export interface Column<T> {
  key:      string;
  header:   string;
  width?:   string;
  render:   (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns:   Column<T>[];
  data:      T[];
  loading?:  boolean;
  emptyText?: string;
  keyFn:     (row: T) => string;
}

export function DataTable<T>({ columns, data, loading, emptyText = "No records found.", keyFn }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
      <table className="w-full min-w-[600px] text-[var(--font-size-sm)]">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-left">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center">
                <Spinner size="md" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-[var(--color-text-muted)]">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={keyFn(row)} className="hover:bg-[var(--color-surface)] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-3 text-[var(--color-text-primary)]">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

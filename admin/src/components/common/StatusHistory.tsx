import type { StatusEntry } from "@/types/admin";
import { fmtDateTime } from "@/lib/format";

interface StatusHistoryProps {
  history: StatusEntry[];
}

export function StatusHistory({ history }: StatusHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No status history yet.</p>
    );
  }

  return (
    <ol className="relative border-l border-[var(--color-border)] space-y-0">
      {[...history].reverse().map((entry, i) => (
        <li key={i} className="pl-5 pb-5 last:pb-0 relative">
          <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] border-2 border-white" />
          <p className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)] capitalize">
            {entry.status.replace(/_/g, " ")}
          </p>
          {entry.note && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] mt-0.5">{entry.note}</p>
          )}
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5">
            {entry.changedByName || "System"} · {fmtDateTime(entry.changedAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

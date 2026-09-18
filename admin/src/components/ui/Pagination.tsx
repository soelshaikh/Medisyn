interface PaginationProps {
  page:       number;
  totalPages: number;
  onPage:     (p: number) => void;
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end pt-2">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-3 py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)]
                   text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        Previous
      </button>
      <span className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] min-w-[80px] text-center">
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="px-3 py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)]
                   text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      >
        Next
      </button>
    </div>
  );
}

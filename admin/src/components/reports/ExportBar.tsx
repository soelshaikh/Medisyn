import { Sheet, FileText } from "lucide-react";

interface ExportBarProps {
  onExcel: () => void;
  onPdf:   () => void;
}

export default function ExportBar({ onExcel, onPdf }: ExportBarProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-white border border-[var(--color-border)] text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        <Sheet size={13} />
        Export Excel
      </button>
      <button
        onClick={onPdf}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-white border border-[var(--color-border)] text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        <FileText size={13} />
        Export PDF
      </button>
    </div>
  );
}

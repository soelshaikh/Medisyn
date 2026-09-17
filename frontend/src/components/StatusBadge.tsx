import { STATUS_STYLES, statusLabel } from "@/lib/ui";

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {statusLabel(status)}
    </span>
  );
}

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export const labelClass = "text-sm font-medium text-ink-900";

export const STATUS_STYLES: Record<string, string> = {
  pending_verification: "bg-slate-100 text-slate-600",
  pending_approval: "bg-amber-100 text-amber-700",
  active: "bg-brand-100 text-brand-700",
  approved: "bg-brand-100 text-brand-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-orange-100 text-orange-700",
  deactivated: "bg-slate-200 text-slate-500",
  submitted: "bg-slate-100 text-slate-600",
  received: "bg-sky-100 text-sky-700",
  under_review: "bg-amber-100 text-amber-700",
  more_info_required: "bg-orange-100 text-orange-700",
  processing: "bg-indigo-100 text-indigo-700",
  ready_pickup: "bg-teal-100 text-teal-700",
  ready_delivery: "bg-teal-100 text-teal-700",
  completed: "bg-brand-100 text-brand-700",
  declined: "bg-red-100 text-red-700",
  responded: "bg-brand-100 text-brand-700",
  closed: "bg-slate-200 text-slate-500",
  confirmed: "bg-brand-100 text-brand-700",
  cancelled: "bg-slate-200 text-slate-500",
};

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

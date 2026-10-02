import Link from "next/link";
import {
  FileText, DollarSign, Receipt, ArrowRight, LayoutList,
} from "lucide-react";

const REPORTS = [
  {
    id:          "summary",
    title:       "Billing & Refund Report",
    description: "Revenue, tax collected, discounts, payment status breakdown, and full refund analysis by status and method.",
    icon:        DollarSign,
    iconColor:   "var(--color-success)",
    iconBg:      "var(--color-success-light)",
    linkColor:   "var(--color-success)",
  },
  {
    id:          "revenue",
    title:       "Revenue by Period",
    description: "Daily and monthly revenue trend from issued invoices, with period-over-period comparison.",
    icon:        LayoutList,
    iconColor:   "var(--color-info)",
    iconBg:      "var(--color-info-light)",
    linkColor:   "var(--color-info)",
  },
  {
    id:          "tax",
    title:       "Tax Report",
    description: "GST, HST, and PST collected broken down by tax label across all issued invoices.",
    icon:        Receipt,
    iconColor:   "var(--color-warning)",
    iconBg:      "var(--color-warning-light)",
    linkColor:   "var(--color-warning)",
  },
  {
    id:          "adhoc",
    title:       "Adhoc vs. Order Invoices",
    description: "Volume and revenue split between direct adhoc invoices and order-linked invoices.",
    icon:        FileText,
    iconColor:   "var(--color-primary)",
    iconBg:      "var(--color-primary-light)",
    linkColor:   "var(--color-primary)",
  },
] as const;

export default function InvoiceReportsIndexPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)]"
          style={{ background: "var(--color-primary-light)" }}
        >
          <FileText size={22} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Invoice Reports</h1>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-0.5">
            Select a report to view detailed invoice analytics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {REPORTS.map(({ id, title, description, icon: Icon, iconColor, iconBg, linkColor }) => (
          <Link
            key={id}
            href={`/invoices/reports/${id}`}
            className="group bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 flex flex-col hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)] transition-all duration-[var(--transition-base)]"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] mb-4 shrink-0"
              style={{ background: iconBg }}
            >
              <Icon size={22} style={{ color: iconColor }} />
            </div>

            <h3
              className="text-[var(--font-size-md)] font-semibold mb-2 group-hover:underline"
              style={{ color: linkColor }}
            >
              {title}
            </h3>

            <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] leading-relaxed flex-1 mb-5">
              {description}
            </p>

            <span
              className="flex items-center gap-1 text-[var(--font-size-xs)] font-semibold"
              style={{ color: linkColor }}
            >
              View Report
              <ArrowRight size={13} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

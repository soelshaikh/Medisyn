import Link from "next/link";
import {
  BarChart3, DollarSign, ShoppingCart, Package,
  Users, Tag, ArrowRight,
} from "lucide-react";

const REPORTS = [
  {
    id:          "sales",
    title:       "Sales Report",
    description: "Revenue, average order value, discounts, and daily sales breakdown for the period.",
    icon:        DollarSign,
    iconColor:   "var(--color-success)",
    iconBg:      "var(--color-success-light)",
    linkColor:   "var(--color-success)",
  },
  {
    id:          "orders",
    title:       "Orders Report",
    description: "Order volume by status, guest vs. registered breakdown, and daily order trend.",
    icon:        ShoppingCart,
    iconColor:   "var(--color-info)",
    iconBg:      "var(--color-info-light)",
    linkColor:   "var(--color-info)",
  },
  {
    id:          "products",
    title:       "Products Report",
    description: "Top products ranked by units sold and by revenue for the selected period.",
    icon:        Package,
    iconColor:   "var(--color-warning)",
    iconBg:      "var(--color-warning-light)",
    linkColor:   "var(--color-warning)",
  },
  {
    id:          "customers",
    title:       "Customers Report",
    description: "Patient registrations, active buyers, and daily new patient acquisition trend.",
    icon:        Users,
    iconColor:   "var(--color-primary)",
    iconBg:      "var(--color-primary-light)",
    linkColor:   "var(--color-primary)",
  },
  {
    id:          "coupons",
    title:       "Coupons Report",
    description: "Coupon usage rate, top codes by redemptions, and all-time discount summary.",
    icon:        Tag,
    iconColor:   "var(--color-error)",
    iconBg:      "var(--color-error-light)",
    linkColor:   "var(--color-error)",
  },
] as const;

export default function ReportsIndexPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)]"
          style={{ background: "var(--color-primary-light)" }}
        >
          <BarChart3 size={22} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Reports</h1>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-0.5">
            Select a report to view detailed analytics
          </p>
        </div>
      </div>

      {/* Report cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {REPORTS.map(({ id, title, description, icon: Icon, iconColor, iconBg, linkColor }) => (
          <Link
            key={id}
            href={`/reports/${id}`}
            className="group bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 flex flex-col hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)] transition-all duration-[var(--transition-base)]"
          >
            {/* Icon */}
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] mb-4 shrink-0"
              style={{ background: iconBg }}
            >
              <Icon size={22} style={{ color: iconColor }} />
            </div>

            {/* Title */}
            <h3
              className="text-[var(--font-size-md)] font-semibold mb-2 group-hover:underline"
              style={{ color: linkColor }}
            >
              {title}
            </h3>

            {/* Description */}
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] leading-relaxed flex-1 mb-5">
              {description}
            </p>

            {/* CTA link */}
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

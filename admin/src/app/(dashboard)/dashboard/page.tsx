import { PageHeader } from "@/components/common/PageHeader";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="MediSyn administration overview"
      />
      <p className="text-[var(--color-text-muted)]">
        Phase 2 will add metrics, charts, and live activity here.
      </p>
    </div>
  );
}

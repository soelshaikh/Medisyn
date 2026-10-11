"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, LayoutGrid } from "lucide-react";
import { platformApi } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

export default function PlansPage() {
  const { data: plans, isLoading, isError } = useQuery({
    queryKey: ["platform-plans"],
    queryFn:  platformApi.plans,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Subscription Plans"
          description="Manage the plans available to facilities on the platform"
        />
        <Button asChild>
          <Link href="/platform/plans/new">
            <Plus size={15} className="mr-1.5" />New Plan
          </Link>
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}
      {isError   && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">Could not load plans.</p>}

      {plans && (
        <>
          {plans.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
              <LayoutGrid size={36} className="text-[var(--color-text-muted)]" />
              <div>
                <p className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">No plans yet</p>
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-1">
                  Run <code className="bg-[var(--color-surface)] px-1.5 py-0.5 rounded text-[var(--font-size-xs)]">npm run db:seed:plans</code> to seed default plans, or create one manually.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/platform/plans/new"><Plus size={14} className="mr-1" />Create plan</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] truncate">
                        {plan.name}
                      </p>
                      <code className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {plan.key}
                      </code>
                    </div>
                    <Badge variant={plan.isActive ? "success" : "default"} dot>
                      {plan.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {plan.description && (
                    <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] line-clamp-2">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-auto pt-2">
                    <Link
                      href={`/platform/plans/${plan.id}`}
                      className="text-[var(--font-size-sm)] text-[var(--color-primary)] hover:underline font-medium"
                    >
                      Manage plan →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

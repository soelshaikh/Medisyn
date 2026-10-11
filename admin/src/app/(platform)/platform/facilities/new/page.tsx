"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { platformApi } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

export default function NewFacilityPage() {
  const router = useRouter();
  const [name,   setName]   = useState("");
  const [slug,   setSlug]   = useState("");
  const [prefix, setPrefix] = useState("");
  const [planId, setPlanId] = useState("");
  const [error,  setError]  = useState("");

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn:  platformApi.plans,
  });

  const create = useMutation({
    mutationFn: () => platformApi.createFacility({ name: name.trim(), slug: slug.trim(), prefix: prefix.trim(), planId }),
    onSuccess: (data) => {
      router.push(`/platform/facilities/${data.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg ?? "Failed to create facility");
    },
  });

  function handleNameChange(v: string) {
    setName(v);
    if (!slug || slug === toSlug(name)) {
      const s = toSlug(v);
      setSlug(s);
      if (!prefix || prefix === toPrefix(toSlug(name))) {
        setPrefix(toPrefix(s));
      }
    }
  }

  function handleSlugChange(v: string) {
    const s = v.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setSlug(s);
    if (!prefix || prefix === toPrefix(toSlug(name))) {
      setPrefix(toPrefix(s));
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/platform/facilities"
          className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <PageHeader title="New Facility" description="Onboard a new pharmacy or clinic" />
      </div>

      {plansLoading && <div className="flex justify-center py-8"><Spinner /></div>}

      {plans && (
        <form
          onSubmit={(e) => { e.preventDefault(); setError(""); create.mutate(); }}
          className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-5"
        >
          <Input
            label="Facility name"
            placeholder="e.g. Maple Leaf Pharmacy"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Slug"
                placeholder="e.g. maple-leaf"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                required
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                Login URL path: <code className="bg-[var(--color-surface)] px-1 rounded">/login/{slug || "…"}</code>
              </p>
            </div>
            <div>
              <Input
                label="Prefix"
                placeholder="e.g. mlp"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8))}
                required
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                2–8 letters, globally unique. Namespaces usernames (e.g. <code className="bg-[var(--color-surface)] px-1 rounded">{prefix || "…"}john</code>).
              </p>
            </div>
          </div>

          <div>
            <Select
              label="Subscription plan *"
              value={planId}
              onChange={(v) => setPlanId(v)}
              placeholder="Select a plan…"
              options={plans
                .filter((p) => p.isActive)
                .map((p) => ({
                  value:       p.id,
                  label:       p.name,
                  description: p.description ?? undefined,
                }))}
            />
            {plans.filter((p) => p.isActive).length === 0 && (
              <p className="mt-1 text-[var(--font-size-xs)] text-[var(--color-warning)]">
                No active plans found. Run <code className="bg-[var(--color-surface)] px-1 rounded">npm run db:seed:plans</code> first.
              </p>
            )}
          </div>

          {error && (
            <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={create.isPending} disabled={!planId || !slug || prefix.length < 2}>
              Create Facility
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/platform/facilities">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toPrefix(slug: string): string {
  return slug.replace(/[^a-z]/g, "").slice(0, 3);
}

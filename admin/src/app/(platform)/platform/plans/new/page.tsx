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
import { Spinner } from "@/components/ui/Spinner";

export default function NewPlanPage() {
  const router = useRouter();

  const [key,         setKey]         = useState("");
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error,       setError]       = useState("");

  const { data: modules, isLoading: modsLoading } = useQuery({
    queryKey: ["platform-modules"],
    queryFn:  platformApi.listModules,
  });

  const create = useMutation({
    mutationFn: () =>
      platformApi.createPlan({
        key:         key.trim(),
        name:        name.trim(),
        description: description.trim() || undefined,
        moduleIds:   Array.from(selectedIds),
      }),
    onSuccess: (data) => {
      router.push(`/platform/plans/${data.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg ?? "Failed to create plan");
    },
  });

  function handleNameChange(v: string) {
    setName(v);
    if (!key || key === toKey(name)) {
      setKey(toKey(v));
    }
  }

  function toggleModule(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/platform/plans"
          className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <PageHeader title="New Plan" description="Create a new subscription plan" />
      </div>

      {modsLoading && <div className="flex justify-center py-8"><Spinner /></div>}

      {modules && (
        <form
          onSubmit={(e) => { e.preventDefault(); setError(""); create.mutate(); }}
          className="space-y-5"
        >
          {/* Plan details */}
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-4">
            <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Plan details</h2>

            <Input
              label="Plan name"
              placeholder="e.g. Professional"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />

            <div>
              <Input
                label="Plan key"
                placeholder="e.g. professional"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                required
              />
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                Unique identifier — lowercase letters, numbers and underscores. Cannot be changed.
              </p>
            </div>

            <div>
              <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
                Description <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Brief description shown when assigning this plan to a facility…"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Module assignment */}
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Included modules</h2>
              <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                {selectedIds.size} / {modules.length} selected
              </span>
            </div>

            <div className="space-y-2">
              {modules.map((mod) => {
                const checked = selectedIds.has(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={[
                      "flex items-start gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors",
                      checked
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                        : "border-[var(--color-border)] hover:bg-[var(--color-surface)]",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(mod.id)}
                      className="mt-0.5 w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">{mod.name}</p>
                      {mod.description && (
                        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5">{mod.description}</p>
                      )}
                      <code className="text-[10px] text-[var(--color-text-muted)]">{mod.key}</code>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {error && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" loading={create.isPending}>
              Create Plan
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/platform/plans">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function toKey(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

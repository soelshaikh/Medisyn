"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { platformApi } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: plan, isLoading, isError } = useQuery({
    queryKey: ["platform-plan", id],
    queryFn:  () => platformApi.getPlan(id),
    enabled:  !!id,
  });

  const { data: allModules } = useQuery({
    queryKey: ["platform-modules"],
    queryFn:  platformApi.listModules,
    enabled:  !!id,
  });

  // ── Details form state ──
  const [name,        setName]        = useState<string | undefined>();
  const [description, setDescription] = useState<string | undefined>();
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsErr,   setDetailsErr]   = useState("");

  // ── Modules form state ──
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [modulesDirty, setModulesDirty] = useState(false);
  const [modulesSaved, setModulesSaved] = useState(false);
  const [modulesErr,   setModulesErr]   = useState("");

  // Initialise module selection from loaded plan
  useEffect(() => {
    if (plan) {
      setSelectedIds(new Set(plan.modules.map((m) => m.id)));
    }
  }, [plan]);

  const updateDetails = useMutation({
    mutationFn: () =>
      platformApi.updatePlan(id, {
        name:        name?.trim(),
        description: description?.trim() ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-plan", id] });
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 2500);
      setName(undefined);
      setDescription(undefined);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setDetailsErr(msg ?? "Update failed");
    },
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => platformApi.updatePlan(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-plan", id] });
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
    },
  });

  const saveModules = useMutation({
    mutationFn: () => platformApi.setPlanModules(id, Array.from(selectedIds)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-plan", id] });
      setModulesDirty(false);
      setModulesSaved(true);
      setTimeout(() => setModulesSaved(false), 2500);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setModulesErr(msg ?? "Failed to save modules");
    },
  });

  function toggleModule(modId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
    setModulesDirty(true);
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (isError || !plan) return <p className="text-[var(--color-error)]">Plan not found.</p>;

  const displayName        = name        ?? plan.name;
  const displayDescription = description ?? plan.description ?? "";
  const hasDetailChanges   = name !== undefined || description !== undefined;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/platform/plans"
          className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <PageHeader title={plan.name} description={`key: ${plan.key}`} />
        <Badge variant={plan.isActive ? "success" : "default"} dot className="ml-auto shrink-0">
          {plan.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-5">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Plan details</h2>

        <Input
          label="Name"
          value={displayName}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Key</label>
          <code className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            {plan.key}
          </code>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Key cannot be changed after creation</p>
        </div>

        <div>
          <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Description</label>
          <textarea
            value={displayDescription}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-[var(--font-size-sm)]">
          <div>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide font-medium mb-0.5">Facilities on this plan</p>
            <p className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <Building2 size={14} className="text-[var(--color-primary)]" />
              {plan.facilityCount}
            </p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide font-medium mb-0.5">Created</p>
            <p className="font-semibold text-[var(--color-text-primary)]">
              {new Date(plan.createdAt).toLocaleDateString("en-CA")}
            </p>
          </div>
        </div>

        {detailsErr && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{detailsErr}</p>}
        {detailsSaved && <p className="text-[var(--font-size-sm)] text-[var(--color-success)]">Saved.</p>}

        <Button
          disabled={!hasDetailChanges}
          loading={updateDetails.isPending}
          onClick={() => { setDetailsErr(""); updateDetails.mutate(); }}
        >
          Save changes
        </Button>
      </div>

      {/* Module assignment */}
      {allModules && (
        <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Included modules</h2>
            <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
              {selectedIds.size} / {allModules.length}
            </span>
          </div>

          <div className="space-y-2">
            {allModules.map((mod) => {
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

          {modulesErr && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{modulesErr}</p>}
          {modulesSaved && <p className="text-[var(--font-size-sm)] text-[var(--color-success)]">Modules saved.</p>}

          <Button
            disabled={!modulesDirty}
            loading={saveModules.isPending}
            onClick={() => { setModulesErr(""); saveModules.mutate(); }}
          >
            Save modules
          </Button>
        </div>
      )}

      {/* Status management */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-4">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Plan status</h2>
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          Inactive plans cannot be assigned to new facilities. Existing facilities on this plan are unaffected.
          {plan.facilityCount > 0 && (
            <span className="text-[var(--color-warning)]">
              {" "}This plan is currently assigned to <strong>{plan.facilityCount}</strong> {plan.facilityCount === 1 ? "facility" : "facilities"}.
            </span>
          )}
        </p>
        {plan.isActive ? (
          <Button
            size="sm"
            variant="outline"
            loading={toggleActive.isPending}
            onClick={() => toggleActive.mutate(false)}
          >
            Deactivate plan
          </Button>
        ) : (
          <Button
            size="sm"
            loading={toggleActive.isPending}
            onClick={() => toggleActive.mutate(true)}
          >
            Activate plan
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Info } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { emailTriggersApi, type EmailTriggerConfig } from "@/api/email-triggers.api";

const MODULE_LABELS: Record<string, string> = {
  "orders":          "Orders",
  "prescriptions":   "Prescriptions",
  "compounding":     "Compounding",
  "appointments":    "Appointments",
  "ask-pharmacist":  "Ask Pharmacist",
};

const RECIPIENT_LABELS: Record<string, string> = {
  customer:       "Customer",
  assigned_staff: "Assigned Staff",
  admin_team:     "Admin Team",
};

function formatStatus(s: string | null) {
  if (!s || s === "*") return "Any";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function TriggerRow({ trigger }: { trigger: EmailTriggerConfig }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (enabled: boolean) => emailTriggersApi.update(trigger._id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-triggers"] }),
  });

  return (
    <div className={[
      "flex items-start gap-4 py-3 px-4 rounded-[var(--radius-md)] transition-colors",
      trigger.enabled
        ? "bg-[var(--color-success-light)] border border-[var(--color-success)]/20"
        : "bg-[var(--color-surface)] border border-[var(--color-border)]",
    ].join(" ")}>

      {/* Toggle */}
      <button
        type="button"
        onClick={() => mut.mutate(!trigger.enabled)}
        disabled={mut.isPending}
        className={[
          "relative mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors duration-[var(--transition-base)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1",
          trigger.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]",
        ].join(" ")}
        aria-label={trigger.enabled ? "Disable" : "Enable"}
      >
        <span className={[
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-[var(--transition-base)]",
          trigger.enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")} />
      </button>

      {/* Transition label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[var(--font-size-xs)] font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)]">
            {formatStatus(trigger.fromStatus)}
          </span>
          <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">→</span>
          <span className="text-[var(--font-size-xs)] font-mono bg-[var(--color-primary-light)] border border-[var(--color-primary)]/20 rounded px-1.5 py-0.5 text-[var(--color-primary-dark)]">
            {formatStatus(trigger.toStatus)}
          </span>
        </div>
        {trigger.description && (
          <p className="mt-1 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{trigger.description}</p>
        )}
        <div className="mt-1 flex gap-1 flex-wrap">
          {trigger.recipientTypes.map((r) => (
            <span key={r} className="text-[var(--font-size-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-2 py-0.5 text-[var(--color-text-secondary)]">
              {RECIPIENT_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      </div>

      {/* Template key */}
      <span className="shrink-0 text-[var(--font-size-xs)] font-mono text-[var(--color-text-muted)] hidden sm:block">
        {trigger.templateKey}
      </span>
    </div>
  );
}

function ModuleSection({ module, triggers }: { module: string; triggers: EmailTriggerConfig[] }) {
  const enabledCount = triggers.filter((t) => t.enabled).length;
  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-[var(--color-primary)]" />
          <h3 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">
            {MODULE_LABELS[module] ?? module}
          </h3>
        </div>
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {enabledCount} / {triggers.length} active
        </span>
      </div>
      <div className="p-3 space-y-2">
        {triggers.map((t) => <TriggerRow key={t._id} trigger={t} />)}
      </div>
    </div>
  );
}

export default function EmailTriggersPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["email-triggers"],
    queryFn:  () => emailTriggersApi.list(),
  });

  const grouped = data.reduce<Record<string, EmailTriggerConfig[]>>((acc, t) => {
    (acc[t.module] ??= []).push(t);
    return acc;
  }, {});

  const moduleOrder = ["orders","prescriptions","compounding","appointments","ask-pharmacist"];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Email Trigger Configuration"
        description="Control which status transitions send emails to customers. System emails (verification, password reset) are always sent and cannot be disabled here."
      />

      <div className="flex items-start gap-2 px-4 py-3 bg-[var(--color-info-light)] border border-[var(--color-info)]/30 rounded-[var(--radius-md)] text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
        <Info size={14} className="text-[var(--color-info)] mt-0.5 shrink-0" />
        <span>Toggling a trigger takes effect immediately — no restart required. Changes apply to new transitions only.</span>
      </div>

      {isLoading && (
        <div className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] py-8 text-center">Loading…</div>
      )}

      {error && (
        <div className="text-[var(--font-size-sm)] text-[var(--color-error)] py-4">Failed to load email trigger configuration.</div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {moduleOrder
            .filter((m) => grouped[m]?.length)
            .map((m) => (
              <ModuleSection key={m} module={m} triggers={grouped[m]} />
            ))}
        </div>
      )}
    </div>
  );
}

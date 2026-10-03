"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Tag, Zap, Hash, Calendar, User, Shield } from "lucide-react";
import { compoundingApi } from "@/api/compounding.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusHistory } from "@/components/common/StatusHistory";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AdminThreadPanel } from "@/components/common/AdminThreadPanel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { SecureDocumentLink } from "@/components/common/SecureDocumentLink";
import { Select } from "@/components/ui/Select";
import { fmtDate } from "@/lib/format";
import { useAdminAuthStore } from "@/stores/adminAuthStore";

const COMPOUNDING_TRANSITIONS: Record<string, Array<{ to: string; permission: string }>> = {
  submitted:     [
    { to: "reviewing",     permission: "compounding.status.update" },
    { to: "cancelled",     permission: "compounding.status.update" },
  ],
  reviewing:     [
    { to: "quote_sent",    permission: "compounding.status.update" },
    { to: "cancelled",     permission: "compounding.status.update" },
  ],
  quote_sent:    [
    { to: "approved",      permission: "compounding.status.approve" },
    { to: "cancelled",     permission: "compounding.status.update" },
  ],
  approved:      [
    { to: "in_production", permission: "compounding.status.update" },
    { to: "cancelled",     permission: "compounding.status.update" },
  ],
  in_production: [
    { to: "ready",         permission: "compounding.status.complete" },
    { to: "cancelled",     permission: "compounding.status.update" },
  ],
  ready: [
    { to: "delivered",     permission: "compounding.status.complete" },
  ],
};

function InfoRow({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[var(--font-size-sm)]">
      <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
      <span className="text-[var(--color-text-secondary)] truncate">{value ?? "—"}</span>
    </div>
  );
}

export default function CompoundingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }            = use(params);
  const qc                = useQueryClient();
  const { hasPermission } = useAdminAuthStore();
  const [statusModal, setStatusModal] = useState(false);
  const [noteModal,   setNoteModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [statusNote,  setStatusNote]  = useState("");
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [quoteNote,   setQuoteNote]   = useState("");
  const [noteText,    setNoteText]    = useState("");

  const { data: req, isLoading } = useQuery({
    queryKey: ["admin-compounding", id],
    queryFn:  () => compoundingApi.getById(id),
  });

  const statusMut = useMutation({
    mutationFn: () => compoundingApi.updateStatus(
      id, newStatus, statusNote,
      quoteAmount !== "" ? Math.round(Number(quoteAmount) * 100) : null,
      quoteNote,
    ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-compounding", id] }); setStatusModal(false); setQuoteAmount(""); setQuoteNote(""); setStatusNote(""); },
  });

  const noteMut = useMutation({
    mutationFn: () => compoundingApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-compounding", id] }); setNoteModal(false); setNoteText(""); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!req)      return <p className="text-[var(--color-text-muted)]">Request not found.</p>;

  const availableTransitions = (COMPOUNDING_TRANSITIONS[req.status] ?? []).filter((t) => hasPermission(t.permission));
  const canUpdateStatus = availableTransitions.length > 0;

  function openStatusModal() {
    setNewStatus(availableTransitions[0]?.to ?? "");
    setStatusModal(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={req.medicationName}
        description={`${req.form} · ${req.strength || "—"} · qty ${req.quantity}`}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} />
            <Button variant="outline" size="sm" onClick={openStatusModal} disabled={!canUpdateStatus}>
              Update Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Add Note
            </Button>
          </div>
        }
      />

      <div className="flex gap-5 items-start">
        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Compounding details + Prescriber side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-4 py-3 space-y-2">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Compounding Details</p>
              <div className="space-y-1.5">
                <InfoRow icon={<FileText size={13} />} value={req.medicationName} />
                <InfoRow icon={<Tag size={13} />}      value={req.form} />
                <InfoRow icon={<Zap size={13} />}      value={req.strength || "—"} />
                <InfoRow icon={<Hash size={13} />}     value={`Qty: ${req.quantity}`} />
                <InfoRow icon={<Calendar size={13} />} value={fmtDate(req.createdAt)} />
              </div>
            </div>

            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-4 py-3 space-y-2">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Prescriber</p>
              <div className="space-y-1.5">
                <InfoRow icon={<User size={13} />}   value={req.prescriberName} />
                <InfoRow icon={<Shield size={13} />} value={req.prescriberLicense} />
              </div>
            </div>
          </div>

          {/* Quote */}
          {(req.quoteAmount !== null || req.quoteNote) && (
            <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-[var(--radius-lg)] px-4 py-3">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-1">Quote</p>
              {req.quoteAmount !== null && (
                <p className="text-xl font-bold text-[var(--color-text-primary)]">${(req.quoteAmount / 100).toFixed(2)} CAD</p>
              )}
              {req.quoteNote && (
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] mt-1">{req.quoteNote}</p>
              )}
            </div>
          )}

          {/* Patient notes */}
          {req.notes && (
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Patient Notes</p>
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{req.notes}</p>
            </div>
          )}

          {/* Attached document */}
          {req.fileUrl && (
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3 flex items-center gap-3">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Attached Document</p>
              <SecureDocumentLink fileUrl={req.fileUrl} label="View Document" />
            </div>
          )}

          {/* Status history */}
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-5 py-4">
            <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)] mb-3">Status History</h2>
            <StatusHistory history={req.statusHistory} />
          </div>
        </div>

        {/* ── Right column: thread ── */}
        <div className="w-[380px] shrink-0 sticky top-4">
          <AdminThreadPanel entityType="compounding" entityId={id} defaultOpen />
        </div>
      </div>

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Compounding Status">
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onChange={(v) => setNewStatus(v)}
            options={availableTransitions.map((t) => ({
              value: t.to,
              label: t.to.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            }))}
          />
          {(newStatus === "quote_sent" || newStatus === "approved") && (
            <>
              <Input
                label="Quote Amount (CAD)"
                type="text"
                inputMode="decimal"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 49.99"
              />
              <div>
                <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Quote Note</label>
                <textarea
                  value={quoteNote}
                  onChange={(e) => setQuoteNote(e.target.value)}
                  rows={2}
                  placeholder="Optional note about the quote…"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Note (optional)</label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={2}
              placeholder="Reason or update for this status change…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button loading={statusMut.isPending} onClick={() => statusMut.mutate()}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Add Internal Note">
        <div className="space-y-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="Internal note (not visible to patient)…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setNoteModal(false)}>Cancel</Button>
            <Button loading={noteMut.isPending} disabled={!noteText.trim()} onClick={() => noteMut.mutate()}>Add Note</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { compoundingApi } from "@/api/compounding.api";
import { DetailCard } from "@/components/common/DetailCard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusHistory } from "@/components/common/StatusHistory";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { SecureDocumentLink } from "@/components/common/SecureDocumentLink";
import { Select } from "@/components/ui/Select";
import { fmtDate } from "@/lib/format";

const COMPOUNDING_STATUSES = [
  "submitted", "reviewing", "quote_sent", "approved", "in_production", "ready", "delivered", "cancelled",
];

export default function CompoundingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
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
      id,
      newStatus,
      statusNote,
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

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={req.medicationName}
        description={`${req.form} · ${req.strength || "—"} · qty ${req.quantity}`}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} />
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(req.status); setStatusModal(true); }}>
              Update Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Add Note
            </Button>
          </div>
        }
      />

      <DetailCard
        title="Compounding Details"
        cols={2}
        fields={[
          { label: "Medication",  value: req.medicationName },
          { label: "Form",        value: req.form },
          { label: "Strength",    value: req.strength || "—" },
          { label: "Quantity",    value: req.quantity },
          { label: "Submitted",   value: fmtDate(req.createdAt) },
          { label: "Status",      value: <StatusBadge status={req.status} /> },
        ]}
      />

      <DetailCard
        title="Prescriber"
        fields={[
          { label: "Name",      value: req.prescriberName },
          { label: "License #", value: req.prescriberLicense },
        ]}
      />

      {(req.quoteAmount !== null || req.quoteNote) && (
        <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-[var(--radius-lg)] px-5 py-4">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-1">Quote</p>
          {req.quoteAmount !== null && (
            <p className="text-xl font-bold text-[var(--color-text-primary)]">${(req.quoteAmount / 100).toFixed(2)} CAD</p>
          )}
          {req.quoteNote && (
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] mt-1">{req.quoteNote}</p>
          )}
        </div>
      )}

      {req.notes && (
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-5 py-4">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Patient Notes</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{req.notes}</p>
        </div>
      )}

      {req.fileUrl && (
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-5 py-4 flex items-center gap-3">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Attached Document</p>
          <SecureDocumentLink fileUrl={req.fileUrl} label="View Document" />
        </div>
      )}

      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-4">Status History</h2>
        <StatusHistory history={req.statusHistory} />
      </div>

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Compounding Status">
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onChange={(v) => setNewStatus(v)}
            options={COMPOUNDING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
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

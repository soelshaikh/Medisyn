"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prescriptionsApi } from "@/api/prescriptions.api";
import { DetailCard } from "@/components/common/DetailCard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusHistory } from "@/components/common/StatusHistory";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { fmtDate } from "@/lib/format";
import { AdminThreadPanel } from "@/components/common/AdminThreadPanel";
import { useAdminAuthStore } from "@/stores/adminAuthStore";

/** Forward-only transitions for each prescription status, with required permission per move. */
const RX_TRANSITIONS: Record<string, Array<{ to: string; permission: string }>> = {
  submitted: [
    { to: "received",  permission: "prescriptions.status.update" },
    { to: "cancelled", permission: "prescriptions.status.update" },
  ],
  received: [
    { to: "verified",  permission: "prescriptions.status.verify" },
    { to: "cancelled", permission: "prescriptions.status.update" },
  ],
  verified: [
    { to: "dispensed", permission: "prescriptions.status.dispense" },
    { to: "cancelled", permission: "prescriptions.status.update" },
  ],
};

export default function PrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }           = use(params);
  const qc               = useQueryClient();
  const { hasPermission } = useAdminAuthStore();
  const [statusModal, setStatusModal] = useState(false);
  const [noteModal,   setNoteModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [statusNote,  setStatusNote]  = useState("");
  const [noteText,    setNoteText]    = useState("");

  const { data: rx, isLoading } = useQuery({
    queryKey: ["admin-prescription", id],
    queryFn:  () => prescriptionsApi.getById(id),
  });

  const statusMut = useMutation({
    mutationFn: () => prescriptionsApi.updateStatus(id, newStatus, statusNote),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-prescription", id] }); setStatusModal(false); setStatusNote(""); },
  });

  const noteMut = useMutation({
    mutationFn: () => prescriptionsApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-prescription", id] }); setNoteModal(false); setNoteText(""); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!rx)       return <p className="text-[var(--color-text-muted)]">Prescription not found.</p>;

  const availableTransitions = (RX_TRANSITIONS[rx.status] ?? [])
    .filter((t) => hasPermission(t.permission));
  const canUpdateStatus = availableTransitions.length > 0;

  function openStatusModal() {
    const first = availableTransitions[0]?.to ?? "";
    setNewStatus(first);
    setStatusModal(true);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={rx.medicationName}
        description={rx.prescriptionNumber}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={rx.status} />
            <Button variant="outline" size="sm" onClick={openStatusModal} disabled={!canUpdateStatus}>
              Update Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Add Note
            </Button>
          </div>
        }
      />

      <DetailCard
        title="Prescription Details"
        cols={2}
        fields={[
          { label: "Rx Number",          value: rx.prescriptionNumber },
          { label: "Medication",         value: rx.medicationName },
          { label: "Dosage",             value: rx.dosage || "—" },
          { label: "Refills Remaining",  value: rx.refillsRemaining },
          { label: "Expires",            value: rx.expiresAt ? fmtDate(rx.expiresAt) : "No expiry" },
          { label: "Added",              value: fmtDate(rx.createdAt) },
        ]}
      />

      <DetailCard
        title="Prescriber"
        fields={[
          { label: "Name",          value: rx.prescriberName },
          { label: "License #",     value: rx.prescriberLicense || "—" },
          { label: "Phone",         value: rx.prescriberPhone || "—" },
        ]}
      />

      {rx.notes && (
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-5 py-4">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Patient Notes</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{rx.notes}</p>
        </div>
      )}

      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-4">Status History</h2>
        <StatusHistory history={rx.statusHistory} />
      </div>

      <AdminThreadPanel entityType="prescription" entityId={id} />

      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Prescription Status">
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
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Note (optional)</label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              placeholder="Reason for status change…"
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

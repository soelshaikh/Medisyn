"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clinicsApi } from "@/api/clinics.api";
import { DetailCard } from "@/components/common/DetailCard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { fmtDate } from "@/lib/format";

const CLINIC_STATUSES = ["active", "approved", "rejected", "suspended", "deactivated"];

export default function ClinicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const qc      = useQueryClient();
  const [statusModal, setStatusModal] = useState(false);
  const [noteModal,   setNoteModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [noteText,    setNoteText]    = useState("");

  const { data: clinic, isLoading } = useQuery({
    queryKey: ["admin-clinic", id],
    queryFn:  () => clinicsApi.getById(id),
  });

  const statusMut = useMutation({
    mutationFn: () => clinicsApi.updateStatus(id, newStatus),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-clinic", id] }); setStatusModal(false); },
  });

  const noteMut = useMutation({
    mutationFn: () => clinicsApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-clinic", id] }); setNoteModal(false); setNoteText(""); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!clinic)   return <p className="text-[var(--color-text-muted)]">Clinic not found.</p>;

  const p = clinic.profile;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={p?.clinicName ?? clinic.fullName}
        description={clinic.email}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={clinic.status} />
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(clinic.status); setStatusModal(true); }}>
              Change Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Add Note
            </Button>
          </div>
        }
      />

      <DetailCard
        title="Account"
        fields={[
          { label: "Full Name",    value: clinic.fullName },
          { label: "Email",        value: clinic.email },
          { label: "Phone",        value: clinic.phone },
          { label: "Status",       value: <StatusBadge status={clinic.status} /> },
          { label: "Verified",     value: clinic.emailVerified ? "Yes" : "No" },
          { label: "Joined",       value: fmtDate(clinic.createdAt) },
        ]}
      />

      {p && (
        <DetailCard
          title="Clinic Profile"
          cols={2}
          fields={[
            { label: "Clinic Name",     value: p.clinicName },
            { label: "Contact Name",    value: p.contactName },
            { label: "Phone",           value: p.clinicPhone },
            { label: "License #",       value: p.licenseNumber },
            { label: "Address",         value: p.clinicAddress },
            { label: "Website",         value: p.website || "—" },
          ]}
        />
      )}

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change Clinic Status">
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onChange={(v) => setNewStatus(v)}
            options={CLINIC_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button loading={statusMut.isPending} onClick={() => statusMut.mutate()}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Note modal */}
      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Add Internal Note">
        <div className="space-y-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="Internal note (not visible to clinic)…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setNoteModal(false)}>Cancel</Button>
            <Button loading={noteMut.isPending} disabled={!noteText.trim()} onClick={() => noteMut.mutate()}>
              Add Note
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { partnersApi } from "@/api/partners.api";
import { DetailCard } from "@/components/common/DetailCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowLeft } from "lucide-react";

const PARTNER_STATUSES = ["active", "approved", "rejected", "suspended", "deactivated"];

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const qc      = useQueryClient();
  const router  = useRouter();
  const [statusModal, setStatusModal] = useState(false);
  const [noteModal,   setNoteModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [noteText,    setNoteText]    = useState("");

  const { data: partner, isLoading } = useQuery({
    queryKey: ["admin-partner", id],
    queryFn:  () => partnersApi.getById(id),
  });

  const statusMut = useMutation({
    mutationFn: () => partnersApi.updateStatus(id, newStatus),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-partner", id] }); setStatusModal(false); },
  });

  const noteMut = useMutation({
    mutationFn: () => partnersApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-partner", id] }); setNoteModal(false); setNoteText(""); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!partner)  return <p className="text-[var(--color-text-muted)]">Partner not found.</p>;

  const p = partner.profile;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {p?.companyName ?? partner.fullName}
            </h1>
            <StatusBadge status={partner.status} />
          </div>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-1">{partner.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setNewStatus(partner.status); setStatusModal(true); }}>
            Change Status
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
            Add Note
          </Button>
        </div>
      </div>

      <DetailCard
        title="Account"
        fields={[
          { label: "Full Name",    value: partner.fullName },
          { label: "Email",        value: partner.email },
          { label: "Phone",        value: partner.phone },
          { label: "Status",       value: <StatusBadge status={partner.status} /> },
          { label: "Verified",     value: partner.emailVerified ? "Yes" : "No" },
          { label: "Joined",       value: new Date(partner.createdAt).toLocaleDateString("en-CA") },
        ]}
      />

      {p && (
        <DetailCard
          title="Partner Profile"
          cols={2}
          fields={[
            { label: "Company Name",  value: p.companyName },
            { label: "Contact Name",  value: p.contactName },
            { label: "Phone",         value: p.phone },
            { label: "License #",     value: p.licenseNumber },
            { label: "Address",       value: p.address },
            { label: "Website",       value: p.website || "—" },
          ]}
        />
      )}

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change Partner Status">
        <div className="space-y-4">
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)]"
          >
            {PARTNER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
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
            placeholder="Internal note (not visible to partner)…"
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

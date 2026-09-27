"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import { DetailCard } from "@/components/common/DetailCard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusHistory } from "@/components/common/StatusHistory";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { MessageCircle } from "lucide-react";
import { SecureDocumentLink } from "@/components/common/SecureDocumentLink";
import { Select } from "@/components/ui/Select";
import { fmtDate, fmtDateTime } from "@/lib/format";

const ASK_STATUSES = ["open", "answered", "closed"];

export default function AskPharmacistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const [respondModal, setRespondModal] = useState(false);
  const [statusModal,  setStatusModal]  = useState(false);
  const [noteModal,    setNoteModal]    = useState(false);
  const [responseText, setResponseText] = useState("");
  const [newStatus,    setNewStatus]    = useState("");
  const [statusNote,   setStatusNote]   = useState("");
  const [noteText,     setNoteText]     = useState("");

  const { data: ask, isLoading } = useQuery({
    queryKey: ["admin-ask", id],
    queryFn:  () => askPharmacistApi.getById(id),
  });

  const respondMut = useMutation({
    mutationFn: () => askPharmacistApi.respond(id, responseText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-ask", id] }); setRespondModal(false); setResponseText(""); },
  });

  const statusMut = useMutation({
    mutationFn: () => askPharmacistApi.updateStatus(id, newStatus, statusNote),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-ask", id] }); setStatusModal(false); setStatusNote(""); },
  });

  const noteMut = useMutation({
    mutationFn: () => askPharmacistApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-ask", id] }); setNoteModal(false); setNoteText(""); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!ask)      return <p className="text-[var(--color-text-muted)]">Question not found.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={ask.subject}
        description={`Asked ${fmtDate(ask.createdAt)}`}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={ask.status} />
            {ask.status === "open" && (
              <Button size="sm" onClick={() => setRespondModal(true)}>
                <MessageCircle size={14} className="mr-1.5" />
                Respond
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(ask.status); setStatusModal(true); }}>
              Change Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Note
            </Button>
          </div>
        }
      />

      {/* Question */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Patient Question</p>
        <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
          {ask.question}
        </p>
        {ask.fileUrl && (
          <SecureDocumentLink fileUrl={ask.fileUrl} className="mt-3" />
        )}
      </div>

      {/* Pharmacist response */}
      {ask.responseText && (
        <div className="bg-[var(--color-primary-light)] rounded-[var(--radius-lg)] border border-[var(--color-primary)] p-6">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-3">Pharmacist Response</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
            {ask.responseText}
          </p>
          {ask.respondedAt && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-2">
              Responded {fmtDateTime(ask.respondedAt)}
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-4">Status History</h2>
        <StatusHistory history={ask.statusHistory} />
      </div>

      {/* Respond modal */}
      <Modal open={respondModal} onClose={() => setRespondModal(false)} title="Respond to Question" width="max-w-2xl">
        <div className="space-y-4">
          <div className="bg-[var(--color-surface)] rounded-[var(--radius-md)] px-4 py-3">
            <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] mb-1">{ask.subject}</p>
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] line-clamp-3">{ask.question}</p>
          </div>
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Your Response</label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={6}
              placeholder="Write your pharmacist response here…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setRespondModal(false)}>Cancel</Button>
            <Button loading={respondMut.isPending} disabled={!responseText.trim()} onClick={() => respondMut.mutate()}>
              Send Response
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change Status">
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onChange={(v) => setNewStatus(v)}
            options={ASK_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
          />
          <textarea
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            rows={2}
            placeholder="Optional note…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
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

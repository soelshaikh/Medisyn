"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ailmentRequestsApi } from "@/api/ailment-requests.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatusHistory } from "@/components/common/StatusHistory";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { AdminThreadPanel } from "@/components/common/AdminThreadPanel";
import { MessageCircle } from "lucide-react";
import type { AdminAilmentRequest } from "@/types/admin";

const AILMENT_STATUSES = ["submitted", "reviewing", "responded", "closed"];

function patientName(r: AdminAilmentRequest) {
  if (typeof r.patientId === "object" && r.patientId !== null) return r.patientId.fullName;
  return "Unknown";
}
function patientEmail(r: AdminAilmentRequest) {
  if (typeof r.patientId === "object" && r.patientId !== null) return r.patientId.email;
  return "";
}
function patientPhone(r: AdminAilmentRequest) {
  if (typeof r.patientId === "object" && r.patientId !== null) return r.patientId.phone ?? "";
  return "";
}

export default function AilmentRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();

  const [respondModal, setRespondModal] = useState(false);
  const [statusModal,  setStatusModal]  = useState(false);
  const [noteModal,    setNoteModal]    = useState(false);
  const [responseText, setResponseText] = useState("");
  const [newStatus,    setNewStatus]    = useState("");
  const [statusNote,   setStatusNote]   = useState("");
  const [noteText,     setNoteText]     = useState("");

  const { data: req, isLoading } = useQuery({
    queryKey: ["admin-ailment-request", id],
    queryFn:  () => ailmentRequestsApi.getById(id),
  });

  const respondMut = useMutation({
    mutationFn: () => ailmentRequestsApi.respond(id, responseText),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin-ailment-request", id] });
      qc.invalidateQueries({ queryKey: ["admin-ailment-requests"] });
      setRespondModal(false);
      setResponseText("");
    },
  });

  const statusMut = useMutation({
    mutationFn: () => ailmentRequestsApi.updateStatus(id, newStatus, statusNote),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin-ailment-request", id] });
      qc.invalidateQueries({ queryKey: ["admin-ailment-requests"] });
      setStatusModal(false);
      setStatusNote("");
    },
  });

  const noteMut = useMutation({
    mutationFn: () => ailmentRequestsApi.addNote(id, noteText),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["admin-ailment-request", id] });
      setNoteModal(false);
      setNoteText("");
    },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!req)      return <p className="text-[var(--color-text-muted)]">Request not found.</p>;

  const canRespond = req.status === "submitted" || req.status === "reviewing";

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={req.ailmentName}
        description={`Submitted ${fmtDate(req.createdAt)}`}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={req.status} />
            {canRespond && (
              <Button size="sm" onClick={() => setRespondModal(true)}>
                <MessageCircle size={14} className="mr-1.5" />
                Respond
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(req.status); setStatusModal(true); }}>
              Change Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Note
            </Button>
          </div>
        }
      />

      {/* Patient info */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Patient</p>
        <p className="font-semibold text-[var(--color-text-primary)]">{patientName(req)}</p>
        {patientEmail(req) && <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{patientEmail(req)}</p>}
        {patientPhone(req) && <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{patientPhone(req)}</p>}
      </div>

      {/* Submitted form data */}
      {Object.keys(req.formData ?? {}).length > 0 && (
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-4">Symptom Information</p>
          <dl className="space-y-3">
            {Object.entries(req.formData).map(([key, val]) => (
              <div key={key} className="grid grid-cols-[200px_1fr] gap-4">
                <dt className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-secondary)] capitalize">
                  {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                </dt>
                <dd className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
                  {Array.isArray(val)
                    ? val.join(", ")
                    : typeof val === "boolean"
                    ? val ? "Yes" : "No"
                    : String(val ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Patient notes */}
      {req.notes && (
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Patient Notes</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">{req.notes}</p>
        </div>
      )}

      {/* Pharmacist response */}
      {req.responseText && (
        <div className="bg-[var(--color-primary-light)] rounded-[var(--radius-lg)] border border-[var(--color-primary)] p-6">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-primary)] mb-3">Pharmacist Response</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">{req.responseText}</p>
          {req.respondedAt && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-2">
              Responded {fmtDateTime(req.respondedAt)}
            </p>
          )}
        </div>
      )}

      {/* Status history */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-4">Status History</h2>
        <StatusHistory history={req.statusHistory} />
      </div>

      <AdminThreadPanel entityType="minor_ailment" entityId={id} />

      {/* Respond modal */}
      <Modal open={respondModal} onClose={() => setRespondModal(false)} title="Respond to Request" width="max-w-2xl">
        <div className="space-y-4">
          <div className="bg-[var(--color-surface)] rounded-[var(--radius-md)] px-4 py-3">
            <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] mb-1">{req.ailmentName}</p>
            {req.notes && (
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] line-clamp-3">{req.notes}</p>
            )}
          </div>
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Pharmacist Response</label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={6}
              placeholder="Write your response to the patient…"
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
            options={AILMENT_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
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
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Internal notes are not visible to the patient.</p>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="Internal note…"
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

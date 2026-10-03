"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Stethoscope, Clock, Calendar, Layers, Users, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { appointmentsApi } from "@/api/appointments.api";
import { StatusHistory } from "@/components/common/StatusHistory";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AdminThreadPanel } from "@/components/common/AdminThreadPanel";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import type { AppointmentSlot, VaccineService } from "@/types/admin";
import { fmtDate, fmtDateTime } from "@/lib/format";

const ADMIN_STATUSES = ["confirmed", "cancelled", "completed", "no_show"];

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[var(--font-size-sm)]">
      <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
      {label && <span className="text-[var(--color-text-muted)] shrink-0 text-[var(--font-size-xs)]">{label}</span>}
      <span className="text-[var(--color-text-secondary)] truncate">{value ?? "—"}</span>
    </div>
  );
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const router = useRouter();
  const [statusModal, setStatusModal] = useState(false);
  const [noteModal,   setNoteModal]   = useState(false);
  const [replyModal,  setReplyModal]  = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [statusNote,  setStatusNote]  = useState("");
  const [noteText,    setNoteText]    = useState("");
  const [replyText,   setReplyText]   = useState("");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["admin-booking", id],
    queryFn:  () => appointmentsApi.getById(id),
  });

  const statusMut = useMutation({
    mutationFn: () => appointmentsApi.updateStatus(id, newStatus, statusNote),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-booking", id] }); setStatusModal(false); setStatusNote(""); },
  });

  const noteMut = useMutation({
    mutationFn: () => appointmentsApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-booking", id] }); setNoteModal(false); setNoteText(""); },
  });

  const replyMut = useMutation({
    mutationFn: () => appointmentsApi.setReply(id, replyText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-booking", id] }); setReplyModal(false); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!booking)  return <p className="text-[var(--color-text-muted)]">Booking not found.</p>;

  const patient  = typeof booking.patientId        === "object" ? booking.patientId        : null;
  const vaccine  = typeof booking.vaccineServiceId === "object" ? booking.vaccineServiceId as VaccineService : null;
  const slot     = typeof booking.slotId           === "object" ? booking.slotId           as AppointmentSlot : null;
  const isPending = booking.status === "pending";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mt-1">
          ←
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {vaccine?.name ?? "Appointment Booking"}
            </h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-1">
            Requested {fmtDateTime(booking.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end shrink-0">
          {isPending && (
            <>
              <Button size="sm" onClick={() => { setNewStatus("confirmed"); setStatusModal(true); }}>
                <CheckCircle size={14} className="mr-1.5" /> Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => { setNewStatus("cancelled"); setStatusModal(true); }}>
                <XCircle size={14} className="mr-1.5" /> Reject
              </Button>
            </>
          )}
          {!isPending && (
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(booking.status); setStatusModal(true); }}>
              Update Status
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setReplyText(booking.adminReply ?? ""); setReplyModal(true); }}>
            <MessageSquare size={14} className="mr-1.5" /> Reply to Patient
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
            Add Note
          </Button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Patient + Appointment side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-4 py-3 space-y-2">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Patient</p>
              <div className="space-y-1.5">
                <InfoRow icon={<User size={13} />}  value={patient?.fullName} />
                <InfoRow icon={<Mail size={13} />}  value={patient?.email} />
                <InfoRow icon={<Phone size={13} />} value={patient?.phone} />
              </div>
            </div>

            <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-4 py-3 space-y-2">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Appointment</p>
              <div className="space-y-1.5">
                <InfoRow icon={<Stethoscope size={13} />} value={vaccine?.name} />
                <InfoRow icon={<Clock size={13} />}       value={vaccine ? `${vaccine.durationMinutes} min` : "—"} />
                <InfoRow icon={<Calendar size={13} />}    value={slot ? fmtDate(slot.date) : "—"} />
                <InfoRow icon={<Clock size={13} />}       value={slot ? `${slot.startTime} – ${slot.endTime}` : "—"} />
                <InfoRow icon={<Layers size={13} />}      value={slot ? (slot.capacityType === "strict" ? "Fixed Capacity" : "Open Capacity") : "—"} />
                <InfoRow icon={<Users size={13} />}       value={slot ? `${slot.bookedCount} / ${slot.capacity} booked` : "—"} />
              </div>
            </div>
          </div>

          {/* Eligibility */}
          {vaccine?.eligibilityNotes && (
            <div className="bg-[var(--color-info-light)] border border-[var(--color-info)] rounded-[var(--radius-lg)] px-4 py-3">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-info)] mb-1">
                Eligibility Requirements
              </p>
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{vaccine.eligibilityNotes}</p>
            </div>
          )}

          {/* Patient notes */}
          {booking.patientNotes && (
            <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Patient Notes</p>
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{booking.patientNotes}</p>
            </div>
          )}

          {/* Admin reply */}
          {booking.adminReply && (
            <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-[var(--radius-lg)] px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  Reply to Patient <span className="normal-case font-normal text-[var(--color-text-muted)]">(visible to patient)</span>
                </p>
                <button
                  onClick={() => { setReplyText(booking.adminReply ?? ""); setReplyModal(true); }}
                  className="text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"
                >
                  Edit
                </button>
              </div>
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] whitespace-pre-wrap">{booking.adminReply}</p>
            </div>
          )}

          {/* Cancellation */}
          {booking.cancelledAt && (
            <div className="bg-[var(--color-error-light)] border border-[var(--color-error)] rounded-[var(--radius-lg)] px-4 py-3">
              <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-error)] mb-1">Cancelled</p>
              <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
                By: {booking.cancelledBy ?? "—"} · {fmtDateTime(booking.cancelledAt)}
              </p>
              {booking.cancellationReason && (
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] mt-1">
                  Reason: {booking.cancellationReason}
                </p>
              )}
            </div>
          )}

          {/* Status history */}
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-5 py-4">
            <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)] mb-3">Status History</h2>
            <StatusHistory history={booking.statusHistory} />
          </div>
        </div>

        {/* ── Right column: thread ── */}
        <div className="w-[380px] shrink-0 sticky top-4">
          <AdminThreadPanel entityType="appointment" entityId={id} defaultOpen />
        </div>
      </div>

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title={isPending ? "Review Booking" : "Update Status"}>
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onChange={(v) => setNewStatus(v)}
            options={ADMIN_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
          />
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Note (optional)</label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              placeholder="Optional note to record with this status change…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button
              loading={statusMut.isPending}
              variant={newStatus === "cancelled" ? "danger" : "primary"}
              onClick={() => statusMut.mutate()}
            >
              {newStatus === "confirmed" ? "Approve Booking" : newStatus === "cancelled" ? "Reject / Cancel" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reply modal */}
      <Modal open={replyModal} onClose={() => setReplyModal(false)} title="Reply to Patient" width="max-w-xl">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            This message will be visible to the patient on their portal.
          </p>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={5}
            placeholder="Write your reply to the patient here…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setReplyModal(false)}>Cancel</Button>
            <Button loading={replyMut.isPending} onClick={() => replyMut.mutate()}>Save Reply</Button>
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

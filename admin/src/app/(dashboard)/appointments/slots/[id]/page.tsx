"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appointmentSlotsApi, appointmentsApi } from "@/api/appointments.api";
import { DetailCard } from "@/components/common/DetailCard";
import { StatusHistory } from "@/components/common/StatusHistory";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Spinner } from "@/components/ui/Spinner";
import { TimePicker } from "@/components/ui/TimePicker";
import { ArrowLeft, Lock, Unlock } from "lucide-react";
import type { AppointmentBooking, VaccineService } from "@/types/admin";
import { fmtDate } from "@/lib/format";

const CAPACITY_OPTIONS = [
  { value: "strict", label: "Strict", description: "Hard cap — blocks bookings when full" },
  { value: "open",   label: "Open",   description: "Soft cap — allows over-requests" },
];

export default function SlotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const qc      = useQueryClient();
  const router  = useRouter();
  const [editModal,   setEditModal]   = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [editForm,    setEditForm]    = useState<{ startTime: string; endTime: string; capacity: string; capacityType: string }>({
    startTime: "", endTime: "", capacity: "", capacityType: "strict",
  });

  const { data: slot, isLoading } = useQuery({
    queryKey: ["admin-slot", id],
    queryFn:  () => appointmentSlotsApi.getById(id),
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-slot-bookings", id],
    queryFn:  () => appointmentsApi.list({ slotId: id, limit: 100 }),
  });

  const editMut = useMutation({
    mutationFn: () => appointmentSlotsApi.update(id, { ...editForm, capacity: Number(editForm.capacity) }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-slot", id] }); setEditModal(false); },
  });

  const cancelMut = useMutation({
    mutationFn: () => appointmentSlotsApi.update(id, { status: "cancelled" }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-slot", id] }); setCancelModal(false); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!slot)     return <p className="text-[var(--color-text-muted)]">Slot not found.</p>;

  const vaccine       = typeof slot.vaccineServiceId === "object" ? slot.vaccineServiceId as VaccineService : null;
  const isStrict      = slot.capacityType === "strict";
  const isFullyBooked = isStrict && slot.bookedCount >= slot.capacity;

  const bookingCols: Column<AppointmentBooking>[] = [
    {
      key: "patient", header: "Patient",
      render: (b) => {
        const p = typeof b.patientId === "object" ? b.patientId : null;
        return (
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">{p?.fullName ?? "—"}</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{p?.email ?? "—"}</p>
          </div>
        );
      },
    },
    { key: "status",  header: "Status", width: "110px", render: (b) => <StatusBadge status={b.status} /> },
    {
      key: "date", header: "Requested", width: "110px",
      render: (b) => <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDate(b.createdAt)}</span>,
    },
    {
      key: "actions", header: "", width: "60px",
      render: (b) => (
        <Link href={`/appointments/bookings/${b._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{vaccine?.name ?? "Appointment Slot"}</h1>
            <StatusBadge status={slot.status} />
            {isFullyBooked && (
              <span className="text-[var(--font-size-xs)] px-2.5 py-1 rounded-[var(--radius-full)] bg-[var(--color-error-light)] text-[var(--color-error)] font-semibold">
                Fully Booked
              </span>
            )}
          </div>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-1">
            {fmtDate(slot.date)}
            {" · "}{slot.startTime} – {slot.endTime}
          </p>
        </div>
        {slot.status === "active" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditForm({ startTime: slot.startTime, endTime: slot.endTime, capacity: String(slot.capacity), capacityType: slot.capacityType });
                setEditModal(true);
              }}
            >
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setCancelModal(true)}>Cancel Slot</Button>
          </div>
        )}
      </div>

      {/* Capacity bar */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isStrict ? <Lock size={14} className="text-[var(--color-error)]" /> : <Unlock size={14} className="text-[var(--color-success)]" />}
            <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">
              {isStrict ? "Strict Capacity" : "Open Capacity"}
            </span>
          </div>
          <span className={["text-2xl font-bold", isFullyBooked ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)]"].join(" ")}>
            {slot.bookedCount} / {slot.capacity}
          </span>
        </div>
        <div className="h-3 bg-[var(--color-surface)] rounded-full overflow-hidden">
          <div
            className={["h-full rounded-full transition-all", isFullyBooked ? "bg-[var(--color-error)]" : "bg-[var(--color-primary)]"].join(" ")}
            style={{ width: `${Math.min(100, (slot.bookedCount / slot.capacity) * 100)}%` }}
          />
        </div>
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-2">
          {isStrict ? "Patients cannot book when this slot is full." : "Patients can still request bookings even when capacity is reached."}
        </p>
      </div>

      <DetailCard
        title="Slot Details"
        cols={3}
        fields={[
          { label: "Vaccine",  value: vaccine?.name },
          { label: "Date",     value: fmtDate(slot.date) },
          { label: "Time",     value: `${slot.startTime} – ${slot.endTime}` },
          { label: "Capacity", value: slot.capacity },
          { label: "Type",     value: slot.capacityType === "strict" ? "Strict" : "Open" },
          { label: "Status",   value: <StatusBadge status={slot.status} /> },
        ]}
      />

      <div className="space-y-3">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">
          Bookings ({bookings?.total ?? 0})
        </h2>
        <DataTable columns={bookingCols} data={bookings?.data ?? []} keyFn={(b) => b._id} emptyTitle="No bookings yet" emptyDescription="No one has booked this slot yet." />
      </div>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Slot">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TimePicker
              label="Start Time"
              value={editForm.startTime}
              onChange={(v) => setEditForm((f) => ({ ...f, startTime: v }))}
            />
            <TimePicker
              label="End Time"
              value={editForm.endTime}
              onChange={(v) => setEditForm((f) => ({ ...f, endTime: v }))}
            />
          </div>
          <NumberInput
            label="Capacity"
            value={editForm.capacity}
            onChange={(v) => setEditForm((f) => ({ ...f, capacity: v }))}
          />
          <Select
            label="Capacity Type"
            value={editForm.capacityType}
            onChange={(v) => setEditForm((f) => ({ ...f, capacityType: v }))}
            options={CAPACITY_OPTIONS}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button loading={editMut.isPending} onClick={() => editMut.mutate()}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel confirm */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Slot">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Are you sure you want to cancel this slot? Existing bookings will not be automatically cancelled — you will need to review them separately.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setCancelModal(false)}>Go Back</Button>
            <Button variant="danger" loading={cancelMut.isPending} onClick={() => cancelMut.mutate()}>Cancel Slot</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

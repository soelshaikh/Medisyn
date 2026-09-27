"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appointmentInterestApi, type AppointmentInterest, type InterestStatus } from "@/api/appointment-interest.api";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/common/StatusBadge";
import { User, Phone, Mail, Syringe, Clock, FileText } from "lucide-react";

const STATUS_OPTIONS: { value: InterestStatus; label: string }[] = [
  { value: "new",       label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "resolved",  label: "Resolved" },
];

function fmt(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default function AppointmentInterestPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [detail,       setDetail]       = useState<AppointmentInterest | null>(null);
  const [newStatus,    setNewStatus]    = useState<InterestStatus>("new");
  const [adminNote,    setAdminNote]    = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["appointment-interest", statusFilter],
    queryFn:  () => appointmentInterestApi.list({ status: statusFilter || undefined }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: InterestStatus; note: string }) =>
      appointmentInterestApi.updateStatus(id, status, note || undefined),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["appointment-interest"] });
      setDetail(null);
    },
    onError: () => toast.error("Failed to update status"),
  });

  function openDetail(r: AppointmentInterest) {
    setDetail(r);
    setNewStatus(r.status);
    setAdminNote("");
  }

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const newCount = rows.filter((r) => r.status === "new").length;

  const columns: Column<AppointmentInterest>[] = [
    {
      key: "patient", header: "Patient",
      render: (r) => (
        <div>
          <p className="font-medium text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
            {r.firstName} {r.lastName}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{r.email}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{r.phone}</p>
        </div>
      ),
    },
    {
      key: "vaccine", header: "Vaccine",
      render: (r) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {r.vaccineServiceName || <span className="italic text-[var(--color-text-muted)]">Not specified</span>}
        </span>
      ),
    },
    {
      key: "preferred", header: "Preferred",
      render: (r) => (
        <div className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {r.preferredDate ? <p>{fmt(r.preferredDate)}</p> : null}
          {r.preferredTime ? <p>{r.preferredTime}</p> : null}
          {!r.preferredDate && !r.preferredTime && <span className="italic">Any</span>}
        </div>
      ),
    },
    {
      key: "status", header: "Status", width: "110px",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "date", header: "Submitted", width: "110px",
      render: (r) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {fmt(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "80px",
      render: (r) => (
        <button
          onClick={() => openDetail(r)}
          className="text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Appointment Interest Requests"
        description={`${total} request${total !== 1 ? "s" : ""}${newCount > 0 ? ` · ${newCount} new` : ""}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["appointment-interest"] })}
        refreshing={isFetching}
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[var(--font-size-sm)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        keyFn={(r) => r._id}
        emptyTitle="No interest requests yet"
        emptyDescription="When patients submit a request due to no available slots, they will appear here."
      />

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Interest Request"
        width="max-w-lg"
      >
        {detail && (
          <div className="space-y-5">
            {/* Patient info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <User size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Name</p>
                  <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                    {detail.firstName} {detail.lastName}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Email</p>
                  <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">{detail.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Phone</p>
                  <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">{detail.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Syringe size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Vaccine</p>
                  <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
                    {detail.vaccineServiceName || <span className="italic text-[var(--color-text-muted)]">Not specified</span>}
                  </p>
                </div>
              </div>
              {(detail.preferredDate || detail.preferredTime) && (
                <div className="col-span-2 flex items-start gap-2">
                  <Clock size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                  <div>
                    <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Preferred time</p>
                    <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
                      {[detail.preferredDate && fmt(detail.preferredDate), detail.preferredTime].filter(Boolean).join(" at ")}
                    </p>
                  </div>
                </div>
              )}
              {detail.notes && (
                <div className="col-span-2 flex items-start gap-2">
                  <FileText size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                  <div>
                    <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Notes</p>
                    <p className="text-[var(--font-size-sm)] text-[var(--color-text-primary)] whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-[var(--color-border)]" />

            {/* Status update */}
            <div className="space-y-3">
              <Select
                label="Update Status"
                value={newStatus}
                onChange={(v) => setNewStatus(v as InterestStatus)}
                options={STATUS_OPTIONS}
              />
              <div>
                <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
                  Internal note <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder="Reason for status change…"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setDetail(null)}>Cancel</Button>
              <Button
                loading={statusMut.isPending}
                onClick={() => statusMut.mutate({ id: detail._id, status: newStatus, note: adminNote })}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

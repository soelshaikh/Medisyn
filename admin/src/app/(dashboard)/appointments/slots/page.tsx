"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { appointmentSlotsApi, vaccineServicesApi } from "@/api/appointments.api";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker, fmt12h } from "@/components/ui/TimePicker";
import { Plus, Lock, Unlock, Eye } from "lucide-react";
import type { AppointmentSlot } from "@/types/admin";
import { fmtDate } from "@/lib/format";

const BLANK = {
  vaccineServiceId: "", date: "", startTime: "09:00", endTime: "11:00",
  capacity: "10", capacityType: "strict" as "strict" | "open",
};

const CAPACITY_OPTIONS = [
  { value: "strict", label: "Strict", description: "Hard cap — blocks new bookings when full" },
  { value: "open",   label: "Open",   description: "Soft cap — allows over-requests" },
];

export default function SlotsPage() {
  const qc = useQueryClient();
  const [page,       setPage]       = useState(1);
  const [filterSvc,  setFilterSvc]  = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form,       setForm]       = useState({ ...BLANK });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-slots", filterSvc, page],
    queryFn:  () => appointmentSlotsApi.list({ vaccineServiceId: filterSvc || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const { data: services } = useQuery({
    queryKey: ["vaccine-services-admin"],
    queryFn:  vaccineServicesApi.listAdmin,
  });

  const createMut = useMutation({
    mutationFn: () => appointmentSlotsApi.create({
      ...form,
      capacity: Number(form.capacity),
      date:     new Date(form.date),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-slots"] }); setCreateOpen(false); setForm({ ...BLANK }); },
  });

  const serviceOptions = (services ?? []).map((s) => ({ value: s._id, label: s.name }));
  const filterOptions  = [{ value: "", label: "All vaccines" }, ...serviceOptions];

  const columns: Column<AppointmentSlot>[] = [
    {
      key: "vaccine", header: "Vaccine",
      render: (s) => (
        <span className="font-semibold text-[var(--color-text-primary)]">
          {typeof s.vaccineServiceId === "object" ? s.vaccineServiceId.name : "—"}
        </span>
      ),
    },
    {
      key: "date", header: "Date & Time",
      render: (s) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">
            {fmtDate(s.date)}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmt12h(s.startTime)} – {fmt12h(s.endTime)}</p>
        </div>
      ),
    },
    {
      key: "capacity", header: "Capacity", width: "130px",
      render: (s) => {
        const full = s.capacityType === "strict" && s.bookedCount >= s.capacity;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
              <div
                className={["h-full rounded-full", full ? "bg-[var(--color-error)]" : "bg-[var(--color-primary)]"].join(" ")}
                style={{ width: `${Math.min(100, (s.bookedCount / s.capacity) * 100)}%` }}
              />
            </div>
            <span className={["text-[var(--font-size-xs)] font-semibold", full ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)]"].join(" ")}>
              {s.bookedCount}/{s.capacity}
            </span>
          </div>
        );
      },
    },
    {
      key: "type", header: "Type", width: "90px",
      render: (s) => (
        <div className="flex items-center gap-1.5">
          {s.capacityType === "strict"
            ? <Lock size={14} className="text-[var(--color-error)]" />
            : <Unlock size={14} className="text-[var(--color-success)]" />}
          <span className={["text-[var(--font-size-xs)] font-semibold capitalize", s.capacityType === "strict" ? "text-[var(--color-error)]" : "text-[var(--color-success)]"].join(" ")}>
            {s.capacityType}
          </span>
        </div>
      ),
    },
    { key: "status", header: "Status", width: "100px", render: (s) => <StatusBadge status={s.status} /> },
    {
      key: "actions", header: "Actions", width: "70px",
      render: (s) => (
        <Link href={`/appointments/slots/${s._id}`} className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit">
          <Eye size={13} /> Manage
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Availability Slots"
        description={`${total.toLocaleString()} slots total`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-slots"] })}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-1.5" /> Create Slot
          </Button>
        }
      />

      {/* Filter */}
      <div className="w-56">
        <Select
          value={filterSvc}
          onChange={(v) => { setFilterSvc(v === "_all" ? "" : v); setPage(1); }}
          options={filterOptions.map((o) => ({ ...o, value: o.value === "" ? "_all" : o.value }))}
          placeholder="All vaccines"
        />
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(s) => s._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Appointment Slot">
        <div className="space-y-4">
          <Select
            label="Vaccine Service"
            value={form.vaccineServiceId}
            onChange={(v) => setForm((f) => ({ ...f, vaccineServiceId: v }))}
            options={[{ value: "", label: "Select a vaccine…", disabled: true }, ...(services ?? []).filter((s) => s.status === "active").map((s) => ({ value: s._id, label: s.name }))]}
            placeholder="Select a vaccine…"
          />

          <DatePicker
            label="Date"
            value={form.date}
            onChange={(v) => setForm((f) => ({ ...f, date: v }))}
            minDate={new Date()}
          />

          <div className="grid grid-cols-2 gap-4">
            <TimePicker
              label="Start Time"
              value={form.startTime}
              onChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
            />
            <TimePicker
              label="End Time"
              value={form.endTime}
              onChange={(v) => setForm((f) => ({ ...f, endTime: v }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Capacity"
              value={form.capacity}
              onChange={(v) => setForm((f) => ({ ...f, capacity: v }))}
              hint="Max bookings for this slot"
              placeholder="10"
            />
            <Select
              label="Capacity Type"
              value={form.capacityType}
              onChange={(v) => setForm((f) => ({ ...f, capacityType: v as "strict" | "open" }))}
              options={CAPACITY_OPTIONS}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={createMut.isPending}
              disabled={!form.vaccineServiceId || !form.date}
              onClick={() => createMut.mutate()}
            >
              Create Slot
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

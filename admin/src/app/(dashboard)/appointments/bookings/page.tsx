"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { appointmentsApi } from "@/api/appointments.api";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { AppointmentBooking, AppointmentSlot, VaccineService } from "@/types/admin";
import { fmtDate } from "@/lib/format";

const STATUSES = ["", "pending", "confirmed", "cancelled", "completed", "no_show"];

function slotLabel(slot: AppointmentSlot | string | undefined) {
  if (!slot || typeof slot === "string") return "—";
  return `${fmtDate(slot.date)} · ${slot.startTime}–${slot.endTime}`;
}

export default function BookingsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-appointments", status, search, page],
    queryFn:  () => appointmentsApi.list({ status: status || undefined, search: search || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AppointmentBooking>[] = [
    {
      key: "patient", header: "Patient",
      render: (b) => {
        const p = typeof b.patientId === "object" ? b.patientId : null;
        return (
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{p?.fullName ?? "—"}</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{p?.email ?? "—"}</p>
          </div>
        );
      },
    },
    {
      key: "vaccine", header: "Vaccine",
      render: (b) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {typeof b.vaccineServiceId === "object" ? b.vaccineServiceId.name : "—"}
        </span>
      ),
    },
    {
      key: "slot", header: "Slot",
      render: (b) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {slotLabel(b.slotId as AppointmentSlot | string)}
        </span>
      ),
    },
    {
      key: "status", header: "Status", width: "120px",
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: "date", header: "Requested", width: "110px",
      render: (b) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {fmtDate(b.createdAt)}
        </span>
      ),
    },
    {
      key: "actions", header: "Actions", width: "70px",
      render: (b) => (
        <Link
          href={`/appointments/bookings/${b._id}`}
          className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit"
        >
          <Eye size={13} /> {b.status === "pending" ? "Review" : "View"}
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  const pendingCount = data?.data.filter((b) => b.status === "pending").length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Appointment Bookings"
        description={
          pendingCount > 0
            ? `${total.toLocaleString()} total · ${pendingCount} pending review`
            : `${total.toLocaleString()} total bookings`
        }
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-appointments"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-64">
              <Input
                placeholder="Search patient name…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                leftIcon={<Search size={14} />}
              />
            </div>
            <div className="w-48">
              <Select
                value={status || "_all"}
                onChange={(v) => { setStatus(v === "_all" ? "" : v); setPage(1); }}
                options={[
                  { value: "_all", label: "All statuses" },
                  ...STATUSES.filter(Boolean).map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })),
                ]}
              />
            </div>
          </>
        }
      />

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(b) => b._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

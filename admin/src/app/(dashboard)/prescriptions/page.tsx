"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { prescriptionsApi } from "@/api/prescriptions.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { AdminPrescription } from "@/types/admin";

const STATUSES = ["", "active", "expired", "cancelled"];

export default function PrescriptionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-prescriptions", search, status, page],
    queryFn:  () => prescriptionsApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminPrescription>[] = [
    {
      key: "rx", header: "Prescription",
      render: (r) => (
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{r.medicationName}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono">{r.prescriptionNumber}</p>
        </div>
      ),
    },
    {
      key: "prescriber", header: "Prescriber",
      render: (r) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{r.prescriberName}</span>
      ),
    },
    {
      key: "dosage", header: "Dosage",
      render: (r) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{r.dosage || "—"}</span>
      ),
    },
    {
      key: "refills", header: "Refills", width: "80px",
      render: (r) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">{r.refillsRemaining}</span>
      ),
    },
    {
      key: "status", header: "Status", width: "110px",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "date", header: "Added", width: "110px",
      render: (r) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {new Date(r.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "60px",
      render: (r) => (
        <Link href={`/prescriptions/${r._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          View
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Prescriptions" description={`${total.toLocaleString()} total`} />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search medication or Rx #…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftIcon={<Search size={14} />}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] bg-white"
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(r) => r._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

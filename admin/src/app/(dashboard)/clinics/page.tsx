"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { clinicsApi } from "@/api/clinics.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { ClinicUser } from "@/types/admin";

const STATUSES = ["", "pending_approval", "approved", "active", "rejected", "suspended"];

export default function ClinicsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-clinics", search, status, page],
    queryFn:  () => clinicsApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<ClinicUser>[] = [
    {
      key: "clinic", header: "Clinic",
      render: (c) => (
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">
            {c.profile?.clinicName ?? c.fullName}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{c.email}</p>
        </div>
      ),
    },
    {
      key: "contact", header: "Contact",
      render: (c) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {c.profile?.contactName ?? "—"}
        </span>
      ),
    },
    {
      key: "phone", header: "Phone",
      render: (c) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {c.profile?.clinicPhone ?? c.phone ?? "—"}
        </span>
      ),
    },
    {
      key: "status", header: "Status", width: "160px",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "joined", header: "Applied", width: "110px",
      render: (c) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {new Date(c.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "60px",
      render: (c) => (
        <Link href={`/clinics/${c._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          Review
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Clinics" description={`${total.toLocaleString()} clinics`} />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search name or email…"
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
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(c) => c._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

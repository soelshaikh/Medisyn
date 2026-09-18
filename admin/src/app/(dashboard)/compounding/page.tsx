"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { compoundingApi } from "@/api/compounding.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { AdminCompoundingRequest } from "@/types/admin";

const STATUSES = ["", "submitted", "reviewing", "quote_sent", "approved", "in_production", "ready", "delivered", "cancelled"];

export default function CompoundingPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-compounding", search, status, page],
    queryFn:  () => compoundingApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminCompoundingRequest>[] = [
    {
      key: "medication", header: "Medication",
      render: (c) => (
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{c.medicationName}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
            {c.form} · {c.strength || "—"} · qty {c.quantity}
          </p>
        </div>
      ),
    },
    {
      key: "prescriber", header: "Prescriber",
      render: (c) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{c.prescriberName}</span>
      ),
    },
    {
      key: "quote", header: "Quote", width: "100px",
      render: (c) => (
        c.quoteAmount !== null
          ? <span className="font-semibold text-[var(--color-text-primary)]">${(c.quoteAmount / 100).toFixed(2)}</span>
          : <span className="text-[var(--color-text-muted)]">—</span>
      ),
    },
    {
      key: "status", header: "Status", width: "130px",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "date", header: "Submitted", width: "110px",
      render: (c) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {new Date(c.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "60px",
      render: (c) => (
        <Link href={`/compounding/${c._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          Review
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Compounding Requests" description={`${total.toLocaleString()} total`} />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search medication…"
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

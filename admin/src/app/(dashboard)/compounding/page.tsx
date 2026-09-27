"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { compoundingApi } from "@/api/compounding.api";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { AdminCompoundingRequest } from "@/types/admin";

const STATUSES = ["", "submitted", "reviewing", "quote_sent", "approved", "in_production", "ready", "delivered", "cancelled"];

export default function CompoundingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
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
          {fmtDate(c.createdAt)}
        </span>
      ),
    },
    {
      key: "actions", header: "Actions", width: "60px",
      render: (c) => (
        <Link href={`/compounding/${c._id}`} className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit">
          <Eye size={13} /> Review
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Compounding Requests"
        description={`${total.toLocaleString()} total`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-compounding"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-56">
              <Input
                placeholder="Search medication…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                leftIcon={<Search size={14} />}
              />
            </div>
            <div className="w-44">
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
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(c) => c._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

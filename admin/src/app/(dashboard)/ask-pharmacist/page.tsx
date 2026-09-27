"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { AdminAskPharmacist } from "@/types/admin";

const STATUSES = ["", "open", "answered", "closed"];

export default function AskPharmacistPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-ask", search, status, page],
    queryFn:  () => askPharmacistApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminAskPharmacist>[] = [
    {
      key: "subject", header: "Subject",
      render: (a) => (
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{a.subject}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] line-clamp-1">{a.question}</p>
        </div>
      ),
    },
    {
      key: "status", header: "Status", width: "110px",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: "responded", header: "Responded At", width: "140px",
      render: (a) => (
        a.respondedAt
          ? <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDateTime(a.respondedAt)}</span>
          : <span className="text-[var(--color-text-muted)]">—</span>
      ),
    },
    {
      key: "date", header: "Asked", width: "110px",
      render: (a) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {fmtDate(a.createdAt)}
        </span>
      ),
    },
    {
      key: "actions", header: "Actions", width: "80px",
      render: (a) => (
        <Link href={`/ask-pharmacist/${a._id}`} className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit">
          <Eye size={13} /> {a.status === "open" ? "Respond" : "View"}
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ask a Pharmacist"
        description={`${total.toLocaleString()} questions`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-ask"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-56">
              <Input
                placeholder="Search subject…"
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
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(a) => a._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

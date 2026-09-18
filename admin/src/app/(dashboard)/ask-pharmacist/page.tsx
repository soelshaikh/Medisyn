"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { AdminAskPharmacist } from "@/types/admin";

const STATUSES = ["", "open", "answered", "closed"];

export default function AskPharmacistPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
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
          ? <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{new Date(a.respondedAt).toLocaleDateString("en-CA")}</span>
          : <span className="text-[var(--color-text-muted)]">—</span>
      ),
    },
    {
      key: "date", header: "Asked", width: "110px",
      render: (a) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {new Date(a.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "80px",
      render: (a) => (
        <Link href={`/ask-pharmacist/${a._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          {a.status === "open" ? "Respond" : "View"}
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Ask a Pharmacist" description={`${total.toLocaleString()} questions`} />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search subject…"
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

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(a) => a._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

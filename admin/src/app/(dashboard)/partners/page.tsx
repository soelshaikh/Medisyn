"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { partnersApi } from "@/api/partners.api";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { PartnerUser } from "@/types/admin";

const STATUSES = ["", "pending_approval", "approved", "active", "rejected", "suspended"];

export default function PartnersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-partners", search, status, page],
    queryFn:  () => partnersApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<PartnerUser>[] = [
    {
      key: "partner", header: "Partner",
      render: (p) => (
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">
            {p.profile?.companyName ?? p.fullName}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{p.email}</p>
        </div>
      ),
    },
    {
      key: "contact", header: "Contact",
      render: (p) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {p.profile?.contactName ?? "—"}
        </span>
      ),
    },
    {
      key: "license", header: "License #",
      render: (p) => (
        <span className="text-[var(--font-size-sm)] font-mono text-[var(--color-text-secondary)]">
          {p.profile?.licenseNumber ?? "—"}
        </span>
      ),
    },
    {
      key: "status", header: "Status", width: "160px",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "joined", header: "Applied", width: "110px",
      render: (p) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {fmtDate(p.createdAt)}
        </span>
      ),
    },
    {
      key: "actions", header: "Actions", width: "60px",
      render: (p) => (
        <Link href={`/partners/${p._id}`} className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit">
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
        title="Pharmacy Partners"
        description={`${total.toLocaleString()} partners`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-partners"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-56">
              <Input
                placeholder="Search name or email…"
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
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(p) => p._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

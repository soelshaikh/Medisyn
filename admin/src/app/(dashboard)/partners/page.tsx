"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { partnersApi } from "@/api/partners.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { PartnerUser } from "@/types/admin";

const STATUSES = ["", "pending_approval", "approved", "active", "rejected", "suspended"];

export default function PartnersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
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
          {new Date(p.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "60px",
      render: (p) => (
        <Link href={`/partners/${p._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          Review
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Pharmacy Partners" description={`${total.toLocaleString()} partners`} />

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

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(p) => p._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

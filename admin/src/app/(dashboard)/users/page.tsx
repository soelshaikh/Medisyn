"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usersApi } from "@/api/users.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { AdminUser } from "@/types/admin";

const ROLES = ["", "patient", "clinic", "pharmacy_partner"];
const STATUSES = ["", "active", "pending_verification", "pending_approval", "suspended", "deactivated", "rejected"];

export default function UsersPage() {
  const [search, setSearch]   = useState("");
  const [role,   setRole]     = useState("");
  const [status, setStatus]   = useState("");
  const [page,   setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, role, status, page],
    queryFn:  () => usersApi.list({ search: search || undefined, role: role || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminUser>[] = [
    { key: "name",  header: "Name",    render: (u) => (
      <div>
        <p className="font-medium text-[var(--color-text-primary)]">{u.fullName}</p>
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{u.email}</p>
      </div>
    )},
    { key: "role",   header: "Role",   render: (u) => <span className="capitalize">{u.role.replace(/_/g, " ")}</span> },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
    { key: "joined", header: "Joined", render: (u) => new Date(u.createdAt).toLocaleDateString("en-CA") },
    { key: "actions", header: "", width: "80px", render: (u) => (
      <Link href={`/users/${u._id}`} className="text-[var(--color-primary)] text-[var(--font-size-xs)] font-semibold hover:underline">
        View
      </Link>
    )},
  ];

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Users" description={`${total} total users`} />

      {/* Filters */}
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
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] bg-white"
        >
          <option value="">All roles</option>
          {ROLES.filter(Boolean).map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] bg-white"
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(u) => u._id} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] disabled:opacity-40">
            Prev
          </button>
          <span className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

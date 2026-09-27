"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usersApi } from "@/api/users.api";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { Select } from "@/components/ui/Select";
import type { AdminUser } from "@/types/admin";

const ROLES = ["", "patient", "clinic", "pharmacy_partner"];
const STATUSES = ["", "active", "pending_verification", "pending_approval", "suspended", "deactivated", "rejected"];

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState("");
  const [role,   setRole]     = useState("");
  const [status, setStatus]   = useState("");
  const [page,   setPage]     = useState(1);

  const { data, isLoading, isFetching } = useQuery({
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
    { key: "joined", header: "Joined", render: (u) => fmtDate(u.createdAt) },
    { key: "actions", header: "Actions", width: "80px", render: (u) => (
      <Link href={`/users/${u._id}`} className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit">
        <Eye size={13} /> View
      </Link>
    )},
  ];

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description={`${total} total users`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
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
            <div className="w-40">
              <Select
                value={role || "_all"}
                onChange={(v) => { setRole(v === "_all" ? "" : v); setPage(1); }}
                options={[
                  { value: "_all", label: "All roles" },
                  ...ROLES.filter(Boolean).map((r) => ({ value: r, label: r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })),
                ]}
              />
            </div>
            <div className="w-40">
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
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(u) => u._id} />
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] disabled:opacity-40">
            Prev
          </button>
          <span className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-[var(--font-size-sm)] rounded-[var(--radius-md)] border border-[var(--color-border)] disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

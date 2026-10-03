"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usersApi } from "@/api/users.api";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Eye, Search } from "lucide-react";
import type { AdminUser } from "@/types/admin";

const STATUSES = ["", "active", "pending_verification", "suspended", "deactivated"];

/* Role badge colours cycle so different roles are visually distinct */
const ROLE_COLOURS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function roleBadgeClass(idx: number) {
  return ROLE_COLOURS[idx % ROLE_COLOURS.length];
}

export default function StaffMembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-staff", search, status, page],
    queryFn:  () => usersApi.list({
      search:   search || undefined,
      status:   status || undefined,
      hasRoles: true,
      page,
      limit: 25,
    }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminUser>[] = [
    {
      key: "name", header: "Name",
      render: (u) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{u.fullName}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{u.email}</p>
        </div>
      ),
    },
    {
      key: "roles", header: "Assigned Roles",
      render: (u) => (
        <div className="flex flex-wrap gap-1.5">
          {(u.roles ?? []).map((r, idx) => (
            <span
              key={r._id}
              className={`rounded-full px-2.5 py-0.5 text-[var(--font-size-xs)] font-semibold capitalize ${roleBadgeClass(idx)}`}
            >
              {r.name}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "status", header: "Status", width: "160px",
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "joined", header: "Joined", width: "110px",
      render: (u) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDate(u.createdAt)}</span>
      ),
    },
    {
      key: "actions", header: "Actions", width: "80px",
      render: (u) => (
        <Link
          href={`/users/${u._id}`}
          className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit"
        >
          <Eye size={13} /> View
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Members"
        description={`${total.toLocaleString()} staff with assigned roles`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-staff"] })}
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
                  ...STATUSES.filter(Boolean).map((s) => ({
                    value: s,
                    label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                  })),
                ]}
              />
            </div>
          </>
        }
      />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(u) => u._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

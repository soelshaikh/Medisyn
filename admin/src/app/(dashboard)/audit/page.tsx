"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/api/audit.api";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { AuditLog } from "@/types/admin";

export default function AuditLogPage() {
  const [search,   setSearch]   = useState("");
  const [resource, setResource] = useState("");
  const [page,     setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", search, resource, page],
    queryFn:  () => auditApi.list({ search: search || undefined, resource: resource || undefined, page, limit: 50 }),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });

  const columns: Column<AuditLog>[] = [
    {
      key: "actor", header: "Actor",
      render: (a) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)] text-[var(--font-size-sm)]">{a.userEmail}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{a.ipAddress}</p>
        </div>
      ),
    },
    {
      key: "action", header: "Action",
      render: (a) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] font-mono text-[var(--font-size-xs)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
          {a.action}
        </span>
      ),
    },
    {
      key: "resource", header: "Resource",
      render: (a) => (
        <div>
          <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
            {a.resource}
          </span>
          {a.resourceId && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono truncate max-w-[140px]">
              {a.resourceId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "time", header: "Time", width: "160px",
      render: (a) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {fmtDateTime(a.createdAt)}
        </span>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Log" description="All admin and system actions — auto-refreshes every 30s" />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search actor or action…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftIcon={<Search size={14} />}
          />
        </div>
        <Input
          placeholder="Filter by resource…"
          value={resource}
          onChange={(e) => { setResource(e.target.value); setPage(1); }}
          className="w-44"
        />
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(a) => a._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

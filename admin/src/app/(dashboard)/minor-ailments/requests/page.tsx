"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ailmentRequestsApi } from "@/api/ailment-requests.api";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Search, Eye } from "lucide-react";
import type { AdminAilmentRequest } from "@/types/admin";

const STATUSES = ["submitted", "reviewing", "responded", "closed"];

function patientName(r: AdminAilmentRequest) {
  if (typeof r.patientId === "object" && r.patientId !== null) return r.patientId.fullName;
  return "—";
}
function patientEmail(r: AdminAilmentRequest) {
  if (typeof r.patientId === "object" && r.patientId !== null) return r.patientId.email;
  return "";
}

export default function AilmentRequestsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-ailment-requests", search, status, page],
    queryFn:  () => ailmentRequestsApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminAilmentRequest>[] = [
    {
      key: "ailmentName", header: "Ailment",
      render: (r) => (
        <p className="font-semibold text-[var(--color-text-primary)]">{r.ailmentName}</p>
      ),
    },
    {
      key: "patient", header: "Patient",
      render: (r) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{patientName(r)}</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{patientEmail(r)}</p>
        </div>
      ),
    },
    {
      key: "status", header: "Status", width: "120px",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "date", header: "Submitted", width: "110px",
      render: (r) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      key: "actions", header: "", width: "80px",
      render: (r) => (
        <Link
          href={`/minor-ailments/requests/${r._id}`}
          className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit"
        >
          <Eye size={13} /> {r.status === "submitted" || r.status === "reviewing" ? "Review" : "View"}
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Minor Ailment Requests"
        description={`${total.toLocaleString()} requests`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-ailment-requests"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-56">
              <Input
                placeholder="Search ailment…"
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
                  ...STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
                ]}
              />
            </div>
          </>
        }
      />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(r) => r._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

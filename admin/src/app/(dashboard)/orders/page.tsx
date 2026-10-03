"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ordersApi } from "@/api/orders.api";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Eye, Search } from "lucide-react";
import type { AdminOrder } from "@/types/admin";

const STATUSES = ["", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-orders", search, status, page],
    queryFn:  () => ordersApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminOrder>[] = [
    {
      key: "order", header: "Order",
      render: (o) => (
        <div>
          <p className="font-semibold text-[var(--color-text-primary)] font-mono text-[var(--font-size-xs)]">
            {o.orderNumber}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
            {o.guestInfo?.email ?? (typeof o.userId === "object" && o.userId ? o.userId.email : "—")}
          </p>
        </div>
      ),
    },
    {
      key: "customer", header: "Customer",
      render: (o) => {
        const name  = o.guestInfo?.fullName ?? (typeof o.userId === "object" && o.userId ? o.userId.fullName : null) ?? "—";
        const email = o.guestInfo?.email    ?? (typeof o.userId === "object" && o.userId ? o.userId.email    : null);
        return (
          <div>
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{name}</span>
            {email && <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{email}</p>}
          </div>
        );
      },
    },
    {
      key: "total", header: "Total", width: "100px",
      render: (o) => (
        <span className="font-semibold text-[var(--color-text-primary)]">{formatCAD(o.total)}</span>
      ),
    },
    {
      key: "status", header: "Status", width: "130px",
      render: (o) => <StatusBadge status={o.status} />,
    },
    {
      key: "date", header: "Date", width: "110px",
      render: (o) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {fmtDate(o.createdAt)}
        </span>
      ),
    },
    {
      key: "actions", header: "Actions", width: "80px",
      render: (o) => (
        <Link href={`/orders/${o._id}`} className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit">
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
        title="Orders"
        description={`${total.toLocaleString()} total orders`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-orders"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-56">
              <Input
                placeholder="Search order # or email…"
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
                  ...STATUSES.filter(Boolean).map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
                ]}
              />
            </div>
          </>
        }
      />
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(o) => o._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

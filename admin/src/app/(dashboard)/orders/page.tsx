"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ordersApi } from "@/api/orders.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import type { AdminOrder } from "@/types/admin";

const STATUSES = ["", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
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
            {o.guestInfo?.email ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "customer", header: "Customer",
      render: (o) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {o.guestInfo?.fullName ?? "—"}
        </span>
      ),
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
          {new Date(o.createdAt).toLocaleDateString("en-CA")}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "60px",
      render: (o) => (
        <Link href={`/orders/${o._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          View
        </Link>
      ),
    },
  ];

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description={`${total.toLocaleString()} total orders`} />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search order # or email…"
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

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} keyFn={(o) => o._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { productsApi } from "@/api/products.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Search, AlertCircle } from "lucide-react";
import type { AdminProduct } from "@/types/admin";

const STATUSES = ["", "active", "draft", "archived"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search, status, page],
    queryFn:  () => productsApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<AdminProduct>[] = [
    {
      key: "product", header: "Product",
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.images?.[0]?.url ? (
            <img src={p.images[0].url} alt={p.name} className="w-10 h-10 rounded-[var(--radius-md)] object-cover border border-[var(--color-border)]" />
          ) : (
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
              <AlertCircle size={14} className="text-[var(--color-text-muted)]" />
            </div>
          )}
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{p.name}</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono">{p.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category", header: "Category",
      render: (p) => (
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          {typeof p.categoryId === "object" ? p.categoryId?.name : "—"}
        </span>
      ),
    },
    {
      key: "price", header: "Price", width: "100px",
      render: (p) => <span className="font-semibold text-[var(--color-text-primary)]">{formatCAD(p.price)}</span>,
    },
    {
      key: "stock", header: "Stock", width: "80px",
      render: (p) => {
        const qty = p.inventory?.quantity ?? null;
        if (qty === null) return <span className="text-[var(--color-text-muted)]">—</span>;
        const low = p.inventory?.trackInventory && qty <= (p.inventory.lowStockThreshold ?? 5);
        return (
          <span className={low ? "text-[var(--color-error)] font-semibold" : "text-[var(--color-text-primary)]"}>
            {qty}
          </span>
        );
      },
    },
    { key: "rx", header: "Rx", width: "60px", render: (p) => (
      p.requiresPrescription
        ? <span className="text-[var(--font-size-xs)] px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-light)] text-[var(--color-warning)] font-semibold">Rx</span>
        : <span className="text-[var(--color-text-muted)]">—</span>
    )},
    { key: "status", header: "Status", width: "100px", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "actions", header: "", width: "60px",
      render: (p) => (
        <Link href={`/products/${p._id}`} className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline">
          Edit
        </Link>
      ),
    },
  ];

  const products = data?.products ?? [];
  const total    = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-5">
      <PageHeader title="Products" description={`${total.toLocaleString()} products`} />

      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Input
            placeholder="Search name or SKU…"
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

      <DataTable columns={columns} data={products} loading={isLoading} keyFn={(p) => p._id} />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

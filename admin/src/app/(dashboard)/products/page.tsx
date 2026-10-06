"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { productsApi, categoriesApi } from "@/api/products.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Eye, Search, AlertCircle, Plus, Tag } from "lucide-react";
import type { AdminProduct } from "@/types/admin";

const STATUSES = ["", "active", "draft", "archived"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface CreateForm {
  name:                string;
  sku:                 string;
  priceCAD:            string;
  compareAtPriceCAD:   string;
  status:              string;
  categoryId:          string;
  shortDescription:    string;
  requiresPrescription: boolean;
}

const EMPTY_FORM: CreateForm = {
  name:                "",
  sku:                 "",
  priceCAD:            "",
  compareAtPriceCAD:   "",
  status:              "draft",
  categoryId:          "",
  shortDescription:    "",
  requiresPrescription: false,
};

export default function ProductsPage() {
  const qc     = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [form,       setForm]       = useState<CreateForm>(EMPTY_FORM);
  const [formError,  setFormError]  = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-products", search, status, page],
    queryFn:  () => productsApi.list({ search: search || undefined, status: status || undefined, page, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-admin"],
    queryFn:  categoriesApi.listAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const price = Math.round(parseFloat(form.priceCAD) * 100);
      const compareAt = form.compareAtPriceCAD
        ? Math.round(parseFloat(form.compareAtPriceCAD) * 100)
        : undefined;
      return productsApi.create({
        name:                form.name.trim(),
        sku:                 form.sku.trim(),
        price,
        compareAtPrice:      compareAt,
        status:              form.status,
        categoryId:          form.categoryId || undefined,
        shortDescription:    form.shortDescription.trim() || undefined,
        requiresPrescription: form.requiresPrescription,
      });
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["admin-products"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      router.push(`/products/${created._id}`);
    },
    onError: (e: Error) => setFormError(e.message ?? "Failed to create product."),
  });

  function handleCreate() {
    setFormError("");
    if (!form.name.trim())    { setFormError("Product name is required."); return; }
    if (!form.sku.trim())     { setFormError("SKU is required."); return; }
    const price = parseFloat(form.priceCAD);
    if (isNaN(price) || price < 0) { setFormError("Enter a valid price (e.g. 19.99)."); return; }
    createMut.mutate();
  }

  function field<K extends keyof CreateForm>(key: K, val: CreateForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setFormError("");
  }

  const columns: Column<AdminProduct>[] = [
    {
      key: "product", header: "Product",
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.images?.[0]?.url ? (
            <img src={p.images[0].url} alt={p.name} className="w-9 h-9 rounded-[var(--radius-md)] object-cover border border-[var(--color-border)] shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
              <AlertCircle size={13} className="text-[var(--color-text-muted)]" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-[var(--color-text-primary)] leading-tight">{p.name}</p>
              {p.compareAtPrice && p.compareAtPrice > p.price && (
                <span className="text-[var(--font-size-xs)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-error-light)] text-[var(--color-error)] font-semibold leading-none">Sale</span>
              )}
            </div>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono">{p.sku}</p>
            {p.shortDescription && (
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] truncate max-w-xs mt-0.5">{p.shortDescription}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category", header: "Category",
      render: (p) => (
        <div>
          <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            {typeof p.categoryId === "object" ? p.categoryId?.name : "—"}
          </span>
          {p.tags?.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <Tag size={10} className="text-[var(--color-text-muted)]" />
              <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{p.tags.slice(0, 2).join(", ")}{p.tags.length > 2 ? ` +${p.tags.length - 2}` : ""}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "price", header: "Price", width: "110px",
      render: (p) => (
        <div>
          <span className="font-semibold text-[var(--color-text-primary)]">{formatCAD(p.price)}</span>
          {p.compareAtPrice && p.compareAtPrice > p.price && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] line-through">{formatCAD(p.compareAtPrice)}</p>
          )}
        </div>
      ),
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
    {
      key: "rx", header: "Rx", width: "60px",
      render: (p) => (
        p.requiresPrescription
          ? <span className="text-[var(--font-size-xs)] px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-light)] text-[var(--color-warning)] font-semibold">Rx</span>
          : <span className="text-[var(--color-text-muted)]">—</span>
      ),
    },
    { key: "status", header: "Status", width: "100px", render: (p) => <StatusBadge status={p.status} /> },
    {
      key: "actions", header: "Actions", width: "80px",
      render: (p) => (
        <Link
          href={`/products/${p._id}`}
          className="flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-2 py-1.5 rounded-[var(--radius-md)] transition-colors w-fit"
        >
          <Eye size={13} /> Edit
        </Link>
      ),
    },
  ];

  const products   = data?.products ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description={`${total.toLocaleString()} products`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-products"] })}
        refreshing={isFetching}
        filters={
          <>
            <div className="w-56">
              <Input
                placeholder="Search name or SKU…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                leftIcon={<Search size={14} />}
              />
            </div>
            <div className="w-40">
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
        actions={
          <Button
            size="sm"
            onClick={() => { setForm(EMPTY_FORM); setFormError(""); setCreateOpen(true); }}
          >
            <Plus size={15} />
            Add Product
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={products}
        loading={isLoading}
        keyFn={(p) => p._id}
        emptyTitle={search || status ? "No products match your filters" : "No products yet"}
        emptyDescription={search || status ? "Try a different search or clear the filters." : "Add your first product to get started."}
      />
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {/* ── Add Product modal ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Product">
        <div className="space-y-4">
          {/* Name + SKU side by side */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Product Name *"
              placeholder="e.g. Vitamin D3 1000IU"
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
            <Input
              label="SKU *"
              placeholder="e.g. VIT-D3-1000"
              value={form.sku}
              onChange={(e) => field("sku", e.target.value.toUpperCase())}
            />
          </div>

          {/* Price + Compare-at price */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (CAD) *"
              type="text"
              inputMode="decimal"
              placeholder="19.99"
              value={form.priceCAD}
              onChange={(e) => field("priceCAD", e.target.value.replace(/[^0-9.]/g, ""))}
              hint="Enter in dollars — e.g. 19.99"
            />
            <Input
              label="Compare-at Price"
              type="text"
              inputMode="decimal"
              placeholder="24.99"
              value={form.compareAtPriceCAD}
              onChange={(e) => field("compareAtPriceCAD", e.target.value.replace(/[^0-9.]/g, ""))}
              hint="Optional — shown as crossed-out"
            />
          </div>

          {/* Status + Category */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={form.status}
              onChange={(v) => field("status", v)}
              options={[
                { value: "draft",    label: "Draft" },
                { value: "active",   label: "Active" },
                { value: "archived", label: "Archived" },
              ]}
            />
            <Select
              label="Category"
              value={form.categoryId || "_none"}
              onChange={(v) => field("categoryId", v === "_none" ? "" : v)}
              options={[
                { value: "_none", label: "No category" },
                ...(categories ?? []).map((c) => ({ value: c._id, label: c.name })),
              ]}
            />
          </div>

          {/* Short description */}
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
              Short Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief product description…"
              value={form.shortDescription}
              onChange={(e) => field("shortDescription", e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>

          {/* Requires Prescription toggle */}
          {/* <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.requiresPrescription}
              onChange={(e) => field("requiresPrescription", e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)]"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
              Requires prescription (Rx)
            </span>
          </label> */}

          {/* Error */}
          {formError && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)] bg-[var(--color-error-light)] px-3 py-2 rounded-[var(--radius-md)]">
              {formError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-1 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMut.isPending} onClick={handleCreate}>
              Create Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

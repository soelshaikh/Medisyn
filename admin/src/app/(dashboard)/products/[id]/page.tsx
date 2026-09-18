"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { productsApi, categoriesApi, inventoryApi } from "@/api/products.api";
import { DetailCard } from "@/components/common/DetailCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowLeft, AlertCircle } from "lucide-react";

const PRODUCT_STATUSES = ["active", "draft", "archived"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const router = useRouter();
  const [editModal,  setEditModal]  = useState(false);
  const [stockModal, setStockModal] = useState(false);
  const [delta,      setDelta]      = useState(0);
  const [editForm,   setEditForm]   = useState<Record<string, unknown>>({});

  const { data: product, isLoading } = useQuery({
    queryKey: ["admin-product", id],
    queryFn:  () => productsApi.getById(id),
  });

  const { data: categories } = useQuery({ queryKey: ["categories-admin"], queryFn: categoriesApi.listAdmin });

  const editMut = useMutation({
    mutationFn: () => productsApi.update(id, editForm),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-product", id] }); setEditModal(false); },
  });

  const stockMut = useMutation({
    mutationFn: () => inventoryApi.adjust(id, delta),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-product", id] }); setStockModal(false); setDelta(0); },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!product)  return <p className="text-[var(--color-text-muted)]">Product not found.</p>;

  const cat = typeof product.categoryId === "object" ? product.categoryId : null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{product.name}</h1>
            <StatusBadge status={product.status} />
            {product.requiresPrescription && (
              <span className="text-[var(--font-size-xs)] px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-warning-light)] text-[var(--color-warning)] font-semibold">
                Prescription Required
              </span>
            )}
          </div>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] mt-1 font-mono">{product.sku}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditForm({
              name:    product.name,
              status:  product.status,
              price:   product.price,
              compareAtPrice: product.compareAtPrice,
              shortDescription: product.shortDescription,
              categoryId: cat?._id,
            });
            setEditModal(true);
          }}
        >
          Edit
        </Button>
      </div>

      {/* Product image */}
      {product.images?.[0]?.url && (
        <div className="flex gap-3">
          <img
            src={product.images[0].url}
            alt={product.name}
            className="w-24 h-24 rounded-[var(--radius-lg)] object-cover border border-[var(--color-border)] shadow-[var(--shadow-sm)]"
          />
        </div>
      )}

      <DetailCard
        title="Product Details"
        cols={3}
        fields={[
          { label: "SKU",         value: product.sku },
          { label: "Category",    value: cat?.name },
          { label: "Status",      value: <StatusBadge status={product.status} /> },
          { label: "Price",       value: formatCAD(product.price) },
          { label: "Compare At",  value: product.compareAtPrice ? formatCAD(product.compareAtPrice) : "—" },
          { label: "Requires Rx", value: product.requiresPrescription ? "Yes" : "No" },
        ]}
      />

      {product.shortDescription && (
        <DetailCard
          title="Description"
          cols={1}
          fields={[{ label: "Short Description", value: product.shortDescription }]}
        />
      )}

      {/* Inventory */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">Inventory</h2>
          <Button size="sm" variant="outline" onClick={() => setStockModal(true)}>Adjust Stock</Button>
        </div>
        <div className="px-6 py-5">
          {product.inventory ? (
            <dl className="grid grid-cols-3 gap-x-8 gap-y-4 text-[var(--font-size-sm)]">
              {[
                ["Quantity",        product.inventory.quantity],
                ["Low Stock At",    product.inventory.lowStockThreshold],
                ["Track Inventory", product.inventory.trackInventory ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-[var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{k}</dt>
                  <dd className={[
                    "font-semibold",
                    k === "Quantity" && product.inventory!.trackInventory && Number(v) <= product.inventory!.lowStockThreshold
                      ? "text-[var(--color-error)]"
                      : "text-[var(--color-text-primary)]",
                  ].join(" ")}>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <AlertCircle size={14} />
              <span className="text-[var(--font-size-sm)]">No inventory record. Stock tracking not configured.</span>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Product">
        <div className="space-y-4">
          <Input label="Name" value={String(editForm.name ?? "")} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          <Input
            label="Price (cents)"
            type="number"
            value={String(editForm.price ?? "")}
            onChange={(e) => setEditForm((f) => ({ ...f, price: Number(e.target.value) }))}
            hint="Enter price in cents (e.g. 1999 = $19.99)"
          />
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Status</label>
            <select
              value={String(editForm.status ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)]"
            >
              {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Category</label>
            <select
              value={String(editForm.categoryId ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)]"
            >
              <option value="">No category</option>
              {(categories ?? []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button loading={editMut.isPending} onClick={() => editMut.mutate()}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Stock adjust modal */}
      <Modal open={stockModal} onClose={() => setStockModal(false)} title="Adjust Stock">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Current stock: <strong>{product.inventory?.quantity ?? "N/A"}</strong>. Enter a positive number to add, negative to subtract.
          </p>
          <Input
            label="Adjustment"
            type="number"
            value={String(delta)}
            onChange={(e) => setDelta(Number(e.target.value))}
            placeholder="e.g. 10 or -5"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setStockModal(false)}>Cancel</Button>
            <Button loading={stockMut.isPending} disabled={delta === 0} onClick={() => stockMut.mutate()}>Apply</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

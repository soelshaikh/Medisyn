"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { brandsApi } from "@/api/products.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { fmtDate } from "@/lib/format";
import { Plus, Edit2, Trash2, Globe } from "lucide-react";
import type { AdminBrand } from "@/types/admin";

export default function BrandsPage() {
  const qc = useQueryClient();

  const { data: brands = [], isLoading, isFetching } = useQuery<AdminBrand[]>({
    queryKey: ["admin-brands"],
    queryFn:  brandsApi.list as () => Promise<AdminBrand[]>,
  });

  /* ── Create / Edit modal ── */
  const [modal,     setModal]     = useState(false);
  const [editBrand, setEditBrand] = useState<AdminBrand | null>(null);
  const [name,      setName]      = useState("");
  const [desc,      setDesc]      = useState("");
  const [logoUrl,   setLogoUrl]   = useState("");
  const [website,   setWebsite]   = useState("");

  function openCreate() {
    setEditBrand(null); setName(""); setDesc(""); setLogoUrl(""); setWebsite("");
    setModal(true);
  }
  function openEdit(b: AdminBrand) {
    setEditBrand(b); setName(b.name); setDesc(b.description);
    setLogoUrl(b.logoUrl); setWebsite(b.website);
    setModal(true);
  }

  const saveMut = useMutation({
    mutationFn: () =>
      editBrand
        ? brandsApi.update(editBrand._id, { name, description: desc, logoUrl, website })
        : brandsApi.create({ name, description: desc, logoUrl, website }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); setModal(false); },
  });

  /* ── Delete modal ── */
  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);
  const deleteMut = useMutation({
    mutationFn: () => brandsApi.delete(deleteTarget!._id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); setDeleteTarget(null); },
  });

  const columns: Column<AdminBrand>[] = [
    {
      key: "name", header: "Brand",
      render: (b) => (
        <div className="flex items-center gap-3">
          {b.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logoUrl} alt={b.name} className="h-8 w-8 rounded-md object-contain border border-[var(--color-border)] bg-white p-0.5" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xs font-bold">
              {b.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">{b.name}</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono">{b.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description", header: "Description",
      render: (b) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] line-clamp-1 max-w-xs">
          {b.description || "—"}
        </span>
      ),
    },
    {
      key: "website", header: "Website", width: "150px",
      render: (b) => b.website
        ? <a href={b.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"><Globe size={11} /> {b.website.replace(/^https?:\/\//, "")}</a>
        : <span className="text-[var(--color-text-muted)]">—</span>,
    },
    {
      key: "status", header: "Status", width: "90px",
      render: (b) => <StatusBadge status={b.isActive ? "active" : "inactive"} />,
    },
    {
      key: "createdAt", header: "Created", width: "100px",
      render: (b) => <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDate(b.createdAt)}</span>,
    },
    {
      key: "actions", header: "Actions", width: "100px",
      render: (b) => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => openEdit(b)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors">
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={() => setDeleteTarget(b)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-error)] hover:bg-[var(--color-error-light)] transition-colors">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      ),
    },
  ];

  const total = brands?.length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Brands"
        description={`${total} brand${total !== 1 ? "s" : ""}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-brands"] })}
        refreshing={isFetching}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" /> Add Brand
          </Button>
        }
      />

      <DataTable columns={columns} data={brands ?? []} loading={isLoading} keyFn={(b) => b._id} />

      {/* Create / Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editBrand ? "Edit Brand" : "Add Brand"}
      >
        <div className="space-y-4">
          <Input
            label="Brand Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apotex Inc."
          />
          <div className="space-y-1">
            <label className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="Brand description…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-y"
            />
            <p className="text-right text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{desc.length}/5000</p>
          </div>
          <Input
            label="Logo URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          <Input
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://apotex.com"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button
              loading={saveMut.isPending}
              disabled={!name.trim()}
              onClick={() => saveMut.mutate()}
            >
              {editBrand ? "Save Changes" : "Create Brand"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Brand"
      >
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Products assigned to this brand will have their brand cleared.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
              Delete Brand
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

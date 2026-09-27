"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/api/products.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pencil, Trash2, Plus } from "lucide-react";

interface AdminCategory { _id: string; name: string; slug: string; isActive: boolean; }
interface CategoryForm  { name: string; description: string; }
const BLANK: CategoryForm = { name: "", description: "" };

export default function CategoriesPage() {
  const qc = useQueryClient();

  const [modal,         setModal]         = useState(false);
  const [editing,       setEditing]       = useState<AdminCategory | null>(null);
  const [form,          setForm]          = useState<CategoryForm>(BLANK);
  const [error,         setError]         = useState("");
  const [deleteTarget,  setDeleteTarget]  = useState<AdminCategory | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories-admin"],
    queryFn:  categoriesApi.listAdmin,
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? categoriesApi.update(editing._id, form as unknown as Record<string, unknown>)
        : categoriesApi.create({ name: form.name.trim(), description: form.description.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories-admin"] });
      setModal(false); setEditing(null); setForm(BLANK);
    },
    onError: (e: Error) => setError(e.message ?? "Failed to save category."),
  });

  const del = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: ["categories-admin"] }); setDeleteTarget(null); },
  });

  function openAdd()              { setEditing(null); setForm(BLANK); setError(""); setModal(true); }
  function openEdit(c: AdminCategory) { setEditing(c); setForm({ name: c.name, description: "" }); setError(""); setModal(true); }

  const cols: Column<AdminCategory>[] = [
    {
      key: "name", header: "Name",
      render: (c) => <span className="font-medium text-[var(--color-text-primary)]">{c.name}</span>,
    },
    {
      key: "slug", header: "Slug",
      render: (c) => <span className="font-mono text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{c.slug}</span>,
    },
    {
      key: "status", header: "Status", width: "90px",
      render: (c) => (
        <span className={[
          "text-[var(--font-size-xs)] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)]",
          c.isActive
            ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
            : "bg-[var(--color-surface)] text-[var(--color-text-muted)]",
        ].join(" ")}>
          {c.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "80px",
      render: (c) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(c)} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(c)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  const total = (categories ?? []).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description={`${total} categor${total === 1 ? "y" : "ies"}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["categories-admin"] })}
        actions={
          <Button onClick={openAdd}>
            <Plus size={14} className="mr-1.5" /> Add Category
          </Button>
        }
      />

      <DataTable
        columns={cols}
        data={categories ?? []}
        loading={isLoading}
        keyFn={(c) => c._id}
        emptyTitle="No categories yet"
        emptyDescription="Add your first category to organise products."
      />

      {/* Add / Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Category" : "Add Category"}>
        <div className="space-y-4">
          <Input
            label="Category Name *"
            placeholder="e.g. Vitamins & Supplements"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Description</label>
            <textarea
              rows={2}
              placeholder="Optional description…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>
          {error && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)] bg-[var(--color-error-light)] px-3 py-2 rounded-[var(--radius-md)]">{error}</p>
          )}
          <div className="flex gap-3 justify-end pt-1 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>
              {editing ? "Save Changes" : "Add Category"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Category">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Delete <strong>{deleteTarget?.name}</strong>? Products in this category will become uncategorised.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={del.isPending} onClick={() => deleteTarget && del.mutate(deleteTarget._id)}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

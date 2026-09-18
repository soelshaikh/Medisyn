"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { faqsApi } from "@/api/faqs.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pencil, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import type { FAQ } from "@/types/admin";

const BLANK_FAQ = { question: "", answer: "", category: "", sortOrder: 0, isPublished: true };

export default function SettingsPage() {
  const qc = useQueryClient();
  const [faqModal,  setFaqModal]  = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
  const [editing,   setEditing]   = useState<FAQ | null>(null);
  const [form,      setForm]      = useState(BLANK_FAQ);

  const { data: faqs, isLoading } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn:  () => faqsApi.list({ limit: 100 }),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? faqsApi.update(editing._id, form)
        : faqsApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      setFaqModal(false);
      setEditing(null);
      setForm(BLANK_FAQ);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => faqsApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-faqs"] }); setDeleteTarget(null); },
  });

  const togglePublish = (faq: FAQ) => {
    faqsApi.update(faq._id, { isPublished: !faq.isPublished })
      .then(() => qc.invalidateQueries({ queryKey: ["admin-faqs"] }));
  };

  const openCreate = () => { setEditing(null); setForm(BLANK_FAQ); setFaqModal(true); };
  const openEdit   = (faq: FAQ) => {
    setEditing(faq);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category, sortOrder: faq.sortOrder, isPublished: faq.isPublished });
    setFaqModal(true);
  };

  const columns: Column<FAQ>[] = [
    {
      key: "question", header: "Question",
      render: (f) => (
        <div>
          <p className="font-medium text-[var(--color-text-primary)] line-clamp-2">{f.question}</p>
          {f.category && (
            <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{f.category}</span>
          )}
        </div>
      ),
    },
    {
      key: "order", header: "Order", width: "70px",
      render: (f) => <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{f.sortOrder}</span>,
    },
    {
      key: "published", header: "Published", width: "100px",
      render: (f) => (
        <button
          onClick={() => togglePublish(f)}
          className={[
            "flex items-center gap-1.5 text-[var(--font-size-xs)] font-semibold transition-colors",
            f.isPublished
              ? "text-[var(--color-success)]"
              : "text-[var(--color-text-muted)]",
          ].join(" ")}
        >
          {f.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
          {f.isPublished ? "Published" : "Draft"}
        </button>
      ),
    },
    {
      key: "actions", header: "", width: "80px",
      render: (f) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(f)} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => setDeleteTarget(f)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage platform content and configuration" />

      {/* FAQs section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[var(--font-size-lg)] font-semibold text-[var(--color-text-primary)]">FAQs</h2>
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
              {faqs?.data.length ?? 0} questions published to the website
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus size={14} className="mr-1.5" />
            Add FAQ
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={faqs?.data ?? []}
          loading={isLoading}
          keyFn={(f) => f._id}
          emptyText="No FAQs yet. Add the first one."
        />
      </div>

      {/* FAQ create/edit modal */}
      <Modal
        open={faqModal}
        onClose={() => { setFaqModal(false); setEditing(null); setForm(BLANK_FAQ); }}
        title={editing ? "Edit FAQ" : "Add FAQ"}
        width="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
              Question
            </label>
            <Input
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="What is compounding?"
            />
          </div>
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
              Answer
            </label>
            <textarea
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              rows={5}
              placeholder="Write the full answer here…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. General, Services"
            />
            <Input
              label="Sort Order"
              type="number"
              value={String(form.sortOrder)}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">Published (visible on website)</span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => { setFaqModal(false); setEditing(null); setForm(BLANK_FAQ); }}>
              Cancel
            </Button>
            <Button loading={saveMut.isPending} disabled={!form.question || !form.answer} onClick={() => saveMut.mutate()}>
              {editing ? "Save Changes" : "Add FAQ"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete FAQ">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Are you sure you want to delete this FAQ? This cannot be undone.
          </p>
          <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] bg-[var(--color-surface)] rounded-[var(--radius-md)] px-4 py-3">
            {deleteTarget?.question}
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget._id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

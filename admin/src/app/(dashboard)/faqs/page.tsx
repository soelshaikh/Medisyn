"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { faqsApi } from "@/api/faqs.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/common/EmptyState";
import { Pencil, Trash2, Plus, Eye, EyeOff, GripVertical } from "lucide-react";
import type { FAQ } from "@/types/admin";

const BLANK_FAQ = { question: "", answer: "", category: "", sortOrder: 0, isPublished: true };

/* ── Sortable table row ── */

interface SortableRowProps {
  faq:      FAQ;
  onEdit:   (f: FAQ) => void;
  onDelete: (f: FAQ) => void;
  onToggle: (f: FAQ) => void;
}

function SortableRow({ faq, onEdit, onDelete, onToggle }: SortableRowProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: faq._id });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    zIndex:     isDragging ? 50 : undefined,
    position:   isDragging ? "relative" : undefined,
    opacity:    isDragging ? 0.85 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        "border-b border-[var(--color-border)] last:border-0",
        isDragging ? "bg-[var(--color-primary-light)] shadow-[var(--shadow-md)]" : "bg-white hover:bg-[var(--color-surface)]",
      ].join(" ")}
    >
      {/* Drag handle */}
      <td className="w-10 pl-3 py-3">
        <span
          {...attributes}
          {...listeners}
          className="inline-flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={15} />
        </span>
      </td>

      {/* Question + category */}
      <td className="py-3 px-4">
        <p className="font-medium text-[var(--font-size-sm)] text-[var(--color-text-primary)] line-clamp-2">{faq.question}</p>
        {faq.category && (
          <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{faq.category}</span>
        )}
      </td>

      {/* Order */}
      <td className="py-3 px-4 w-20 text-center">
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">{faq.sortOrder}</span>
      </td>

      {/* Published toggle */}
      <td className="py-3 px-4 w-28">
        <button
          onClick={() => onToggle(faq)}
          className={[
            "flex items-center gap-1.5 text-[var(--font-size-xs)] font-semibold transition-colors",
            faq.isPublished ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]",
          ].join(" ")}
        >
          {faq.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
          {faq.isPublished ? "Published" : "Draft"}
        </button>
      </td>

      {/* Actions */}
      <td className="py-3 pr-4 w-20">
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => onEdit(faq)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(faq)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Page ── */

export default function FAQsPage() {
  const qc = useQueryClient();

  const [items,        setItems]        = useState<FAQ[]>([]);
  const [faqModal,     setFaqModal]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
  const [editingFaq,   setEditingFaq]   = useState<FAQ | null>(null);
  const [faqForm,      setFaqForm]      = useState(BLANK_FAQ);

  const { data: faqsData, isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn:  () => faqsApi.list({ limit: 100 }),
  });

  const faqs = faqsData?.data ?? [];

  useEffect(() => {
    setItems([...faqs].sort((a, b) => a.sortOrder - b.sortOrder));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const faqSave = useMutation({
    mutationFn: () =>
      editingFaq
        ? faqsApi.update(editingFaq._id, faqForm)
        : faqsApi.create(faqForm),
    onSuccess: () => {
      toast.success(editingFaq ? "FAQ updated" : "FAQ created");
      qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      setFaqModal(false);
      setEditingFaq(null);
      setFaqForm(BLANK_FAQ);
    },
    onError: () => toast.error("Failed to save FAQ"),
  });

  const faqDelete = useMutation({
    mutationFn: (id: string) => faqsApi.delete(id),
    onSuccess:  () => {
      toast.success("FAQ deleted");
      qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete FAQ"),
  });

  const sortMut = useMutation({
    mutationFn: (payload: Array<{ id: string; sortOrder: number }>) =>
      faqsApi.reorder(payload),
    onSuccess: () => toast.success("Order saved"),
    onError:   () => toast.error("Failed to save order"),
  });

  function togglePublish(faq: FAQ) {
    faqsApi
      .update(faq._id, { isPublished: !faq.isPublished })
      .then(() => {
        toast.success(faq.isPublished ? "FAQ moved to draft" : "FAQ published");
        qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      })
      .catch(() => toast.error("Failed to update"));
  }

  function openCreate() {
    setEditingFaq(null);
    setFaqForm(BLANK_FAQ);
    setFaqModal(true);
  }

  function openEdit(f: FAQ) {
    setEditingFaq(f);
    setFaqForm({ question: f.question, answer: f.answer, category: f.category, sortOrder: f.sortOrder, isPublished: f.isPublished });
    setFaqModal(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((f) => f._id === String(active.id));
      const newIdx = prev.findIndex((f) => f._id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = arrayMove(prev, oldIdx, newIdx).map((f, i) => ({ ...f, sortOrder: i }));
      sortMut.mutate(next.map((f) => ({ id: f._id, sortOrder: f.sortOrder })));
      return next;
    });
  }

  const total = faqs.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="FAQs"
        description={`${total} question${total !== 1 ? "s" : ""}${total > 1 ? " · drag rows to reorder" : ""}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-faqs"] })}
        refreshing={isFetching}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" /> Add FAQ
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-[var(--radius-lg)] bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No FAQs yet"
          description="Add the first FAQ to help your customers."
          action={<Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1.5" /> Add FAQ</Button>}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="w-10 pl-3" />
                  <th className="py-2.5 px-4 text-left text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Question
                  </th>
                  <th className="py-2.5 px-4 w-20 text-center text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Order
                  </th>
                  <th className="py-2.5 px-4 w-28 text-left text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Published
                  </th>
                  <th className="w-20" />
                </tr>
              </thead>
              <SortableContext items={items.map((f) => f._id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {items.map((f) => (
                    <SortableRow
                      key={f._id}
                      faq={f}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                      onToggle={togglePublish}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={faqModal}
        onClose={() => { setFaqModal(false); setEditingFaq(null); setFaqForm(BLANK_FAQ); }}
        title={editingFaq ? "Edit FAQ" : "Add FAQ"}
        width="max-w-2xl"
      >
        <div className="space-y-4">
          <Input
            label="Question"
            value={faqForm.question}
            onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
            placeholder="What is compounding?"
          />
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
              Answer
            </label>
            <textarea
              value={faqForm.answer}
              onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
              rows={5}
              placeholder="Write the full answer here…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Category"
              value={faqForm.category}
              onChange={(e) => setFaqForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. General, Services"
            />
            <Input
              label="Sort Order"
              type="text"
              inputMode="numeric"
              value={String(faqForm.sortOrder)}
              onChange={(e) =>
                setFaqForm((f) => ({
                  ...f,
                  sortOrder: parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10),
                }))
              }
              placeholder="0"
              hint="You can also drag rows to reorder"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={faqForm.isPublished}
              onChange={(e) => setFaqForm((f) => ({ ...f, isPublished: e.target.checked }))}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
              Published (visible on website)
            </span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => { setFaqModal(false); setEditingFaq(null); setFaqForm(BLANK_FAQ); }}>
              Cancel
            </Button>
            <Button
              loading={faqSave.isPending}
              disabled={!faqForm.question || !faqForm.answer}
              onClick={() => faqSave.mutate()}
            >
              {editingFaq ? "Save Changes" : "Add FAQ"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
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
              loading={faqDelete.isPending}
              onClick={() => deleteTarget && faqDelete.mutate(deleteTarget._id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

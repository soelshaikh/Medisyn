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
import { pharmacistTopicsApi, type PharmacistTopic } from "@/api/ask-pharmacist-topics.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Plus, Edit2, Trash2, GripVertical } from "lucide-react";

const BLANK = { name: "", isActive: true, sortOrder: 0 };

/* ── Sortable row ── */

function SortableRow({
  item, onEdit, onDelete,
}: { item: PharmacistTopic; onEdit: (t: PharmacistTopic) => void; onDelete: (t: PharmacistTopic) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex:    isDragging ? 50 : undefined,
    position:  isDragging ? "relative" : undefined,
    opacity:   isDragging ? 0.85 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        "border-b border-[var(--color-border)] last:border-0",
        isDragging
          ? "bg-[var(--color-primary-light)] shadow-[var(--shadow-md)]"
          : "bg-white hover:bg-[var(--color-surface)]",
      ].join(" ")}
    >
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

      <td className="py-3 px-4">
        <p className="font-medium text-[var(--font-size-sm)] text-[var(--color-text-primary)]">{item.name}</p>
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono mt-0.5">{item.slug}</p>
      </td>

      <td className="py-3 px-4 w-20 text-center">
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">{item.sortOrder}</span>
      </td>

      <td className="py-3 px-4 w-24">
        <StatusBadge status={item.isActive ? "active" : "inactive"} />
      </td>

      <td className="py-3 pr-4 w-28">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onEdit(item)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={() => onDelete(item)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-error)] hover:bg-[var(--color-error-light)] transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Page ── */

export default function PharmacistTopicsPage() {
  const qc = useQueryClient();

  const [items,        setItems]        = useState<PharmacistTopic[]>([]);
  const [modal,        setModal]        = useState(false);
  const [editing,      setEditing]      = useState<PharmacistTopic | null>(null);
  const [form,         setForm]         = useState(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<PharmacistTopic | null>(null);

  const { data: topics = [], isLoading, isFetching, dataUpdatedAt } = useQuery<PharmacistTopic[]>({
    queryKey: ["pharmacist-topics"],
    queryFn:  pharmacistTopicsApi.listAll,
  });

  useEffect(() => {
    setItems([...topics].sort((a, b) => a.sortOrder - b.sortOrder));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? pharmacistTopicsApi.update(editing._id, form)
        : pharmacistTopicsApi.create(form),
    onSuccess: () => {
      toast.success(editing ? "Topic updated" : "Topic created");
      qc.invalidateQueries({ queryKey: ["pharmacist-topics"] });
      setModal(false);
    },
    onError: () => toast.error("Failed to save topic"),
  });

  const deleteMut = useMutation({
    mutationFn: () => pharmacistTopicsApi.delete(deleteTarget!._id),
    onSuccess:  () => {
      toast.success("Topic deleted");
      qc.invalidateQueries({ queryKey: ["pharmacist-topics"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete topic"),
  });

  const sortMut = useMutation({
    mutationFn: (payload: { id: string; sortOrder: number }[]) =>
      pharmacistTopicsApi.batchSortOrder(payload),
    onSuccess: () => toast.success("Order saved"),
    onError:   () => toast.error("Failed to save order"),
  });

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setModal(true);
  }

  function openEdit(t: PharmacistTopic) {
    setEditing(t);
    setForm({ name: t.name, isActive: t.isActive, sortOrder: t.sortOrder });
    setModal(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((t) => t._id === String(active.id));
      const newIdx = prev.findIndex((t) => t._id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = arrayMove(prev, oldIdx, newIdx).map((t, i) => ({ ...t, sortOrder: i }));
      sortMut.mutate(next.map((t) => ({ id: t._id, sortOrder: t.sortOrder })));
      return next;
    });
  }

  const total = topics.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ask Pharmacist — Topics"
        description={`${total} topic${total !== 1 ? "s" : ""}${total > 1 ? " · drag rows to reorder" : ""}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["pharmacist-topics"] })}
        refreshing={isFetching}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" /> Add Topic
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-[var(--radius-lg)] bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No topics yet"
          description="Add service topics so patients can categorise their pharmacist questions."
          action={<Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1.5" /> Add Topic</Button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="w-10 pl-3" />
                  <th className="py-2.5 px-4 text-left text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Topic / Service
                  </th>
                  <th className="py-2.5 px-4 w-20 text-center text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Order
                  </th>
                  <th className="py-2.5 px-4 w-24 text-left text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="w-28" />
                </tr>
              </thead>
              <SortableContext items={items.map((t) => t._id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {items.map((t) => (
                    <SortableRow key={t._id} item={t} onEdit={openEdit} onDelete={setDeleteTarget} />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Edit Topic" : "Add Topic"}
        width="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="Topic Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Hormone Therapy"
          />
          <Input
            label="Sort Order"
            type="text"
            inputMode="numeric"
            value={String(form.sortOrder)}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value.replace(/[^0-9]/g, "") || "0", 10) }))}
            placeholder="0"
            hint="You can also drag rows to reorder"
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
              Active (shown to patients)
            </span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button
              loading={saveMut.isPending}
              disabled={!form.name.trim()}
              onClick={() => saveMut.mutate()}
            >
              {editing ? "Save Changes" : "Add Topic"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Topic">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

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
import { ailmentsApi, type AilmentCatalogItem } from "@/api/minor-ailments.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Plus, Edit2, Trash2, GripVertical } from "lucide-react";

const BLANK = { name: "", description: "", isActive: true, sortOrder: 0 };

/* ── Sortable table row ── */

interface SortableRowProps {
  item:    AilmentCatalogItem;
  onEdit:  (a: AilmentCatalogItem) => void;
  onDelete:(a: AilmentCatalogItem) => void;
}

function SortableRow({ item, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: item._id });

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

      {/* Name / slug */}
      <td className="py-3 px-4">
        <p className="font-medium text-[var(--font-size-sm)] text-[var(--color-text-primary)]">{item.name}</p>
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono mt-0.5">{item.slug}</p>
      </td>

      {/* Description */}
      <td className="py-3 px-4 max-w-sm">
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] line-clamp-2">
          {item.description || <span className="italic">—</span>}
        </span>
      </td>

      {/* Order */}
      <td className="py-3 px-4 w-20 text-center">
        <span className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">{item.sortOrder}</span>
      </td>

      {/* Status */}
      <td className="py-3 px-4 w-24">
        <StatusBadge status={item.isActive ? "active" : "inactive"} />
      </td>

      {/* Actions */}
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

export default function MinorAilmentsPage() {
  const qc = useQueryClient();

  const [items,        setItems]        = useState<AilmentCatalogItem[]>([]);
  const [modal,        setModal]        = useState(false);
  const [editing,      setEditing]      = useState<AilmentCatalogItem | null>(null);
  const [form,         setForm]         = useState(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<AilmentCatalogItem | null>(null);

  const { data: ailments = [], isLoading, isFetching, dataUpdatedAt } = useQuery<AilmentCatalogItem[]>({
    queryKey: ["admin-ailments"],
    queryFn:  ailmentsApi.listAll,
  });

  useEffect(() => {
    setItems([...ailments].sort((a, b) => a.sortOrder - b.sortOrder));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? ailmentsApi.update(editing._id, { name: form.name, description: form.description, isActive: form.isActive, sortOrder: form.sortOrder })
        : ailmentsApi.create({ name: form.name, description: form.description, isActive: form.isActive, sortOrder: form.sortOrder }),
    onSuccess: () => {
      toast.success(editing ? "Ailment updated" : "Ailment created");
      qc.invalidateQueries({ queryKey: ["admin-ailments"] });
      setModal(false);
    },
    onError: () => toast.error("Failed to save ailment"),
  });

  const deleteMut = useMutation({
    mutationFn: () => ailmentsApi.delete(deleteTarget!._id),
    onSuccess:  () => {
      toast.success("Ailment deleted");
      qc.invalidateQueries({ queryKey: ["admin-ailments"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete ailment"),
  });

  const sortMut = useMutation({
    mutationFn: (payload: { id: string; sortOrder: number }[]) =>
      ailmentsApi.batchSortOrder(payload),
    onSuccess: () => toast.success("Order saved"),
    onError:   () => toast.error("Failed to save order"),
  });

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setModal(true);
  }

  function openEdit(a: AilmentCatalogItem) {
    setEditing(a);
    setForm({ name: a.name, description: a.description, isActive: a.isActive, sortOrder: a.sortOrder });
    setModal(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((a) => a._id === String(active.id));
      const newIdx = prev.findIndex((a) => a._id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = arrayMove(prev, oldIdx, newIdx).map((a, i) => ({ ...a, sortOrder: i }));
      sortMut.mutate(next.map((a) => ({ id: a._id, sortOrder: a.sortOrder })));
      return next;
    });
  }

  const total = ailments.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Minor Ailments Catalog"
        description={`${total} service${total !== 1 ? "s" : ""}${total > 1 ? " · drag rows to reorder" : ""}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-ailments"] })}
        refreshing={isFetching}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" /> Add Ailment
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
          title="No ailment services yet"
          description="Add the first minor ailment service to enable patient submissions."
          action={<Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1.5" /> Add Ailment</Button>}
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
                    Ailment / Service
                  </th>
                  <th className="py-2.5 px-4 text-left text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Description
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
              <SortableContext items={items.map((a) => a._id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {items.map((a) => (
                    <SortableRow
                      key={a._id}
                      item={a}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
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
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Edit Ailment Service" : "Add Ailment Service"}
        width="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Urinary Tract Infection (UTI)"
          />
          <div className="space-y-1">
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              maxLength={500}
              placeholder="Brief description of the ailment service…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
            />
            <p className="text-right text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
              {form.description.length}/500
            </p>
          </div>
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
              Active (visible to patients)
            </span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button
              loading={saveMut.isPending}
              disabled={!form.name.trim()}
              onClick={() => saveMut.mutate()}
            >
              {editing ? "Save Changes" : "Add Ailment"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Ailment Service"
      >
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

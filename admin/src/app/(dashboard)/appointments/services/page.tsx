"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { vaccineServicesApi } from "@/api/appointments.api";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { Plus, Pencil, Power, Clock, CheckCircle, XCircle, GripVertical } from "lucide-react";
import type { VaccineService } from "@/types/admin";

const BLANK = {
  name: "", slug: "", description: "", eligibilityNotes: "",
  durationMinutes: "30", sortOrder: "0",
};

/* ── Sortable card ── */

interface SortableCardProps {
  svc:      VaccineService;
  onEdit:   (svc: VaccineService) => void;
  onToggle: (svc: VaccineService) => void;
}

function SortableCard({ svc, onEdit, onToggle }: SortableCardProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: svc._id });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    zIndex:     isDragging ? 50 : undefined,
    position:   isDragging ? "relative" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "relative bg-white rounded-[var(--radius-xl)] border flex flex-col p-5 gap-3",
        isDragging
          ? "shadow-[var(--shadow-xl)] ring-2 ring-[var(--color-primary)] ring-offset-2 opacity-90"
          : svc.status === "inactive"
            ? "border-[var(--color-border)] shadow-[var(--shadow-sm)] opacity-60"
            : "border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow",
      ].join(" ")}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 p-1 rounded-[var(--radius-sm)] text-[var(--color-text-disabled)] hover:text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </div>

      {/* Name + status */}
      <div className="flex items-start gap-2 pr-8">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text-primary)] text-[var(--font-size-md)] leading-tight">
            {svc.name}
          </p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono mt-0.5">
            {svc.slug}
          </p>
        </div>
        <StatusBadge status={svc.status} />
      </div>

      {/* Description */}
      {svc.description && (
        <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)] line-clamp-2 flex-1">
          {svc.description}
        </p>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 pt-1 border-t border-[var(--color-border)]">
        <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          <Clock size={13} /> {svc.durationMinutes} min
        </span>
        {svc.eligibilityNotes && (
          <span className="text-[var(--font-size-xs)] text-[var(--color-info)] truncate flex-1">
            {svc.eligibilityNotes}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEdit(svc)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--font-size-xs)] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)]"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() => onToggle(svc)}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--font-size-xs)] font-medium transition-colors border",
            svc.status === "active"
              ? "text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-light)]"
              : "text-[var(--color-success)] border-[var(--color-success-border)] hover:bg-[var(--color-success-light)]",
          ].join(" ")}
        >
          <Power size={13} />
          {svc.status === "active" ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function VaccineServicesPage() {
  const qc = useQueryClient();

  const [items,         setItems]         = useState<VaccineService[]>([]);
  const [createModal,   setCreateModal]   = useState(false);
  const [editModal,     setEditModal]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<VaccineService | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<VaccineService | null>(null);
  const [form,          setForm]          = useState({ ...BLANK });

  const { data: services = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["vaccine-services-admin"],
    queryFn:  vaccineServicesApi.listAdmin,
  });

  useEffect(() => {
    setItems([...services].sort((a, b) => a.sortOrder - b.sortOrder));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const createMut = useMutation({
    mutationFn: () => vaccineServicesApi.create({
      ...form,
      durationMinutes: Number(form.durationMinutes),
      sortOrder:       Number(form.sortOrder),
    }),
    onSuccess: () => {
      toast.success("Vaccine service created");
      qc.invalidateQueries({ queryKey: ["vaccine-services-admin"] });
      setCreateModal(false);
      setForm({ ...BLANK });
    },
    onError: () => toast.error("Failed to create vaccine service"),
  });

  const updateMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      vaccineServicesApi.update(editTarget!._id, payload),
    onSuccess: () => {
      toast.success("Vaccine service updated");
      qc.invalidateQueries({ queryKey: ["vaccine-services-admin"] });
      setEditModal(false);
    },
    onError: () => toast.error("Failed to update vaccine service"),
  });

  const toggleMut = useMutation({
    mutationFn: (svc: VaccineService) =>
      vaccineServicesApi.update(svc._id, { status: svc.status === "active" ? "inactive" : "active" }),
    onSuccess: (_, svc) => {
      toast.success(`${svc.name} ${svc.status === "active" ? "deactivated" : "activated"}`);
      qc.invalidateQueries({ queryKey: ["vaccine-services-admin"] });
      setConfirmToggle(null);
    },
    onError: () => toast.error("Failed to update status"),
  });

  const sortMut = useMutation({
    mutationFn: (payload: { id: string; sortOrder: number }[]) =>
      vaccineServicesApi.batchSortOrder(payload),
    onSuccess: () => toast.success("Order saved"),
    onError:   () => toast.error("Failed to save order"),
  });

  function openEdit(svc: VaccineService) {
    setEditTarget(svc);
    setForm({
      name:             svc.name,
      slug:             svc.slug,
      description:      svc.description,
      eligibilityNotes: svc.eligibilityNotes ?? "",
      durationMinutes:  String(svc.durationMinutes),
      sortOrder:        String(svc.sortOrder),
    });
    setEditModal(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIdx = prev.findIndex((s) => s._id === String(active.id));
      const newIdx = prev.findIndex((s) => s._id === String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      sortMut.mutate(next.map((s, i) => ({ id: s._id, sortOrder: i })));
      return next;
    });
  }

  const activeCount   = services.filter((s) => s.status === "active").length;
  const inactiveCount = services.filter((s) => s.status === "inactive").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaccine Services"
        description={`${activeCount} active · ${inactiveCount} inactive${items.length > 1 ? " · drag cards to reorder" : ""}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["vaccine-services-admin"] })}
        actions={
          <Button onClick={() => { setForm({ ...BLANK }); setCreateModal(true); }}>
            <Plus size={16} className="mr-1.5" /> Add Vaccine
          </Button>
        }
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-[var(--radius-xl)] bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No vaccine services yet"
          description="Add your first vaccine service to start managing appointment slots."
          action={
            <Button onClick={() => { setForm({ ...BLANK }); setCreateModal(true); }}>
              <Plus size={16} className="mr-1.5" /> Add Vaccine
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((s) => s._id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((svc) => (
                <SortableCard
                  key={svc._id}
                  svc={svc}
                  onEdit={openEdit}
                  onToggle={setConfirmToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Toggle confirmation */}
      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => confirmToggle && toggleMut.mutate(confirmToggle)}
        title={confirmToggle?.status === "active" ? "Deactivate vaccine?" : "Activate vaccine?"}
        description={
          confirmToggle?.status === "active"
            ? `"${confirmToggle?.name}" will be hidden from patients and no longer bookable.`
            : `"${confirmToggle?.name}" will become available for patient bookings.`
        }
        confirmLabel={confirmToggle?.status === "active" ? "Deactivate" : "Activate"}
        destructive={confirmToggle?.status === "active"}
        loading={toggleMut.isPending}
      />

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add Vaccine Service">
        <VaccineServiceForm
          form={form}
          setForm={setForm}
          onSubmit={() => createMut.mutate()}
          onCancel={() => setCreateModal(false)}
          loading={createMut.isPending}
          submitLabel="Create"
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit: ${editTarget?.name ?? ""}`}
      >
        <VaccineServiceForm
          form={form}
          setForm={setForm}
          onSubmit={() =>
            updateMut.mutate({
              ...form,
              durationMinutes: Number(form.durationMinutes),
              sortOrder:       Number(form.sortOrder),
            })
          }
          onCancel={() => setEditModal(false)}
          loading={updateMut.isPending}
          submitLabel="Save Changes"
        />
      </Modal>
    </div>
  );
}

/* ── Vaccine service form (shared create / edit) ── */

interface FormState {
  name: string; slug: string; description: string;
  eligibilityNotes: string; durationMinutes: string; sortOrder: string;
}

interface FormProps {
  form:        FormState;
  setForm:     React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit:    () => void;
  onCancel:    () => void;
  loading:     boolean;
  submitLabel: string;
}

function VaccineServiceForm({ form, setForm, onSubmit, onCancel, loading, submitLabel }: FormProps) {
  const str = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name"  value={form.name}  onChange={str("name")}  placeholder="e.g. Influenza Vaccine" />
        <Input label="Slug"  value={form.slug}  onChange={str("slug")}  placeholder="e.g. influenza-flu" />
      </div>

      <div>
        <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={str("description")}
          rows={3}
          placeholder="Patient-facing description…"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
          Eligibility Notes
        </label>
        <textarea
          value={form.eligibilityNotes}
          onChange={str("eligibilityNotes")}
          rows={2}
          placeholder="Who is eligible, age groups, contraindications…"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)] outline-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberInput
          label="Duration (minutes)"
          value={form.durationMinutes}
          onChange={(v) => setForm((p) => ({ ...p, durationMinutes: v }))}
          placeholder="30"
        />
        <NumberInput
          label="Sort Order"
          value={form.sortOrder}
          onChange={(v) => setForm((p) => ({ ...p, sortOrder: v }))}
          hint="Lower = shown first"
          placeholder="0"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button loading={loading} disabled={!form.name || !form.slug} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

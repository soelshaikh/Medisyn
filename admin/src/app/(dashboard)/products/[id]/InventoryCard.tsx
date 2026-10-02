"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Layers, Activity, Ban, Pencil, SlidersHorizontal,
} from "lucide-react";
import { Button }      from "@/components/ui/Button";
import { Input }        from "@/components/ui/Input";
import { NumberInput }  from "@/components/ui/NumberInput";
import { DatePicker }   from "@/components/ui/DatePicker";
import { Modal }        from "@/components/ui/Modal";
import { Spinner }      from "@/components/ui/Spinner";
import { Tooltip }      from "@/components/ui/Tooltip";
import { inventoryApi } from "@/api/products.api";
import type { ProductBatch, InventoryMovement } from "@/types/admin";

/* ── helpers ── */
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
function daysUntil(s: string) {
  const diff = new Date(s).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function batchStatusColor(b: ProductBatch, alertDays: number) {
  if (b.status === "recalled")         return "text-[var(--color-error)] bg-[var(--color-error-light)]";
  if (b.status === "depleted")         return "text-[var(--color-text-muted)] bg-[var(--color-surface)]";
  if (b.status === "expired")          return "text-[var(--color-error)] bg-[var(--color-error-light)]";
  const days = daysUntil(b.expiryDate);
  if (days <= alertDays)               return "text-[var(--color-warning)] bg-[var(--color-warning-light)]";
  return "text-[var(--color-success)] bg-[var(--color-success-light)]";
}
function batchStatusLabel(b: ProductBatch, alertDays: number) {
  if (b.status === "recalled") return "Recalled";
  if (b.status === "depleted") return "Depleted";
  if (b.status === "expired")  return "Expired";
  const days = daysUntil(b.expiryDate);
  if (days <= 0)               return "Expired";
  if (days <= alertDays)       return `Exp in ${days}d`;
  return "Active";
}

const movementTypeLabel: Record<string, string> = {
  batch_received:   "Received",
  order_fulfilled:  "Fulfilled",
  order_cancelled:  "Cancelled",
  manual_adjustment:"Adjustment",
  batch_recalled:   "Recalled",
  expired_writeoff: "Writeoff",
};
const movementTypeColor: Record<string, string> = {
  batch_received:    "text-[var(--color-success)]",
  order_fulfilled:   "text-[var(--color-error)]",
  order_cancelled:   "text-[var(--color-info)]",
  manual_adjustment: "text-[var(--color-warning)]",
  batch_recalled:    "text-[var(--color-error)]",
  expired_writeoff:  "text-[var(--color-text-muted)]",
};

/* ── sub-components ── */

function MovementsDrawer({ productId, batchId, batchNumber }: { productId: string; batchId: string; batchNumber: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["batch-movements", batchId],
    queryFn:  () => inventoryApi.batchMovements(productId, batchId),
  });

  return (
    <div className="space-y-2">
      <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        Movement History — {batchNumber}
      </p>
      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : (data?.data ?? []).length === 0 ? (
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">No movements yet</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {(data?.data as InventoryMovement[]).map((m) => (
            <div key={m._id} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <span className={`min-w-[80px] text-[var(--font-size-xs)] font-semibold ${movementTypeColor[m.movementType] ?? ""}`}>
                {movementTypeLabel[m.movementType] ?? m.movementType}
              </span>
              <span className={`text-[var(--font-size-sm)] font-mono font-bold ${m.qty > 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
                {m.qty > 0 ? `+${m.qty}` : m.qty}
              </span>
              <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{m.qtyBefore} → {m.qtyAfter}</span>
              {m.notes && <span className="flex-1 truncate text-[var(--font-size-xs)] text-[var(--color-text-secondary)]">{m.notes}</span>}
              <span className="shrink-0 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{fmtDate(m.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */

interface Props {
  productId:   string;
  productName: string;
  inventory:   {
    quantity:             number;
    lowStockThreshold:    number;
    trackInventory:       boolean;
    batchTrackingEnabled: boolean;
    nearExpiryAlertDays:  number;
  } | undefined;
}

export function InventoryCard({ productId, productName, inventory }: Props) {
  const qc = useQueryClient();

  /* UI state */
  const [showBatchForm,    setShowBatchForm]    = useState(false);
  const [showAdjustModal,  setShowAdjustModal]  = useState(false);
  const [adjustDelta,      setAdjustDelta]      = useState("");
  const [adjustReason,     setAdjustReason]     = useState("");
  const [expandedBatch,    setExpandedBatch]    = useState<string | null>(null);
  const [recallBatchId,    setRecallBatchId]    = useState<string | null>(null);
  const [recallReason,     setRecallReason]     = useState("");
  const [adjustBatchId,    setAdjustBatchId]    = useState<string | null>(null);
  const [batchDelta,       setBatchDelta]       = useState("");
  const [batchReason,      setBatchReason]      = useState("");

  /* Edit batch state */
  const [editBatch,        setEditBatch]        = useState<ProductBatch | null>(null);
  const [editBatchNum,     setEditBatchNum]     = useState("");
  const [editExpiry,       setEditExpiry]       = useState("");
  const [editMfgDate,      setEditMfgDate]      = useState("");
  const [editSupplier,     setEditSupplier]     = useState("");
  const [editPO,           setEditPO]           = useState("");
  const [editNotes,        setEditNotes]        = useState("");

  /* Add batch form state */
  const [batchNum,     setBatchNum]     = useState("");
  const [expiryDate,   setExpiryDate]   = useState("");
  const [mfgDate,      setMfgDate]      = useState("");
  const [batchQty,     setBatchQty]     = useState("");
  const [batchSupplier,setBatchSupplier] = useState("");
  const [batchPO,      setBatchPO]      = useState("");
  const [batchNotes,   setBatchNotes]   = useState("");

  /* Queries */
  const batchQuery = useQuery({
    queryKey: ["product-batches", productId],
    queryFn:  () => inventoryApi.listBatches(productId),
    enabled:  !!inventory?.batchTrackingEnabled,
  });
  const batches: ProductBatch[] = batchQuery.data ?? [];
  const alertDays = inventory?.nearExpiryAlertDays ?? 90;

  /* Mutations */
  const toggleBatchMut = useMutation({
    mutationFn: (enabled: boolean) =>
      inventoryApi.update(productId, { batchTrackingEnabled: enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", productId] }),
  });

  const addBatchMut = useMutation({
    mutationFn: () => inventoryApi.addBatch(productId, {
      batchNumber:      batchNum.trim(),
      expiryDate:       new Date(expiryDate).toISOString(),
      manufacturedDate: mfgDate ? new Date(mfgDate).toISOString() : null,
      initialQty:       parseInt(batchQty, 10),
      supplier:         batchSupplier.trim() || undefined,
      purchaseOrderRef: batchPO.trim() || undefined,
      notes:            batchNotes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-batches", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
      setBatchNum(""); setExpiryDate(""); setMfgDate(""); setBatchQty("");
      setBatchSupplier(""); setBatchPO(""); setBatchNotes("");
      setShowBatchForm(false);
    },
  });

  const recallMut = useMutation({
    mutationFn: () => inventoryApi.recallBatch(productId, recallBatchId!, recallReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-batches", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
      setRecallBatchId(null); setRecallReason("");
    },
  });

  const adjustBatchMut = useMutation({
    mutationFn: () => inventoryApi.adjustBatch(
      productId, adjustBatchId!, parseInt(batchDelta, 10), batchReason,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-batches", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
      setAdjustBatchId(null); setBatchDelta(""); setBatchReason("");
    },
  });

  const adjustAggregateMut = useMutation({
    mutationFn: () => inventoryApi.adjust(productId, parseInt(adjustDelta, 10)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product", productId] });
      setShowAdjustModal(false); setAdjustDelta(""); setAdjustReason("");
    },
  });

  const editBatchMut = useMutation({
    mutationFn: () => inventoryApi.updateBatch(productId, editBatch!._id, {
      batchNumber:      editBatchNum.trim() || undefined,
      expiryDate:       editExpiry ? new Date(editExpiry).toISOString() : undefined,
      manufacturedDate: editMfgDate ? new Date(editMfgDate).toISOString() : null,
      supplier:         editSupplier.trim() || null,
      purchaseOrderRef: editPO.trim() || null,
      notes:            editNotes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-batches", productId] });
      setEditBatch(null);
    },
  });

  function openEditBatch(b: ProductBatch) {
    setEditBatch(b);
    setEditBatchNum(b.batchNumber);
    setEditExpiry(b.expiryDate ? b.expiryDate.slice(0, 10) : "");
    setEditMfgDate(b.manufacturedDate ? b.manufacturedDate.slice(0, 10) : "");
    setEditSupplier(b.supplier ?? "");
    setEditPO(b.purchaseOrderRef ?? "");
    setEditNotes(b.notes ?? "");
  }

  if (!inventory) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
        <div className="border-b border-[var(--color-border)] px-4 py-2.5">
          <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Inventory</h2>
        </div>
        <div className="p-4">
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">No inventory record configured.</p>
        </div>
      </div>
    );
  }

  const isLow = inventory.trackInventory && inventory.quantity <= inventory.lowStockThreshold;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">

      {/* Card header */}
      <div className="border-b border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Inventory</h2>
        {inventory.batchTrackingEnabled && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
            <Layers size={10} /> Batch Mode
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Aggregate stats */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          {[
            { label: "Total stock",  value: String(inventory.quantity),          danger: isLow },
            { label: "Low stock at", value: String(inventory.lowStockThreshold), danger: false },
            { label: "Tracking",     value: inventory.trackInventory ? "Enabled" : "Disabled", danger: false },
          ].map(({ label, value, danger }, i, arr) => (
            <div
              key={label}
              className={[
                "flex items-center justify-between px-3 py-2 text-[var(--font-size-sm)]",
                i < arr.length - 1 ? "border-b border-[var(--color-border)]" : "",
              ].join(" ")}
            >
              <span className="text-[var(--color-text-muted)]">{label}</span>
              <span className={[
                "font-semibold tabular-nums",
                danger ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)]",
              ].join(" ")}>{value}</span>
            </div>
          ))}
        </div>

        {/* Batch tracking toggle */}
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-3">
          <div className="min-w-0">
            <p className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Batch Tracking</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5">
              {inventory.batchTrackingEnabled ? "FEFO lot allocation active" : "Off — using aggregate stock"}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={inventory.batchTrackingEnabled}
            onClick={() => toggleBatchMut.mutate(!inventory.batchTrackingEnabled)}
            disabled={toggleBatchMut.isPending}
            className={[
              "relative shrink-0 h-6 w-11 rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1",
              inventory.batchTrackingEnabled
                ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                : "bg-slate-200 border-slate-200",
              toggleBatchMut.isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <span className={[
              "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              inventory.batchTrackingEnabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")} />
          </button>
        </div>

        {/* Batch tracking UI */}
        {inventory.batchTrackingEnabled ? (
          <div className="space-y-3">

            {/* Batch list */}
            {batchQuery.isLoading ? (
              <div className="flex justify-center py-3"><Spinner size="sm" /></div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] py-5 text-center">
                <Package size={20} className="text-[var(--color-border)]" />
                <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">No batches yet — add the first one below</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {batches.map((b) => {
                  const isExpanded = expandedBatch === b._id;
                  const statusCls  = batchStatusColor(b, alertDays);
                  const statusLbl  = batchStatusLabel(b, alertDays);
                  const nearExpiry = b.status === "active" && daysUntil(b.expiryDate) <= alertDays && daysUntil(b.expiryDate) > 0;

                  return (
                    <div key={b._id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
                      {/* Batch row */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-white">
                        <button
                          onClick={() => setExpandedBatch(isExpanded ? null : b._id)}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[var(--font-size-xs)] font-bold text-[var(--color-text-primary)]">
                              {b.batchNumber}
                            </span>
                            {nearExpiry && <AlertTriangle size={11} className="text-[var(--color-warning)]" />}
                          </div>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            Exp: {fmtDate(b.expiryDate)}
                            {b.supplier && ` · ${b.supplier}`}
                          </p>
                        </div>

                        <span className="font-mono text-[var(--font-size-sm)] font-bold text-[var(--color-text-primary)]">
                          {b.currentQty}
                        </span>

                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
                          {statusLbl}
                        </span>

                        {b.status !== "recalled" && (
                          <div className="flex items-center gap-1">
                            <Tooltip content="Edit batch details" side="top">
                              <button
                                type="button"
                                onClick={() => openEditBatch(b)}
                                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] transition-colors"
                              >
                                <Pencil size={12} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Adjust stock" side="top">
                              <button
                                type="button"
                                onClick={() => { setAdjustBatchId(b._id); setBatchDelta(""); setBatchReason(""); }}
                                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] transition-colors"
                              >
                                <SlidersHorizontal size={12} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Recall batch" side="top">
                              <button
                                type="button"
                                onClick={() => { setRecallBatchId(b._id); setRecallReason(""); }}
                                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-error-light)] hover:text-[var(--color-error)] transition-colors"
                              >
                                <Ban size={12} />
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </div>

                      {/* Expanded: movement history */}
                      {isExpanded && (
                        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                          <MovementsDrawer productId={productId} batchId={b._id} batchNumber={b.batchNumber} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add batch form toggle */}
            {!showBatchForm ? (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setShowBatchForm(true)}>
                <Plus size={13} className="mr-1.5" /> Add Batch
              </Button>
            ) : (
              <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-3">
                <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)]">New Batch</p>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Batch / Lot #*"
                    value={batchNum}
                    onChange={(e) => setBatchNum(e.target.value.replace(/[^A-Za-z0-9\-]/g, ""))}
                    placeholder="e.g. DOLO-2025-B01"
                  />
                  <NumberInput
                    label="Initial Qty*"
                    value={batchQty}
                    onChange={setBatchQty}
                    placeholder="100"
                    min={1}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    label="Expiry Date*"
                    value={expiryDate}
                    onChange={setExpiryDate}
                    placeholder="Pick expiry date…"
                  />
                  <DatePicker
                    label="Mfg. Date"
                    value={mfgDate}
                    onChange={setMfgDate}
                    placeholder="Pick mfg. date…"
                  />
                </div>

                <Input
                  label="Supplier"
                  value={batchSupplier}
                  onChange={(e) => setBatchSupplier(e.target.value)}
                  placeholder="Supplier name"
                />

                <Input
                  label="PO Reference"
                  value={batchPO}
                  onChange={(e) => setBatchPO(e.target.value)}
                  placeholder="PO-2025-0001"
                />

                <div>
                  <label className="mb-1 block text-[var(--font-size-xs)] font-medium text-[var(--color-text-primary)]">Notes</label>
                  <textarea value={batchNotes} onChange={(e) => setBatchNotes(e.target.value)} rows={2} placeholder="Optional notes" className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-colors" />
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => setShowBatchForm(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    loading={addBatchMut.isPending}
                    disabled={!batchNum.trim() || !expiryDate || !batchQty || parseInt(batchQty) < 1}
                    onClick={() => addBatchMut.mutate()}
                  >
                    <CheckCircle2 size={13} className="mr-1.5" /> Save Batch
                  </Button>
                </div>

                {addBatchMut.isError && (
                  <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">
                    {(addBatchMut.error as Error).message}
                  </p>
                )}
              </div>
            )}

            {/* Movement log link */}
            <button
              className="flex w-full items-center justify-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              onClick={() => setExpandedBatch(null)}
            >
              <Activity size={11} /> Click a batch row to view movement history
            </button>

          </div>
        ) : (
          /* Non-batch mode: simple adjust */
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[var(--font-size-xs)] font-semibold text-[var(--color-text-primary)]">Aggregate stock</p>
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Manually correct the stock count</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => { setAdjustDelta(""); setShowAdjustModal(true); }}
            >
              Adjust Stock
            </Button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Non-batch adjust modal */}
      <Modal open={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Adjust Stock">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Current qty: <strong>{inventory.quantity}</strong>. Enter positive to add, negative to subtract.
          </p>
          <Input
            label="Adjustment"
            type="text"
            inputMode="numeric"
            value={adjustDelta}
            onChange={(e) => setAdjustDelta(e.target.value.replace(/[^0-9-]/g, ""))}
            placeholder="e.g. 10 or -5"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAdjustModal(false)}>Cancel</Button>
            <Button
              loading={adjustAggregateMut.isPending}
              disabled={!adjustDelta || adjustDelta === "-" || parseInt(adjustDelta) === 0}
              onClick={() => adjustAggregateMut.mutate()}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recall batch modal */}
      <Modal
        open={!!recallBatchId}
        onClose={() => { setRecallBatchId(null); setRecallReason(""); }}
        title="Recall Batch"
      >
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Recalling a batch removes all remaining stock and marks it as recalled. This cannot be undone.
          </p>
          <div>
            <label className="mb-1 block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">Recall Reason*</label>
            <textarea
              rows={3}
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              placeholder="e.g. Contamination detected, supplier notification"
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setRecallBatchId(null); setRecallReason(""); }}>Cancel</Button>
            <Button
              variant="danger"
              loading={recallMut.isPending}
              disabled={recallReason.trim().length < 5}
              onClick={() => recallMut.mutate()}
            >
              Recall Batch
            </Button>
          </div>
          {recallMut.isError && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{(recallMut.error as Error).message}</p>
          )}
        </div>
      </Modal>

      {/* Batch adjust modal */}
      <Modal
        open={!!adjustBatchId}
        onClose={() => { setAdjustBatchId(null); setBatchDelta(""); setBatchReason(""); }}
        title="Adjust Batch Stock"
      >
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Enter positive to add stock, negative to subtract. A reason is required for audit purposes.
          </p>
          <Input
            label="Adjustment"
            type="text"
            inputMode="numeric"
            value={batchDelta}
            onChange={(e) => setBatchDelta(e.target.value.replace(/[^0-9-]/g, ""))}
            placeholder="e.g. 10 or -5"
          />
          <Input
            label="Reason*"
            value={batchReason}
            onChange={(e) => setBatchReason(e.target.value)}
            placeholder="e.g. Damaged units removed"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setAdjustBatchId(null); setBatchDelta(""); setBatchReason(""); }}>Cancel</Button>
            <Button
              loading={adjustBatchMut.isPending}
              disabled={!batchDelta || batchDelta === "-" || parseInt(batchDelta) === 0 || batchReason.trim().length < 3}
              onClick={() => adjustBatchMut.mutate()}
            >
              Apply
            </Button>
          </div>
          {adjustBatchMut.isError && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{(adjustBatchMut.error as Error).message}</p>
          )}
        </div>
      </Modal>

      {/* Edit batch modal */}
      <Modal
        open={!!editBatch}
        onClose={() => setEditBatch(null)}
        title="Edit Batch"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batch / Lot #*"
              value={editBatchNum}
              onChange={(e) => setEditBatchNum(e.target.value.replace(/[^A-Za-z0-9\-]/g, ""))}
              placeholder="e.g. DOLO-2025-B01"
            />
            <div />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Expiry Date*"
              value={editExpiry}
              onChange={setEditExpiry}
              placeholder="Pick expiry date…"
            />
            <DatePicker
              label="Mfg. Date"
              value={editMfgDate}
              onChange={setEditMfgDate}
              placeholder="Pick mfg. date…"
            />
          </div>

          <Input
            label="Supplier"
            value={editSupplier}
            onChange={(e) => setEditSupplier(e.target.value)}
            placeholder="Supplier name"
          />

          <Input
            label="PO Reference"
            value={editPO}
            onChange={(e) => setEditPO(e.target.value)}
            placeholder="PO-2025-0001"
          />

          <div>
            <label className="mb-1 block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">Notes</label>
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditBatch(null)}>Cancel</Button>
            <Button
              loading={editBatchMut.isPending}
              disabled={!editBatchNum.trim() || !editExpiry}
              onClick={() => editBatchMut.mutate()}
            >
              Save Changes
            </Button>
          </div>

          {editBatchMut.isError && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">{(editBatchMut.error as Error).message}</p>
          )}
        </div>
      </Modal>

    </div>
  );
}

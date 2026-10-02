"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/api/orders.api";
import { inventoryApi } from "@/api/products.api";
import { fmtDateTime } from "@/lib/format";
import { DetailCard } from "@/components/common/DetailCard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatusHistory } from "@/components/common/StatusHistory";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { Layers, AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import type { BatchAllocation, ProductBatch } from "@/types/admin";
import { AdminThreadPanel } from "@/components/common/AdminThreadPanel";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "ready_for_pickup", "delivered", "cancelled"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const [statusModal,    setStatusModal]    = useState(false);
  const [noteModal,      setNoteModal]      = useState(false);
  const [newStatus,      setNewStatus]      = useState("");
  const [statusNote,     setStatusNote]     = useState("");
  const [noteText,       setNoteText]       = useState("");
  const [batchModal,     setBatchModal]     = useState(false);
  const [overrideLines,  setOverrideLines]  = useState<Array<{
    productId: string; productName: string;
    batchId: string; batchNumber: string; expiryDate: string; allocatedQty: number;
  }>>([]);
  const [overrideProductId, setOverrideProductId] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn:  () => ordersApi.getById(id),
  });

  const statusMut = useMutation({
    mutationFn: () => ordersApi.updateStatus(id, newStatus, statusNote),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-order", id] }); setStatusModal(false); setStatusNote(""); },
  });

  const noteMut = useMutation({
    mutationFn: () => ordersApi.addNote(id, noteText),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-order", id] }); setNoteModal(false); setNoteText(""); },
  });

  const overrideMut = useMutation({
    mutationFn: () => ordersApi.overrideBatchAllocations(id, overrideLines),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-order", id] }); setBatchModal(false); },
  });

  /* Fetch available batches for the currently-selected product in the override modal */
  const { data: availBatches } = useQuery<ProductBatch[]>({
    queryKey: ["product-batches", overrideProductId],
    queryFn:  () => inventoryApi.listBatches(overrideProductId!),
    enabled:  !!overrideProductId,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!order)    return <p className="text-[var(--color-text-muted)]">Order not found.</p>;

  const populatedUser = order.userId && typeof order.userId === "object" ? order.userId : null;
  const customerName  = populatedUser?.fullName  ?? order.guestInfo?.fullName;
  const customerEmail = populatedUser?.email      ?? order.guestInfo?.email;
  const customerPhone = populatedUser?.phone      ?? order.guestInfo?.phone;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${fmtDateTime(order.createdAt)}`}
        onBack="auto"
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(order.status); setStatusModal(true); }}>
              Update Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNoteModal(true)}>
              Add Note
            </Button>
          </div>
        }
      />

      {/* Customer */}
      <DetailCard
        title="Customer"
        fields={[
          { label: "Name",    value: customerName },
          { label: "Email",   value: customerEmail },
          { label: "Phone",   value: customerPhone },
          { label: "Payment", value: order.paymentMethod.replace(/_/g, " ") },
        ]}
      />

      {/* Shipping */}
      <DetailCard
        title="Shipping Address"
        fields={[
          { label: "Name",     value: order.shippingAddress.fullName },
          { label: "City",     value: order.shippingAddress.city },
          { label: "Province", value: order.shippingAddress.province },
          { label: "Postal",   value: order.shippingAddress.postalCode },
        ]}
      />

      {/* Line items */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">Items</h2>
        </div>
        <table className="w-full text-[var(--font-size-sm)]">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <tr>
              <th className="px-6 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Product</th>
              <th className="px-6 py-3 text-right text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Qty</th>
              <th className="px-6 py-3 text-right text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Price</th>
              <th className="px-6 py-3 text-right text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {order.items.map((item, i) => (
              <tr key={i} className="hover:bg-[var(--color-surface)]">
                <td className="px-6 py-3">
                  <p className="font-medium text-[var(--color-text-primary)]">{item.name}</p>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono">{item.sku}</p>
                </td>
                <td className="px-6 py-3 text-right text-[var(--color-text-secondary)]">{item.quantity}</td>
                <td className="px-6 py-3 text-right text-[var(--color-text-secondary)]">{formatCAD(item.price)}</td>
                <td className="px-6 py-3 text-right font-semibold text-[var(--color-text-primary)]">{formatCAD(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="ml-auto max-w-xs space-y-1.5 text-[var(--font-size-sm)]">
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Subtotal</span><span>{formatCAD(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-[var(--color-success)]">
                <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                <span>-{formatCAD(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Tax</span><span>{formatCAD(order.taxTotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-[var(--color-text-primary)] border-t border-[var(--color-border)] pt-1.5">
              <span>Total</span><span>{formatCAD(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Internal notes */}
      {order.notes && (
        <div className="bg-[var(--color-warning-light)] border border-[var(--color-warning)] rounded-[var(--radius-lg)] px-5 py-4">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-warning)] mb-1">Internal Note</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{order.notes}</p>
        </div>
      )}

      {/* Batch Allocations (shown when any batch-tracked items exist) */}
      {order.batchAllocations?.length > 0 && (
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
            <Layers size={16} className="text-[var(--color-primary)]" />
            <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)]">Batch Allocations</h2>
            <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">FEFO — auto-allocated at checkout</span>
            {!["delivered", "cancelled"].includes(order.status) && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => {
                  setOverrideLines((order.batchAllocations as BatchAllocation[]).map((a) => ({ ...a })));
                  setOverrideProductId(null);
                  setBatchModal(true);
                }}
              >
                <Pencil size={12} className="mr-1.5" /> Override Batches
              </Button>
            )}
          </div>
          <table className="w-full text-[var(--font-size-sm)]">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <tr>
                <th className="px-6 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Product</th>
                <th className="px-6 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Batch #</th>
                <th className="px-6 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Expiry</th>
                <th className="px-6 py-3 text-right text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {(order.batchAllocations as BatchAllocation[]).map((a, i) => {
                const daysLeft = Math.ceil((new Date(a.expiryDate).getTime() - Date.now()) / 86400000);
                const isNear   = daysLeft > 0 && daysLeft <= 90;
                return (
                  <tr key={i} className="hover:bg-[var(--color-surface)]">
                    <td className="px-6 py-3 text-[var(--color-text-secondary)]">{a.productName}</td>
                    <td className="px-6 py-3 font-mono font-semibold text-[var(--color-text-primary)]">{a.batchNumber}</td>
                    <td className="px-6 py-3">
                      <span className={isNear ? "text-[var(--color-warning)] font-semibold" : "text-[var(--color-text-secondary)]"}>
                        {new Date(a.expiryDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      {isNear && <AlertTriangle size={12} className="inline ml-1 text-[var(--color-warning)]" />}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-[var(--color-text-primary)]">{a.allocatedQty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Status history */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-4">Status History</h2>
        <StatusHistory history={order.statusHistory} />
      </div>

      {/* Communications */}
      <AdminThreadPanel entityType="order" entityId={id} />

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Order Status">
        <div className="space-y-4">
          <Select
            label="Status"
            value={newStatus}
            onChange={(v) => setNewStatus(v)}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))}
          />
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">
              Note (optional)
            </label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={3}
              placeholder="Internal note about this status change…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button loading={statusMut.isPending} onClick={() => statusMut.mutate()}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Note modal */}
      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Add Internal Note">
        <div className="space-y-4">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="Internal note (not visible to customer)…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] resize-none"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setNoteModal(false)}>Cancel</Button>
            <Button loading={noteMut.isPending} disabled={!noteText.trim()} onClick={() => noteMut.mutate()}>
              Add Note
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch override modal */}
      <Modal open={batchModal} onClose={() => setBatchModal(false)} title="Override Batch Allocations">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Modify which batches are used for this order. The system will restore the existing allocations and apply your selection. Quantities must match the ordered amounts per product.
          </p>

          {/* Current allocation lines */}
          <div className="space-y-3">
            {overrideLines.map((line, idx) => {
              const activeBatches = (availBatches ?? []).filter(
                (b) => b.status === "active" && b.currentQty > 0 && b.productId === line.productId,
              );

              return (
                <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">
                      {line.productName}
                    </p>
                    <button
                      onClick={() => setOverrideLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Batch selector */}
                    <div>
                      <label className="mb-1 block text-[var(--font-size-xs)] font-medium text-[var(--color-text-muted)]">Batch</label>
                      <select
                        value={line.batchId}
                        onFocus={() => setOverrideProductId(line.productId)}
                        onChange={(e) => {
                          const selected = (availBatches ?? []).find((b) => b._id === e.target.value);
                          if (!selected) return;
                          setOverrideLines((prev) => prev.map((l, i) =>
                            i === idx ? { ...l, batchId: selected._id, batchNumber: selected.batchNumber, expiryDate: selected.expiryDate } : l,
                          ));
                        }}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      >
                        <option value={line.batchId}>{line.batchNumber} (current)</option>
                        {activeBatches
                          .filter((b) => b._id !== line.batchId)
                          .map((b) => (
                            <option key={b._id} value={b._id}>
                              {b.batchNumber} — exp {new Date(b.expiryDate).toLocaleDateString("en-CA")} — {b.currentQty} units
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Qty */}
                    <div>
                      <label className="mb-1 block text-[var(--font-size-xs)] font-medium text-[var(--color-text-muted)]">Qty</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={line.allocatedQty}
                        onChange={(e) => setOverrideLines((prev) => prev.map((l, i) =>
                          i === idx ? { ...l, allocatedQty: parseInt(e.target.value) || 1 } : l,
                        ))}
                        onKeyDown={(e) => {
                          const allowed = new Set(["Backspace","Delete","Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"]);
                          if (allowed.has(e.key)) return;
                          if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key)) return;
                          if (/^\d$/.test(e.key)) return;
                          e.preventDefault();
                        }}
                        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add split line */}
          <button
            onClick={() => {
              const firstAlloc = order.batchAllocations?.[0] as BatchAllocation | undefined;
              if (!firstAlloc) return;
              setOverrideLines((prev) => [...prev, {
                productId:   firstAlloc.productId,
                productName: firstAlloc.productName,
                batchId:     firstAlloc.batchId,
                batchNumber: firstAlloc.batchNumber,
                expiryDate:  firstAlloc.expiryDate,
                allocatedQty: 1,
              }]);
            }}
            className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline transition-colors"
          >
            <Plus size={12} /> Add split line
          </button>

          {overrideMut.isError && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">
              {(overrideMut.error as Error).message}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setBatchModal(false)}>Cancel</Button>
            <Button
              loading={overrideMut.isPending}
              disabled={overrideLines.length === 0}
              onClick={() => overrideMut.mutate()}
            >
              Save Overrides
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

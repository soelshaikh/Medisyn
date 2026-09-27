"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/api/orders.api";
import { fmtDateTime } from "@/lib/format";
import { DetailCard } from "@/components/common/DetailCard";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatusHistory } from "@/components/common/StatusHistory";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

function formatCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const [statusModal, setStatusModal] = useState(false);
  const [noteModal,   setNoteModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [statusNote,  setStatusNote]  = useState("");
  const [noteText,    setNoteText]    = useState("");

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

      {/* Status history */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6">
        <h2 className="text-[var(--font-size-md)] font-semibold text-[var(--color-text-primary)] mb-4">Status History</h2>
        <StatusHistory history={order.statusHistory} />
      </div>

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
    </div>
  );
}

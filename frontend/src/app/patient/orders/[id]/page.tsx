"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Package, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ordersApi } from "@/api/orders.api";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";
import { inputClass } from "@/lib/ui";

const CANCELLABLE = new Set(["pending", "confirmed"]);

function fmtCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PatientOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["orders", "my", id],
    queryFn: () => ordersApi.getById(id),
    enabled: !!user,
  });

  const cancelMut = useMutation({
    mutationFn: () => ordersApi.cancel(id, cancelReason || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders", "my", id] });
      void qc.invalidateQueries({ queryKey: ["orders", "my"] });
      setShowCancel(false);
      setCancelReason("");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCancelError(msg ?? "Cancellation failed. Please try again.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!order) {
    return <p className="text-sm text-slate-500">Order not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/patient/orders" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-xl font-bold text-ink-900">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
          <span className="text-sm text-slate-400">{fmtDate(order.createdAt)}</span>
        </div>
        {CANCELLABLE.has(order.status) && (
          <button
            type="button"
            onClick={() => { setShowCancel(true); setCancelError(""); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            <XCircle className="h-4 w-4" /> Cancel Order
          </button>
        )}
      </div>

      {/* Cancel confirm panel */}
      {showCancel && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">Cancel this order?</p>
              <p className="text-xs text-red-600 mt-0.5">This cannot be undone. Your items will not be shipped.</p>
            </div>
          </div>
          <textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className={inputClass}
            placeholder="Reason for cancellation (optional)"
          />
          {cancelError && (
            <p className="text-xs text-red-700">{cancelError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {cancelMut.isPending ? "Cancelling…" : "Yes, cancel order"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCancel(false); setCancelError(""); }}
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400"
            >
              Keep order
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink-900">Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Product</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Price</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item, i) => (
              <tr key={i} className="group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    {/* Product image — only links if slug is known */}
                    <div className="shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-16 w-16 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center text-slate-300">
                          <Package size={24} />
                        </div>
                      )}
                    </div>
                    {/* Name + SKU */}
                    <div>
                      {item.slug ? (
                        <Link
                          href={`/shop/${item.slug}`}
                          className="font-medium text-ink-900 hover:text-brand-600 transition-colors"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <p className="font-medium text-ink-900">{item.name}</p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-400 font-mono">{item.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-slate-600">{item.quantity}</td>
                <td className="px-6 py-4 text-right text-slate-600">{fmtCAD(item.price)}</td>
                <td className="px-6 py-4 text-right font-semibold text-ink-900">{fmtCAD(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{fmtCAD(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                <span>-{fmtCAD(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Tax</span><span>{fmtCAD(order.taxTotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-ink-900 border-t border-slate-200 pt-1.5">
              <span>Total</span><span>{fmtCAD(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shipping */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <h2 className="font-display text-base font-semibold text-ink-900 mb-3">Shipping Address</h2>
        <div className="text-sm text-slate-600 space-y-0.5">
          <p className="font-medium text-ink-900">{order.shippingAddress.fullName}</p>
          <p>{order.shippingAddress.address1}{order.shippingAddress.address2 ? `, ${order.shippingAddress.address2}` : ""}</p>
          <p>{order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}</p>
          <p>{order.shippingAddress.phone}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</span>
          <span className="text-sm text-slate-700 capitalize">{order.paymentMethod}</span>
        </div>
      </div>

      {/* Status history */}
      {order.statusHistory?.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h2 className="font-display text-base font-semibold text-ink-900 mb-4">Order Timeline</h2>
          <ol className="relative border-l border-slate-200 ml-3 space-y-4">
            {[...order.statusHistory].reverse().map((entry, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={entry.status} />
                  <span className="text-xs text-slate-400">{fmtDate(entry.changedAt)}</span>
                </div>
                {entry.note && (
                  <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

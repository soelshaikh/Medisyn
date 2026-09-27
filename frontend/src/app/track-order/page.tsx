"use client";

import { useState } from "react";
import { Search, Package, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { ApiResponse } from "@/types/api";

function fmtCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface TrackResult {
  orderNumber:   string;
  status:        string;
  createdAt:     string;
  paymentMethod: string;
  subtotal:      number;
  taxTotal:      number;
  discountAmount: number;
  couponCode:    string | null;
  total:         number;
  items: Array<{ name: string; sku: string; quantity: number; lineTotal: number }>;
  shippingTo:    { city: string; province: string };
  statusHistory: Array<{ status: string; changedAt: string; note: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending:          "Order Received",
  confirmed:        "Confirmed",
  processing:       "Processing",
  ready_for_pickup: "Ready for Pickup",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-yellow-100 text-yellow-800",
  confirmed:        "bg-blue-100 text-blue-800",
  processing:       "bg-purple-100 text-purple-800",
  ready_for_pickup: "bg-teal-100 text-teal-800",
  delivered:        "bg-green-100 text-green-800",
  cancelled:        "bg-red-100 text-red-800",
};

const STEPS = ["pending", "confirmed", "processing", "ready_for_pickup", "delivered"];

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email,       setEmail]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [result,      setResult]      = useState<TrackResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await apiClient.get<ApiResponse<TrackResult>>("/orders/track", {
        params: { orderNumber: orderNumber.trim().toUpperCase(), email: email.trim().toLowerCase() },
      });
      setResult(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Order not found. Please check your order number and email.");
    } finally {
      setLoading(false);
    }
  }

  const currentStep   = result ? STEPS.indexOf(result.status) : -1;
  const isCancelled   = result?.status === "cancelled";

  return (
    <div className="min-h-screen bg-ink-50 py-14 px-4">
      <div className="mx-auto max-w-2xl space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-md">
            <Package size={26} className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-ink-900">Track Your Order</h1>
          <p className="mt-2 text-sm text-ink-500">
            Enter your order number and the email address used at checkout.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleTrack}
          className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Order Number</label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="ORD-2026-000001"
              required
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-ink-800 uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !orderNumber.trim() || !email.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? "Searching…" : "Track Order"}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-5">

            {/* Status badge + meta */}
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    {result.orderNumber}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    Placed {fmtDate(result.createdAt)} · <span className="capitalize">{result.paymentMethod}</span>
                    {result.shippingTo && ` · ${result.shippingTo.city}, ${result.shippingTo.province}`}
                  </p>
                </div>
                <span className={[
                  "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                  STATUS_COLORS[result.status] ?? "bg-ink-100 text-ink-700",
                ].join(" ")}>
                  {STATUS_LABELS[result.status] ?? result.status}
                </span>
              </div>

              {/* Progress bar (hidden if cancelled) */}
              {!isCancelled && (
                <div className="mt-6">
                  <div className="flex items-center">
                    {STEPS.map((step, i) => {
                      const done    = i <= currentStep;
                      const current = i === currentStep;
                      const last    = i === STEPS.length - 1;
                      return (
                        <div key={step} className="flex flex-1 items-center last:flex-none">
                          <div className="flex flex-col items-center gap-1">
                            <div className={[
                              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                              done
                                ? "bg-brand-600 text-white"
                                : "border-2 border-ink-200 text-ink-300",
                              current ? "ring-2 ring-brand-200 ring-offset-1" : "",
                            ].join(" ")}>
                              {done ? "✓" : i + 1}
                            </div>
                            <span className={[
                              "text-[10px] font-medium whitespace-nowrap",
                              done ? "text-brand-700" : "text-ink-400",
                            ].join(" ")}>
                              {STATUS_LABELS[step]}
                            </span>
                          </div>
                          {!last && (
                            <div className={[
                              "mx-1 h-0.5 flex-1 rounded-full transition-colors",
                              i < currentStep ? "bg-brand-500" : "bg-ink-200",
                            ].join(" ")} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCancelled && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  This order has been cancelled. If you have questions, please contact us.
                </p>
              )}
            </div>

            {/* Items */}
            <div className="rounded-2xl border border-ink-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-ink-100 px-6 py-4">
                <h2 className="font-display text-base font-semibold text-ink-900">Items</h2>
              </div>
              <div className="divide-y divide-ink-50">
                {result.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{item.name}</p>
                      <p className="text-xs text-ink-400 font-mono">{item.sku} · Qty {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink-800 shrink-0">{fmtCAD(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-ink-100 bg-ink-50 px-6 py-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-500">
                  <span>Subtotal</span><span>{fmtCAD(result.subtotal)}</span>
                </div>
                {result.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount {result.couponCode && `(${result.couponCode})`}</span>
                    <span>-{fmtCAD(result.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-ink-500">
                  <span>Tax</span><span>{fmtCAD(result.taxTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink-900 border-t border-ink-200 pt-1.5">
                  <span>Total</span><span>{fmtCAD(result.total)}</span>
                </div>
              </div>
            </div>

            {/* Status history (collapsible) */}
            {result.statusHistory.length > 0 && (
              <div className="rounded-2xl border border-ink-100 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-ink-50 transition-colors"
                >
                  <h2 className="font-display text-base font-semibold text-ink-900">Order Timeline</h2>
                  {historyOpen ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
                </button>
                {historyOpen && (
                  <div className="px-6 pb-6">
                    <ol className="relative border-l border-ink-200 ml-3 space-y-4">
                      {[...result.statusHistory].reverse().map((entry, i) => (
                        <li key={i} className="ml-4">
                          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={[
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              STATUS_COLORS[entry.status] ?? "bg-ink-100 text-ink-700",
                            ].join(" ")}>
                              {STATUS_LABELS[entry.status] ?? entry.status}
                            </span>
                            <span className="text-xs text-ink-400">{fmtDate(entry.changedAt)}</span>
                          </div>
                          {entry.note && (
                            <p className="mt-1 text-xs text-ink-500">{entry.note}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

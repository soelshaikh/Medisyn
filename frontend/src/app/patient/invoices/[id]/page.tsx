"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { invoicesApi } from "@/api/invoices.api";
import { useAuthStore } from "@/stores/authStore";

function fmtCAD(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export default function PatientInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuthStore();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!inv) return;
    setDownloading(true);
    try { await invoicesApi.downloadPdf(id, `${inv.invoiceNumber}.pdf`); }
    finally { setDownloading(false); }
  }

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoices", "my", id],
    queryFn:  () => invoicesApi.getById(id),
    enabled:  !!user,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (!inv) {
    return <p className="text-sm text-slate-500">Invoice not found.</p>;
  }

  const addr = inv.billingAddress;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/patient/invoices" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900 font-mono">{inv.invoiceNumber}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{fmtDate(inv.issuedAt)}</p>
        </div>
        <button
          type="button"
          disabled={downloading}
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {downloading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
          Download PDF
        </button>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Invoice Details</h3>
          <dl className="space-y-1.5 text-sm">
            <MetaRow label="Invoice #" value={inv.invoiceNumber} mono />
            <MetaRow label="Issued"    value={fmtDate(inv.issuedAt)} />
            <MetaRow label="Type"      value={inv.type === "ecommerce" ? "Order Invoice" : "Direct"} />
            {inv.orderNumber && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Order</dt>
                <dd>
                  <Link href={`/patient/orders/${inv.orderId}`} className="text-brand-600 hover:underline font-mono text-xs flex items-center gap-0.5">
                    {inv.orderNumber}<ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Billed To</h3>
          <address className="not-italic text-sm text-slate-600 leading-relaxed">
            <p className="font-medium text-ink-900">{inv.customerName}</p>
            <p>{addr.addressLine1}</p>
            {addr.addressLine2 && <p>{addr.addressLine2}</p>}
            <p>{addr.city}, {addr.province} {addr.postalCode}</p>
            <p>{addr.country}</p>
          </address>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-ink-900">Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Qty</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inv.items.map((item, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <p className="font-medium text-ink-900">{item.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.sku}</p>
                </td>
                <td className="px-6 py-4 text-right text-slate-600">{item.quantity}</td>
                <td className="px-6 py-4 text-right text-slate-600">{fmtCAD(item.unitPrice)}</td>
                <td className="px-6 py-4 text-right font-semibold text-ink-900">{fmtCAD(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmtCAD(inv.subtotal)}</span></div>
            {inv.discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmtCAD(inv.discountAmount)}</span></div>
            )}
            {inv.taxLines.map((t, i) => (
              <div key={i} className="flex justify-between text-slate-600"><span>{t.label}</span><span>{fmtCAD(t.amount)}</span></div>
            ))}
            <div className="flex justify-between font-bold text-ink-900 border-t border-slate-200 pt-1.5">
              <span>Total (CAD)</span><span>{fmtCAD(inv.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {inv.notes && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Notes</h3>
          <p className="text-sm text-slate-600">{inv.notes}</p>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400 shrink-0">{label}</dt>
      <dd className={["text-right font-medium text-ink-900", mono ? "font-mono text-xs" : ""].join(" ")}>{value}</dd>
    </div>
  );
}

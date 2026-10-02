"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Ban, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PageHeader }  from "@/components/common/PageHeader";
import { Spinner }     from "@/components/ui/Spinner";
import { Button }      from "@/components/ui/Button";
import { invoicesApi } from "@/api/invoices.api";
import type { AdminInvoice } from "@/types/admin";

function cad(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export default function InvoiceDetailPage() {
  const params     = useParams<{ id: string }>();
  const router     = useRouter();
  const qc         = useQueryClient();
  const [voidModal, setVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!inv) return;
    setDownloading(true);
    try { await invoicesApi.downloadPdf(params.id, `${inv.invoiceNumber}.pdf`); }
    finally { setDownloading(false); }
  }

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invoice", params.id],
    queryFn:  () => invoicesApi.getById(params.id),
  });

  const voidMut = useMutation({
    mutationFn: () => invoicesApi.void(params.id, voidReason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", params.id] });
      qc.invalidateQueries({ queryKey: ["invoices-admin"] });
      setVoidModal(false);
      setVoidReason("");
    },
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!inv)      return <p className="p-8 text-[var(--color-error)]">Invoice not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={inv.invoiceNumber}
        description={`${inv.type === "ecommerce" ? "Ecommerce" : "Adhoc"} invoice · ${fmtDate(inv.issuedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-1.5 text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {downloading ? <Spinner size="xs" /> : <Download size={14} />}
              Download PDF
            </button>
            {inv.status === "issued" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVoidModal(true)}
                className="text-[var(--color-error)] border-[var(--color-error)] hover:bg-[var(--color-error-light)]"
              >
                <Ban size={14} className="mr-1.5" />Void Invoice
              </Button>
            )}
            <Link href="/invoices">
              <Button size="sm" variant="outline"><ArrowLeft size={14} className="mr-1.5" />Back</Button>
            </Link>
          </div>
        }
      />

      {inv.status === "void" && (
        <div className="rounded-[var(--radius-md)] bg-[var(--color-error-light)] border border-[var(--color-error)] px-4 py-3 text-[var(--font-size-sm)] text-[var(--color-error)] font-semibold">
          VOID — {inv.voidReason}
          {inv.voidedAt && <span className="font-normal ml-2 text-[var(--font-size-xs)]">({fmtDate(inv.voidedAt)})</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Invoice meta */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 shadow-[var(--shadow-sm)]">
          <h3 className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Invoice Details</h3>
          <dl className="space-y-1.5 text-[var(--font-size-sm)]">
            <Row label="Number"  value={inv.invoiceNumber} mono />
            <Row label="Type"    value={inv.type === "ecommerce" ? "Ecommerce" : "Adhoc"} />
            <Row label="Status"  value={inv.status === "issued" ? "Issued" : "VOID"} />
            <Row label="Issued"  value={fmtDate(inv.issuedAt)} />
            {inv.orderNumber && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Order</dt>
                <dd>
                  <Link
                    href={`/orders/${inv.orderId}`}
                    className="text-[var(--color-primary)] hover:underline font-mono text-[var(--font-size-xs)] flex items-center gap-1"
                  >
                    {inv.orderNumber}<ExternalLink size={11} />
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Customer */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 shadow-[var(--shadow-sm)]">
          <h3 className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Customer</h3>
          <dl className="space-y-1.5 text-[var(--font-size-sm)]">
            <Row label="Name"  value={inv.customerName} />
            <Row label="Email" value={inv.customerEmail} />
            {inv.customerPhone && <Row label="Phone" value={inv.customerPhone} />}
          </dl>
        </div>

        {/* Billing Address */}
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 shadow-[var(--shadow-sm)]">
          <h3 className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-3">Billing Address</h3>
          <address className="not-italic text-[var(--font-size-sm)] text-[var(--color-text-secondary)] leading-relaxed">
            {inv.billingAddress.fullName}<br />
            {inv.billingAddress.addressLine1}<br />
            {inv.billingAddress.addressLine2 && <>{inv.billingAddress.addressLine2}<br /></>}
            {inv.billingAddress.city}, {inv.billingAddress.province} {inv.billingAddress.postalCode}<br />
            {inv.billingAddress.country}
          </address>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-[var(--color-text-primary)]">Line Items</h3>
        </div>
        <table className="w-full text-[var(--font-size-sm)]">
          <thead className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <tr>
              {["Description", "SKU", "Qty", "Unit Price", "Total"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {inv.items.map((item, i) => (
              <tr key={i} className="hover:bg-[var(--color-surface)]">
                <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">{item.name}</td>
                <td className="px-5 py-3 font-mono text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{item.sku}</td>
                <td className="px-5 py-3 text-[var(--color-text-secondary)]">{item.quantity}</td>
                <td className="px-5 py-3 text-[var(--color-text-secondary)]">{cad(item.unitPrice)}</td>
                <td className="px-5 py-3 font-semibold text-[var(--color-text-primary)]">{cad(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <div className="ml-auto w-56 space-y-1.5 text-[var(--font-size-sm)]">
            <TotalRow label="Subtotal" value={cad(inv.subtotal)} />
            {inv.discountAmount > 0 && (
              <TotalRow
                label={`Discount${inv.couponCode ? ` (${inv.couponCode})` : ""}`}
                value={`-${cad(inv.discountAmount)}`}
                muted
              />
            )}
            {inv.taxLines.map((t, i) => (
              <TotalRow key={i} label={t.label} value={cad(t.amount)} muted />
            ))}
            <div className="border-t border-[var(--color-border)] pt-1.5">
              <TotalRow label="Total (CAD)" value={cad(inv.total)} bold />
            </div>
          </div>
        </div>
      </div>

      {inv.notes && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Notes</p>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{inv.notes}</p>
        </div>
      )}

      {/* Void modal */}
      {voidModal && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] w-full max-w-md p-6 space-y-4">
            <h2 className="text-[var(--font-size-lg)] font-semibold text-[var(--color-text-primary)]">Void Invoice</h2>
            <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
              This action cannot be undone. The invoice will be marked void and remain in the system for audit purposes.
            </p>
            <div>
              <label className="block text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">
                Reason <span className="text-[var(--color-error)]">*</span>
              </label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Enter reason for voiding this invoice…"
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error)] resize-none"
              />
            </div>
            {voidMut.isError && (
              <p className="text-[var(--font-size-xs)] text-[var(--color-error)]">Failed to void. Please try again.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setVoidModal(false); setVoidReason(""); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={!voidReason.trim() || voidMut.isPending}
                onClick={() => voidMut.mutate()}
                className="bg-[var(--color-error)] hover:bg-[var(--color-error)] text-white border-[var(--color-error)]"
              >
                {voidMut.isPending ? "Voiding…" : "Confirm Void"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-[var(--color-text-muted)] shrink-0">{label}</dt>
      <dd className={["text-right text-[var(--color-text-primary)] font-medium", mono ? "font-mono text-[var(--font-size-xs)]" : ""].join(" ")}>{value}</dd>
    </div>
  );
}

function TotalRow({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={["flex justify-between text-[var(--font-size-sm)]", bold ? "font-semibold" : ""].join(" ")}>
      <span className={muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)]"}>{label}</span>
      <span className={muted ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"}>{value}</span>
    </div>
  );
}

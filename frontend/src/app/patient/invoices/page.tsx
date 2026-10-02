"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { invoicesApi } from "@/api/invoices.api";
import { useAuthStore } from "@/stores/authStore";

function fmtCAD(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function PatientInvoicesPage() {
  const { user } = useAuthStore();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(id: string, invoiceNumber: string) {
    setDownloadingId(id);
    try { await invoicesApi.downloadPdf(id, `${invoiceNumber}.pdf`); }
    finally { setDownloadingId(null); }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", "my"],
    queryFn:  () => invoicesApi.list(1, 50),
    enabled:  !!user,
    staleTime: 2 * 60 * 1000,
  });

  const invoices = data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">My Invoices</h1>
        <p className="mt-1 text-sm text-slate-600">Download invoices for your delivered orders.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">Invoice History</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center px-6 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No invoices yet.</p>
            <p className="text-xs text-slate-400">Invoices are generated automatically when an order is delivered.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <Link href={`/patient/invoices/${inv._id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="shrink-0 rounded-xl bg-brand-50 p-2.5 text-brand-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-ink-900">{inv.invoiceNumber}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {inv.orderNumber && (
                        <p className="text-xs text-slate-400">Order {inv.orderNumber}</p>
                      )}
                      <span className="text-xs text-slate-300">·</span>
                      <p className="text-xs text-slate-400">{fmtDate(inv.issuedAt)}</p>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-sm font-semibold text-ink-900">{fmtCAD(inv.total)}</p>
                  <button
                    type="button"
                    disabled={downloadingId === inv._id}
                    onClick={(e) => { e.stopPropagation(); handleDownload(inv._id, inv.invoiceNumber); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    title="Download PDF"
                  >
                    {downloadingId === inv._id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />}
                    PDF
                  </button>
                  <Link href={`/patient/invoices/${inv._id}`}>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

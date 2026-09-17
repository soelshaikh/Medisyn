import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { askPharmacistRequests } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Ask a Pharmacist Management | MediSyn Admin" };

export default async function AdminAskPharmacistPage() {
  const rows = await db.select().from(askPharmacistRequests).orderBy(desc(askPharmacistRequests.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Ask a Pharmacist</h1>
        <p className="mt-1 text-sm text-slate-600">{rows.length} question(s) submitted by patients.</p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">No questions yet.</p>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin/ask-a-pharmacist/${r.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{r.category}</p>
                <p className="mt-1 truncate text-sm text-ink-900">{r.message}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

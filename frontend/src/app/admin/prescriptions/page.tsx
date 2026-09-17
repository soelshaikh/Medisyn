import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { prescriptionRequests } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Manage Prescriptions | MediSyn Admin" };

export default async function AdminPrescriptionsPage() {
  const rows = await db.select().from(prescriptionRequests).orderBy(desc(prescriptionRequests.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Prescription Requests</h1>
        <p className="mt-1 text-sm text-slate-600">{rows.length} total request(s) across all patients.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Patient</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Submitted</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No prescription requests yet.</td></tr>
            ) : (
              rows.map((rx) => (
                <tr key={rx.id}>
                  <td className="px-5 py-3 font-medium text-ink-900">{rx.fullName}</td>
                  <td className="px-5 py-3 capitalize text-slate-600">{rx.requestType.replace("_", " ")}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(rx.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3"><StatusBadge status={rx.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/prescriptions/${rx.id}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">Manage</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Manage Patients | MediSyn Admin" };

export default async function AdminPatientsPage() {
  const patients = await db.select().from(users).where(eq(users.role, "patient")).orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Patients</h1>
        <p className="mt-1 text-sm text-slate-600">{patients.length} registered patient account(s).</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">No patients yet.</td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-medium text-ink-900">{p.fullName}</td>
                  <td className="px-5 py-3 text-slate-600">{p.email}</td>
                  <td className="px-5 py-3 text-slate-600">{p.phone}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/patients/${p.id}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                      View
                    </Link>
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

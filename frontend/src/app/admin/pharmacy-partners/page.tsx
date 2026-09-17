import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, pharmacyPartnerProfiles } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Manage Pharmacy Partners | MediSyn Admin" };

export default async function AdminPartnersPage() {
  const rows = await db
    .select({ user: users, profile: pharmacyPartnerProfiles })
    .from(users)
    .leftJoin(pharmacyPartnerProfiles, eq(pharmacyPartnerProfiles.userId, users.id))
    .where(eq(users.role, "pharmacy_partner"))
    .orderBy(desc(users.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Pharmacy Partners</h1>
        <p className="mt-1 text-sm text-slate-600">Review and approve pharmacy partner applications.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Pharmacy</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No pharmacy partner applications yet.</td></tr>
            ) : (
              rows.map(({ user, profile }) => (
                <tr key={user.id}>
                  <td className="px-5 py-3 font-medium text-ink-900">{profile?.pharmacyName ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{user.fullName}</td>
                  <td className="px-5 py-3 text-slate-600">{user.email}</td>
                  <td className="px-5 py-3"><StatusBadge status={user.status} /></td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/pharmacy-partners/${user.id}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">Review</Link>
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

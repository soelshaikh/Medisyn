import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, pharmacyPartnerProfiles } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";
import { approveOrganization, updateUserStatus } from "@/actions/admin";

export const metadata = { title: "Pharmacy Partner Details | MediSyn Admin" };

export default async function AdminPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (!userId) notFound();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.role !== "pharmacy_partner") notFound();
  const [profile] = await db.select().from(pharmacyPartnerProfiles).where(eq(pharmacyPartnerProfiles.userId, userId)).limit(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{profile?.pharmacyName}</h1>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <StatusBadge status={user.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="font-display text-base font-semibold text-ink-900">Application Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Contact name</dt><dd className="text-ink-900">{profile?.contactName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pharmacy phone</dt><dd className="text-ink-900">{profile?.pharmacyPhone}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Pharmacy address</dt><dd className="text-right text-ink-900">{profile?.pharmacyAddress}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">License number</dt><dd className="text-ink-900">{profile?.licenseNumber || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Email verified</dt><dd className="text-ink-900">{user.emailVerified ? "Yes" : "No"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Applied</dt><dd className="text-ink-900">{new Date(user.createdAt).toLocaleDateString()}</dd></div>
          </dl>
        </div>

        <div className="space-y-4">
          {user.status === "pending_approval" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-base font-semibold text-ink-900">Approval Decision</h2>
              <div className="mt-4 flex flex-col gap-2">
                <form action={approveOrganization}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button className="w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                    Approve Partner
                  </button>
                </form>
                <form action={approveOrganization}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button className="w-full rounded-full border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                    Reject Application
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-base font-semibold text-ink-900">Manage Account</h2>
              <form action={updateUserStatus} className="mt-4 space-y-3">
                <input type="hidden" name="userId" value={user.id} />
                <select name="status" defaultValue={user.status} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="approved">Approved</option>
                  <option value="suspended">Suspended</option>
                  <option value="deactivated">Deactivated</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button className="w-full rounded-full bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                  Update Status
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

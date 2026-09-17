import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { minorAilmentRequests } from "@/db/schema";
import MinorAilmentForm from "@/components/patient/MinorAilmentForm";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Minor Ailments | MediSyn Compounding" };

export default async function MinorAilmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const history = await db
    .select()
    .from(minorAilmentRequests)
    .where(eq(minorAilmentRequests.patientId, user.id))
    .orderBy(desc(minorAilmentRequests.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Minor Ailments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Our pharmacists can assess and prescribe for several common minor ailments.
        </p>
      </div>

      <MinorAilmentForm />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">My Requests</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {history.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No minor ailment requests yet.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{item.ailment}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.details}</p>
                  {item.adminNotes ? <p className="mt-1 text-xs text-brand-700">Note: {item.adminNotes}</p> : null}
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

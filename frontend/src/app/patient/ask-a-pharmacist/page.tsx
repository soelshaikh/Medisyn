import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { askPharmacistRequests } from "@/db/schema";
import AskPharmacistForm from "@/components/patient/AskPharmacistForm";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Ask a Pharmacist | MediSyn Compounding" };

export default async function AskPharmacistPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const history = await db
    .select()
    .from(askPharmacistRequests)
    .where(eq(askPharmacistRequests.patientId, user.id))
    .orderBy(desc(askPharmacistRequests.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Ask a Pharmacist</h1>
        <p className="mt-1 text-sm text-slate-600">Get answers from a licensed MediSyn pharmacist, securely and privately.</p>
      </div>

      <AskPharmacistForm />

      <div className="space-y-4">
        {history.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No questions submitted yet.
          </p>
        ) : (
          history.map((ask) => (
            <div key={ask.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{ask.category}</p>
                  <p className="mt-1 text-sm text-ink-900">{ask.message}</p>
                </div>
                <StatusBadge status={ask.status} />
              </div>
              {ask.response ? (
                <div className="mt-4 rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
                  <p className="font-semibold">Pharmacist response:</p>
                  <p className="mt-1">{ask.response}</p>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-slate-400">Submitted {new Date(ask.createdAt).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

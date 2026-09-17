import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { prescriptionRequests } from "@/db/schema";
import PrescriptionForm from "@/components/patient/PrescriptionForm";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Prescriptions | MediSyn Compounding" };

const VALID_TYPES = new Set(["new_rx", "refill", "transfer", "upload", "custom_formulation"]);

export default async function PatientPrescriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { type } = await searchParams;
  const initialType = VALID_TYPES.has(type ?? "") ? (type as string) : "new_rx";

  const history = await db
    .select()
    .from(prescriptionRequests)
    .where(eq(prescriptionRequests.patientId, user.id))
    .orderBy(desc(prescriptionRequests.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Prescription Services</h1>
        <p className="mt-1 text-sm text-slate-600">
          Submit a new prescription, refill, transfer, upload, or custom formulation request.
        </p>
      </div>

      <PrescriptionForm initialType={initialType as never} />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">Request History</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {history.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No requests submitted yet.</p>
          ) : (
            history.map((rx) => (
              <div key={rx.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize text-ink-900">{rx.requestType.replace("_", " ")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Submitted {new Date(rx.createdAt).toLocaleDateString()} · {rx.medicationDetails || "No medication details provided"}
                  </p>
                  {rx.adminNotes ? (
                    <p className="mt-1 text-xs text-brand-700">Pharmacist note: {rx.adminNotes}</p>
                  ) : null}
                </div>
                <StatusBadge status={rx.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

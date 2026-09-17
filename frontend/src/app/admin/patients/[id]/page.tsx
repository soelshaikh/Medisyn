import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, patientProfiles, prescriptionRequests, askPharmacistRequests, appointmentRequests } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";
import { updateUserStatus } from "@/actions/admin";

export const metadata = { title: "Patient Details | MediSyn Admin" };

const STATUS_OPTIONS = ["active", "suspended", "deactivated"];

export default async function AdminPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (!userId) notFound();

  const [patient] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!patient || patient.role !== "patient") notFound();

  const [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
  const [rxList, askList, apptList] = await Promise.all([
    db.select().from(prescriptionRequests).where(eq(prescriptionRequests.patientId, userId)).orderBy(desc(prescriptionRequests.createdAt)),
    db.select().from(askPharmacistRequests).where(eq(askPharmacistRequests.patientId, userId)).orderBy(desc(askPharmacistRequests.createdAt)),
    db.select().from(appointmentRequests).where(eq(appointmentRequests.patientId, userId)).orderBy(desc(appointmentRequests.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{patient.fullName}</h1>
          <p className="text-sm text-slate-600">{patient.email} · {patient.phone}</p>
        </div>
        <StatusBadge status={patient.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
          <h2 className="font-display text-base font-semibold text-ink-900">Profile Details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Date of birth</dt><dd className="text-ink-900">{profile?.dateOfBirth || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Address</dt><dd className="text-right text-ink-900">{profile?.address || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Health card #</dt><dd className="text-ink-900">{profile?.healthCardNumber || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Contact pref.</dt><dd className="text-ink-900 capitalize">{profile?.preferredContactMethod || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Joined</dt><dd className="text-ink-900">{new Date(patient.createdAt).toLocaleDateString()}</dd></div>
          </dl>

          <form action={updateUserStatus} className="mt-6 space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="userId" value={patient.id} />
            <label className="text-sm font-medium text-ink-900">Update account status</label>
            <select name="status" defaultValue={patient.status} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="w-full rounded-full bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              Update Status
            </button>
          </form>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold text-ink-900">Prescription Requests ({rxList.length})</h2>
            <div className="mt-3 space-y-2">
              {rxList.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : rxList.map((rx) => (
                <div key={rx.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="capitalize text-ink-900">{rx.requestType.replace("_"," ")}</span>
                  <StatusBadge status={rx.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold text-ink-900">Ask a Pharmacist ({askList.length})</h2>
            <div className="mt-3 space-y-2">
              {askList.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : askList.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="text-ink-900">{a.category}</span>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold text-ink-900">Appointment Requests ({apptList.length})</h2>
            <div className="mt-3 space-y-2">
              {apptList.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : apptList.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="text-ink-900">{a.service}</span>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

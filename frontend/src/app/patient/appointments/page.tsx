import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { appointmentRequests } from "@/db/schema";
import AppointmentForm from "@/components/patient/AppointmentForm";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Vaccines & Appointments | MediSyn Compounding" };

export default async function AppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const history = await db
    .select()
    .from(appointmentRequests)
    .where(eq(appointmentRequests.patientId, user.id))
    .orderBy(desc(appointmentRequests.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Vaccines & Appointments</h1>
        <p className="mt-1 text-sm text-slate-600">Request a vaccine or clinical service appointment.</p>
      </div>

      <AppointmentForm />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">My Appointment Requests</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {history.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No appointment requests yet.</p>
          ) : (
            history.map((appt) => (
              <div key={appt.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{appt.service}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Preferred: {appt.preferredDate} {appt.preferredTime ?? ""}
                  </p>
                  {appt.adminNotes ? <p className="mt-1 text-xs text-brand-700">Note: {appt.adminNotes}</p> : null}
                </div>
                <StatusBadge status={appt.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

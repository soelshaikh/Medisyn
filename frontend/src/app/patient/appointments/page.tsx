"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { appointmentsApi } from "@/api/appointments.api";
import AppointmentForm from "@/components/patient/AppointmentForm";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";
import { fmt12h } from "@/lib/utils";

export default function AppointmentsPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["appointments", "my"],
    queryFn: () => appointmentsApi.listMyBookings(1, 50),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Vaccines & Appointments</h1>
        <p className="mt-1 text-sm text-slate-600">Choose an available slot to book your vaccine appointment.</p>
      </div>

      <AppointmentForm />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">My Appointment Bookings</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="flex justify-center px-6 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !data?.docs?.length ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No appointment bookings yet.</p>
          ) : (
            data.docs.map((appt) => (
              <div key={appt._id} className="px-6 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {appt.vaccineService?.name ?? "Appointment"}
                    </p>
                    {appt.slot && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(appt.slot.date).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}{" "}
                        at {fmt12h(appt.slot.startTime)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
                {appt.adminReply && (
                  <div className="mt-3 rounded-lg bg-brand-50 border border-brand-200 px-4 py-3">
                    <p className="text-xs font-semibold text-brand-700 mb-1">Message from MediSyn team:</p>
                    <p className="text-sm text-brand-900 whitespace-pre-wrap">{appt.adminReply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { prescriptionsApi } from "@/api/prescriptions.api";
import PrescriptionForm from "@/components/patient/PrescriptionForm";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";

export default function PatientPrescriptionsPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["prescriptions", "my"],
    queryFn: () => prescriptionsApi.list(1, 50),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Prescription Services</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add and manage your prescriptions with MediSyn.
        </p>
      </div>

      <PrescriptionForm />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">My Prescriptions</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="flex justify-center px-6 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !data?.docs?.length ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No prescriptions submitted yet.</p>
          ) : (
            data.docs.map((rx) => (
              <div key={rx._id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{rx.medicationName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Rx #{rx.prescriptionNumber} · {rx.prescriberName} ·{" "}
                    Added {new Date(rx.createdAt).toLocaleDateString()}
                  </p>
                  {rx.dosage && <p className="mt-0.5 text-xs text-slate-400">{rx.dosage}</p>}
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

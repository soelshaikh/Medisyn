"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import AskPharmacistForm from "@/components/patient/AskPharmacistForm";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";

export default function AskPharmacistPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["ask-pharmacist", "my"],
    queryFn: () => askPharmacistApi.list(1, 50),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Ask a Pharmacist</h1>
        <p className="mt-1 text-sm text-slate-600">Get answers from a licensed MediSyn pharmacist, securely and privately.</p>
      </div>

      <AskPharmacistForm />

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : !data?.docs?.length ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No questions submitted yet.
          </p>
        ) : (
          data.docs.map((ask) => (
            <div key={ask._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{ask.subject}</p>
                  <p className="mt-1 text-sm text-ink-900">{ask.question}</p>
                </div>
                <StatusBadge status={ask.status} />
              </div>
              {ask.responseText && (
                <div className="mt-4 rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
                  <p className="font-semibold">Pharmacist response:</p>
                  <p className="mt-1">{ask.responseText}</p>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">Submitted {new Date(ask.createdAt).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

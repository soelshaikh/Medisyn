"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle } from "lucide-react";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import AskPharmacistForm from "@/components/patient/AskPharmacistForm";
import PatientThreadPanel from "@/components/patient/PatientThreadPanel";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";

export default function AskPharmacistPage() {
  const { user } = useAuthStore();
  const [openThread, setOpenThread] = useState<string | null>(null);

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
          data.docs.map((ask) => {
            const isOpen = openThread === ask._id;
            return (
              <div key={ask._id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Request card */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{ask.subject}</p>
                      <p className="mt-1 text-sm text-ink-900">{ask.question}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={ask.status} />
                      <button
                        type="button"
                        onClick={() => setOpenThread(isOpen ? null : ask._id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isOpen
                            ? "border-brand-300 bg-brand-50 text-brand-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                        }`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {isOpen ? "Hide messages" : "Messages"}
                      </button>
                    </div>
                  </div>
                  {ask.responseText && (
                    <div className="mt-4 rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
                      <p className="font-semibold">Pharmacist response:</p>
                      <p className="mt-1">{ask.responseText}</p>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-400">Submitted {new Date(ask.createdAt).toLocaleString()}</p>
                </div>

                {/* Inline thread */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <PatientThreadPanel
                      entityType="ask_pharmacist"
                      entityId={ask._id}
                      title="Chat with Pharmacist"
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

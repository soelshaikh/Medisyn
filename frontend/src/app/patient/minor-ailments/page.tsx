"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, MessageSquare } from "lucide-react";
import { minorAilmentsApi } from "@/api/minor-ailments.api";
import MinorAilmentForm from "@/components/patient/MinorAilmentForm";
import PatientThreadPanel from "@/components/patient/PatientThreadPanel";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";

export default function MinorAilmentsPage() {
  const { user } = useAuthStore();
  const [openThread, setOpenThread] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ailment-requests", "my"],
    queryFn: () => minorAilmentsApi.listMyRequests(1, 50),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

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
          {isLoading ? (
            <div className="flex justify-center px-6 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !data?.docs?.length ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No minor ailment requests yet.</p>
          ) : (
            data.docs.map((item) => {
              const isOpen = openThread === item._id;
              return (
                <div key={item._id} className="divide-y divide-slate-100">
                  {/* Request row */}
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{item.ailmentName ?? "Minor ailment"}</p>
                        {typeof item.formData?.details === "string" && item.formData.details && (
                          <p className="mt-0.5 text-xs text-slate-500">{item.formData.details}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={item.status} />
                        <button
                          type="button"
                          onClick={() => setOpenThread(isOpen ? null : item._id)}
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
                    {item.responseText && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex gap-3">
                        <MessageSquare className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-700 mb-1">Pharmacist&apos;s Response</p>
                          <p className="text-sm text-blue-900 leading-relaxed">{item.responseText}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inline thread */}
                  {isOpen && (
                    <div className="bg-slate-50 px-6 py-4">
                      <PatientThreadPanel
                        entityType="minor_ailment"
                        entityId={item._id}
                        title="Messages about this request"
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { prescriptionsApi } from "@/api/prescriptions.api";
import { inputClass, labelClass } from "@/lib/ui";

export default function PrescriptionForm() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: prescriptionsApi.create,
    onSuccess: () => {
      setSuccess(true);
      void qc.invalidateQueries({ queryKey: ["prescriptions", "my"] });
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to submit. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      prescriptionNumber: fd.get("prescriptionNumber") as string,
      prescriberName:     fd.get("prescriberName") as string,
      prescriberPhone:    (fd.get("prescriberPhone") as string) || undefined,
      medicationName:     fd.get("medicationName") as string,
      dosage:             (fd.get("dosage") as string) || undefined,
      notes:              (fd.get("notes") as string) || undefined,
    });
    (e.target as HTMLFormElement).reset();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-ink-900">Add a Prescription</h2>
        <p className="mt-0.5 text-sm text-slate-500">Enter your prescription details to have it managed by MediSyn.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Prescription number</label>
            <input required name="prescriptionNumber" className={inputClass} placeholder="RX-123456" />
          </div>
          <div>
            <label className={labelClass}>Prescriber name</label>
            <input required name="prescriberName" className={inputClass} placeholder="Dr. Sarah Kim" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Medication name</label>
            <input required name="medicationName" className={inputClass} placeholder="e.g. Progesterone cream 50mg" />
          </div>
          <div>
            <label className={labelClass}>Dosage / instructions</label>
            <input name="dosage" className={inputClass} placeholder="e.g. Apply 2mg daily" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Prescriber phone (optional)</label>
            <input name="prescriberPhone" className={inputClass} placeholder="(416) 555-0100" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Additional notes (optional)</label>
          <textarea rows={2} name="notes" className={inputClass} placeholder="Allergies, preferred flavor, delivery instructions…" />
        </div>
        {success && (
          <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            Prescription submitted successfully!
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? "Submitting…" : "Submit Prescription"}
        </button>
      </form>
    </div>
  );
}

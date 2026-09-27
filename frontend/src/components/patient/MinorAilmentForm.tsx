"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { minorAilmentsApi } from "@/api/minor-ailments.api";
import { Select } from "@/components/ui/Select";
import { inputClass, labelClass } from "@/lib/ui";

export default function MinorAilmentForm() {
  const qc = useQueryClient();
  const [ailmentId, setAilmentId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: catalog = [], isLoading: loadingCatalog } = useQuery({
    queryKey: ["ailments", "catalog"],
    queryFn: minorAilmentsApi.listCatalog,
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: minorAilmentsApi.create,
    onSuccess: () => {
      setSuccess(true);
      void qc.invalidateQueries({ queryKey: ["ailment-requests", "my"] });
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
    if (!ailmentId) { setError("Please select a minor ailment service."); return; }
    const fd = new FormData(e.currentTarget);
    const details = fd.get("details") as string;
    const notes   = fd.get("notes") as string;
    mutation.mutate({
      ailmentId,
      formData: { details },
      notes:    notes || undefined,
    });
    (e.target as HTMLFormElement).reset();
    setAilmentId("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Select
        label="Minor ailment service"
        value={ailmentId}
        onChange={setAilmentId}
        placeholder={loadingCatalog ? "Loading…" : "Select a condition"}
        disabled={loadingCatalog}
        options={catalog.map((a) => ({ value: a._id, label: a.name }))}
      />
      <div>
        <label className={labelClass}>Describe your symptoms</label>
        <textarea
          rows={4}
          name="details"
          className={inputClass}
          placeholder="How long you've had symptoms, severity, any prior treatment…"
        />
      </div>
      <div>
        <label className={labelClass}>Additional notes (optional)</label>
        <textarea rows={2} name="notes" className={inputClass} placeholder="Any other relevant information…" />
      </div>
      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Your request has been submitted. A pharmacist will review it shortly.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending || loadingCatalog}
        className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {mutation.isPending ? "Submitting…" : "Submit Minor Ailment Request"}
      </button>
    </form>
  );
}

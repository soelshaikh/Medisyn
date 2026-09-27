"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import { Select } from "@/components/ui/Select";
import { inputClass, labelClass } from "@/lib/ui";

export default function AskPharmacistForm() {
  const qc = useQueryClient();
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [topic,   setTopic]   = useState("");

  /* Fetch topic list from backend */
  const { data: topics = [] } = useQuery({
    queryKey: ["ask-pharmacist-topics"],
    queryFn:  askPharmacistApi.listTopics,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: askPharmacistApi.create,
    onSuccess: () => {
      setSuccess(true);
      setTopic("");
      void qc.invalidateQueries({ queryKey: ["ask-pharmacist", "my"] });
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
      topic:    topic || undefined,
      subject:  fd.get("subject") as string,
      question: fd.get("question") as string,
    });
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Topic dropdown — only rendered when topics are available */}
      {topics.length > 0 && (
        <Select
          label="Topic / Service"
          value={topic}
          onChange={setTopic}
          placeholder="Select a topic (optional)"
          options={topics.map((t) => ({ value: t.name, label: t.name }))}
        />
      )}

      <div>
        <label className={labelClass}>Subject</label>
        <input required name="subject" className={inputClass} placeholder="e.g. Drug interaction question" />
      </div>

      <div>
        <label className={labelClass}>Your question</label>
        <textarea
          required
          rows={4}
          name="question"
          className={inputClass}
          placeholder="Ask our pharmacists anything about your medications…"
        />
      </div>

      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Your question has been submitted. A pharmacist will respond shortly.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {mutation.isPending ? "Sending…" : "Ask a Pharmacist"}
      </button>
    </form>
  );
}

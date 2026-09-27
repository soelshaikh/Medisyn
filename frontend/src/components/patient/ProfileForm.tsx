"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/users.api";
import { inputClass, labelClass } from "@/lib/ui";
import type { User } from "@/types/auth";

export default function ProfileForm({ user }: { user: User }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: () => {
      setSuccess(true);
      void qc.invalidateQueries({ queryKey: ["auth", "me"] });
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to save. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      fullName: fd.get("fullName") as string,
      phone:    fd.get("phone") as string,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Full name</label>
          <input required name="fullName" defaultValue={user.fullName} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input disabled value={user.email} className={`${inputClass} bg-slate-100 text-slate-500`} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input name="phone" defaultValue={user.phone ?? ""} className={inputClass} placeholder="(647) 555-0134" />
      </div>
      {success && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Profile saved.</p>}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {mutation.isPending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}

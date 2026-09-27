"use client";

import { useState } from "react";
import { useForgotPassword } from "@/hooks/useAuth";
import { inputClass, labelClass } from "@/lib/ui";

export default function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await forgot.mutateAsync(fd.get("email") as string);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <p className="font-semibold text-green-800">Reset link sent</p>
        <p className="mt-1 text-sm text-green-700">Check your inbox for the password reset link.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <label className={labelClass}>Email</label>
        <input required name="email" type="email" className={inputClass} placeholder="you@email.com" />
      </div>
      <button
        type="submit"
        disabled={forgot.isPending}
        className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {forgot.isPending ? "Sending link…" : "Send Reset Link"}
      </button>
    </form>
  );
}

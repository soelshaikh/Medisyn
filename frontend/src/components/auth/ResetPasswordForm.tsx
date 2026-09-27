"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useResetPassword } from "@/hooks/useAuth";
import { inputClass, labelClass } from "@/lib/ui";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const reset = useResetPassword();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm  = fd.get("confirmPassword") as string;
    if (password !== confirm) { setError("Passwords do not match."); return; }
    try {
      await reset.mutateAsync({ token, password });
      router.push("/login");
    } catch {
      setError("Reset link is invalid or has expired.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <label className={labelClass}>New password</label>
        <div className="relative">
          <input
            required
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            className={`${inputClass} pr-10`}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <label className={labelClass}>Confirm new password</label>
        <div className="relative">
          <input
            required
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            minLength={8}
            className={`${inputClass} pr-10`}
          />
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={reset.isPending}
        className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {reset.isPending ? "Updating password…" : "Reset Password"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useRegister } from "@/hooks/useAuth";
import { inputClass, labelClass } from "@/lib/ui";

export default function RegisterPatientForm() {
  const router = useRouter();
  const register = useRegister();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await register.mutateAsync({
        fullName: fd.get("fullName") as string,
        email:    fd.get("email") as string,
        phone:    fd.get("phone") as string,
        password: fd.get("password") as string,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Registration failed. Please check your details.");
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <p className="font-semibold text-green-800">Account created!</p>
        <p className="mt-1 text-sm text-green-700">
          Check your email to verify your account. Redirecting to login…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Full name</label>
          <input required name="fullName" className={inputClass} placeholder="Jane Doe" />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input required name="phone" className={inputClass} placeholder="(647) 555-0134" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input required name="email" type="email" className={inputClass} placeholder="jane@email.com" />
      </div>
      <div>
        <label className={labelClass}>Password</label>
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
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input required type="checkbox" name="consentGiven" className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600" />
        I consent to MediSyn collecting my health information to provide pharmacy services, in accordance with the Privacy Policy.
      </label>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={register.isPending}
        className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {register.isPending ? "Creating account…" : "Create Patient Account"}
      </button>
    </form>
  );
}

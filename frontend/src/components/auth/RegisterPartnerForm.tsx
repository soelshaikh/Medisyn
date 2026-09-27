"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { inputClass, labelClass } from "@/lib/ui";

export default function RegisterPartnerForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: authApi.registerPartner,
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Registration failed. Please check your details.");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      fullName:        fd.get("contactName") as string,
      email:           fd.get("email") as string,
      phone:           fd.get("pharmacyPhone") as string,
      password:        fd.get("password") as string,
      pharmacyName:    fd.get("pharmacyName") as string,
      pharmacyAddress: fd.get("pharmacyAddress") as string,
      licenseNumber:   (fd.get("licenseNumber") as string) || undefined,
    });
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <p className="font-semibold text-green-800">Request submitted!</p>
        <p className="mt-1 text-sm text-green-700">Check your email and wait for admin approval. Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Pharmacy name</label>
          <input required name="pharmacyName" className={inputClass} placeholder="Northside Pharmacy" />
        </div>
        <div>
          <label className={labelClass}>Primary contact name</label>
          <input required name="contactName" className={inputClass} placeholder="Priya Sharma, RPh" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Work email</label>
          <input required name="email" type="email" className={inputClass} placeholder="partner@email.com" />
        </div>
        <div>
          <label className={labelClass}>Pharmacy phone</label>
          <input required name="pharmacyPhone" className={inputClass} placeholder="(416) 555-0177" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Pharmacy address</label>
        <input required name="pharmacyAddress" className={inputClass} placeholder="456 King St, Toronto, ON" />
      </div>
      <div>
        <label className={labelClass}>License number (optional)</label>
        <input name="licenseNumber" className={inputClass} placeholder="OCP license #" />
      </div>
      <div>
        <label className={labelClass}>Create a password</label>
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
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {mutation.isPending ? "Submitting request…" : "Request Partner Access"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Pharmacy partner accounts require email verification and MediSyn admin approval before portal access is granted.
      </p>
    </form>
  );
}

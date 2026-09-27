"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import { inputClass, labelClass } from "@/lib/ui";

function roleHome(role: string): string {
  if (role === "clinic") return "/clinic";
  if (role === "pharmacy_partner") return "/partner";
  return "/patient";
}

export default function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const data = await login.mutateAsync({
        email:    fd.get("email") as string,
        password: fd.get("password") as string,
      });
      router.replace(roleHome(data.user.role));
    } catch {
      setError("Invalid email or password. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <label className={labelClass}>Email</label>
        <input required name="email" type="email" className={inputClass} placeholder="you@email.com" />
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <div className="relative">
          <input
            required
            name="password"
            type={showPassword ? "text" : "password"}
            className={`${inputClass} pr-10`}
            placeholder="••••••••"
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
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
          Forgot password?
        </Link>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={login.isPending}
        className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {login.isPending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

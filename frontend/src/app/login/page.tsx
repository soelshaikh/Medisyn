import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log In | MediSyn Compounding" };

export default function LoginPage() {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Welcome back</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Log in to MediSyn</h1>
          <p className="mt-2 text-sm text-slate-600">
            Patients, clinics, pharmacy partners and staff all sign in here.
          </p>
        </div>
        <div className="mt-8">
          <LoginForm />
        </div>
        <div className="mt-6 space-y-2 text-center text-sm text-slate-600">
          <p>
            New patient?{" "}
            <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800">
              Create an account
            </Link>
          </p>
          <p>
            <Link href="/register/clinic" className="text-brand-700 hover:text-brand-800">
              Clinic access request
            </Link>
            {" · "}
            <Link href="/register/pharmacy-partner" className="text-brand-700 hover:text-brand-800">
              Pharmacy partner access request
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

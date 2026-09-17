import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot Password | MediSyn Compounding" };

export default function ForgotPasswordPage() {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Account Recovery</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the email on your account and we&rsquo;ll send you a reset link.
          </p>
        </div>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Back to login
          </Link>
        </p>
      </div>
    </section>
  );
}

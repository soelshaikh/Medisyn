import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RegisterPatientForm from "@/components/auth/RegisterPatientForm";

export const metadata: Metadata = { title: "Create a Patient Account | MediSyn Compounding" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/patient");

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Patient Registration</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Create your patient account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage prescriptions, appointments and pharmacist requests all in one place.
          </p>
        </div>
        <div className="mt-8">
          <RegisterPatientForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </p>
        <div className="mt-4 rounded-xl bg-white p-4 text-center text-xs text-slate-500 ring-1 ring-slate-200">
          Represent a clinic or pharmacy?{" "}
          <Link href="/register/clinic" className="font-semibold text-brand-700">Clinic access</Link>
          {" · "}
          <Link href="/register/pharmacy-partner" className="font-semibold text-brand-700">Pharmacy partner access</Link>
        </div>
      </div>
    </section>
  );
}

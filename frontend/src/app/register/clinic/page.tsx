import type { Metadata } from "next";
import Link from "next/link";
import RegisterClinicForm from "@/components/auth/RegisterClinicForm";

export const metadata: Metadata = { title: "Clinic Access Request | MediSyn Compounding" };

export default function RegisterClinicPage() {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">For Clinics</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Request clinic portal access</h1>
          <p className="mt-2 text-sm text-slate-600">
            Coordinate patient referrals and prescriptions with MediSyn. New clinic accounts are verified by
            email and then reviewed by our admin team before activation.
          </p>
        </div>
        <div className="mt-8">
          <RegisterClinicForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already approved?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </p>
      </div>
    </section>
  );
}

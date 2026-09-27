"use client";

import Link from "next/link";
import { ArrowRight, FileText, RefreshCcw, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const OPTIONS_LOGGED_OUT = [
  {
    icon: FileText,
    title: "New Prescription",
    description:
      "Have a prescription from your doctor? Upload it to MediSyn and we'll compound and deliver your custom medication.",
    href: "/register",
    cta: "Create an account",
    accent: "bg-brand-50 text-brand-600",
  },
  {
    icon: RefreshCcw,
    title: "Refill a Prescription",
    description:
      "Already a MediSyn patient? Log in to request a refill for your existing compounded medication.",
    href: "/login",
    cta: "Log in to refill",
    accent: "bg-sky-50 text-sky-600",
  },
  {
    icon: ArrowRightLeft,
    title: "Transfer a Prescription",
    description:
      "Currently filling your prescription elsewhere? We can transfer it to MediSyn — just create an account and we'll handle the rest.",
    href: "/register",
    cta: "Start transfer",
    accent: "bg-amber-50 text-amber-600",
  },
];

const OPTIONS_LOGGED_IN = [
  {
    icon: FileText,
    title: "New Prescription",
    description:
      "Upload a new prescription from your doctor and our pharmacists will prepare your custom compound and deliver it to your door.",
    href: "/get-started/new",
    cta: "Request delivery",
    accent: "bg-brand-50 text-brand-600",
  },
  {
    icon: RefreshCcw,
    title: "Refill a Prescription",
    description:
      "Already a MediSyn patient? Request a refill for your existing compounded medications with free delivery.",
    href: "/get-started/refill",
    cta: "Request a refill",
    accent: "bg-sky-50 text-sky-600",
  },
  {
    icon: ArrowRightLeft,
    title: "Transfer a Prescription",
    description:
      "Currently filling your prescription elsewhere? We can transfer your entire file to MediSyn — we handle all the paperwork.",
    href: "/get-started/transfer",
    cta: "Start transfer",
    accent: "bg-amber-50 text-amber-600",
  },
];

export default function GetStartedContent() {
  const { isAuthenticated, user } = useAuthStore();
  const options = isAuthenticated ? OPTIONS_LOGGED_IN : OPTIONS_LOGGED_OUT;

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Get Started</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            How can we help you today?
          </h1>
          <p className="mt-3 text-slate-600">
            Choose the option that matches your situation and we&rsquo;ll guide you through the next steps.
          </p>
        </div>

        {/* Logged-in banner */}
        {isAuthenticated && user && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
            <CheckCircle2 size={20} className="shrink-0 text-brand-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-800">
                Welcome back, {user.fullName.split(" ")[0]}!
              </p>
              <p className="text-xs text-brand-600">
                You&rsquo;re signed in — your prescriptions are ready in your patient portal.
              </p>
            </div>
            <Link
              href="/patient"
              className="shrink-0 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition"
            >
              Go to Portal
            </Link>
          </div>
        )}

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {options.map((opt) => (
            <div
              key={opt.title}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${opt.accent}`}>
                <opt.icon className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-semibold text-ink-900">{opt.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{opt.description}</p>
              <Link
                href={opt.href}
                className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                {opt.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Have questions before you start?{" "}
          <Link href="/contact" className="font-semibold text-brand-700 hover:text-brand-800">
            Talk to a pharmacist
          </Link>
        </p>
      </div>
    </section>
  );
}

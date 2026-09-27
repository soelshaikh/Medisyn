import type { Metadata } from "next";
import Link from "next/link";
import {
  Stethoscope, ShieldCheck, CheckCircle2, ArrowRight, Clock,
  ChevronDown, ClipboardList, MessageCircle, Truck,
} from "lucide-react";
import ConditionsGrid from "@/components/minor-ailments/ConditionsGrid";

export const metadata: Metadata = {
  title: "Minor Ailments | Medisyn Pharmacy",
  description:
    "Ontario pharmacists can now assess and treat minor ailments directly — no doctor's appointment needed. Medisyn pharmacists can prescribe for 19+ conditions, available online.",
};

/* ─── Data ─── */
const STATS = [
  { value: "19+",   label: "Treatable conditions" },
  { value: "Same",  label: "Day assessment" },
  { value: "100%",  label: "Online — no waiting room" },
  { value: "ON",    label: "Licensed pharmacy" },
];


const HOW_IT_WORKS = [
  {
    step: "01",
    icon: ClipboardList,
    title: "Submit your request",
    description: "Create a free Medisyn account and fill in a short symptom questionnaire. No appointment, no waiting room — takes under 3 minutes.",
  },
  {
    step: "02",
    icon: Stethoscope,
    title: "Pharmacist assessment",
    description: "A licensed Ontario pharmacist reviews your answers and may ask a follow-up question. We confirm your identity and medical history before prescribing.",
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Prescription issued",
    description: "If your condition is appropriate for pharmacy prescribing, we issue a prescription right away — with full clinical documentation on file.",
  },
  {
    step: "04",
    icon: Truck,
    title: "Medication delivered",
    description: "Your prescription is dispensed and shipped to your door, or held for in-store pickup. Free delivery on orders over $49.",
  },
];

const FAQS = [
  {
    q: "Do I need a doctor's referral?",
    a: "No. Under Ontario's Expanded Scope of Practice regulation, pharmacists can independently assess and prescribe for minor ailments. You come directly to us — no referral or prior physician visit needed.",
  },
  {
    q: "Is a pharmacist prescribing the same as seeing a doctor?",
    a: "For the specific conditions in scope, absolutely. Our pharmacists are trained and licensed to perform the clinical assessment, confirm the diagnosis, and issue a prescription — exactly as a physician would for these conditions.",
  },
  {
    q: "How long does the assessment take?",
    a: "Most assessments are completed the same business day you submit your request. In off-hours, you'll typically receive a response within a few hours of the next business day.",
  },
  {
    q: "What if my condition is outside pharmacy scope?",
    a: "If your symptoms suggest something more complex or require physician-level investigation, we will tell you clearly and refer you to the right provider — we never prescribe beyond what's appropriate.",
  },
  {
    q: "Is this covered by insurance?",
    a: "Many Ontario drug benefit plans and private insurers cover prescriptions issued by pharmacists. Coverage depends on your specific plan. We generate standard pharmacy receipts compatible with insurance submission.",
  },
  {
    q: "Which provinces is this available in?",
    a: "We are currently licensed in Ontario. Minor ailment prescribing scope varies by province — contact us if you are located outside Ontario and we will advise on your options.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white px-5 transition-shadow hover:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown size={16} className="shrink-0 text-brand-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-slate-600">{a}</p>
    </details>
  );
}

export default function MinorAilmentsPage() {
  return (
    <>
      {/* ── 1. Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-20 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-100">
                <Stethoscope size={12} /> Minor Ailments Program
              </span>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">
                See a pharmacist.<br />
                <span className="text-brand-200">Skip the wait.</span>
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-brand-100">
                Ontario pharmacists can now assess and prescribe for 19+ common conditions — no
                doctor's appointment, no referral, no waiting room. Fast, online, and covered by
                most insurance plans.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/patient/minor-ailments"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50"
                >
                  Start a Request <ArrowRight size={14} />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ask a Pharmacist
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm">
                  <p className="font-display text-3xl font-bold text-white">{s.value}</p>
                  <p className="mt-1 text-sm text-brand-200">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. What are minor ailments ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative order-2 lg:order-1">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-brand-100 to-brand-200 p-8 shadow-xl ring-1 ring-black/5">
              <div className="flex flex-col gap-4">
                {[
                  { icon: Clock,         color: "bg-amber-50 text-amber-500",  label: "Same-day assessment" },
                  { icon: ShieldCheck,   color: "bg-brand-50 text-brand-600",  label: "Licensed Ontario pharmacist" },
                  { icon: MessageCircle, color: "bg-slate-50 text-slate-600",  label: "Secure online consultation" },
                  { icon: Truck,         color: "bg-green-50 text-green-600",  label: "Prescription & delivery included" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-white">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                      <item.icon size={16} />
                    </div>
                    <span className="text-sm font-medium text-ink-800">{item.label}</span>
                    <CheckCircle2 size={15} className="ml-auto shrink-0 text-brand-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -right-3 -top-3 rounded-2xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-lg">
              Ontario Regulated
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">What Is a Minor Ailment?</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Common conditions. Fast treatment.
            </h2>
            <p className="mt-5 leading-relaxed text-slate-600">
              Minor ailments are self-limiting conditions with a low risk of complications that can
              be reliably diagnosed and safely treated without physician involvement. Ontario's
              expanded pharmacy regulations allow licensed pharmacists to assess, diagnose, and
              prescribe for a defined list of these conditions directly.
            </p>
            <p className="mt-4 leading-relaxed text-slate-600">
              This means faster care for you — no waiting weeks for a GP appointment for a UTI or
              pink eye. Your Medisyn pharmacist handles everything: the clinical assessment, the
              prescription, and dispensing.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                "No doctor referral required — pharmacist prescribes directly",
                "Secure online questionnaire reviewed by a licensed pharmacist",
                "Prescription issued same day in most cases",
                "Medication shipped to your door or available for pickup",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 3. Conditions ── */}
      <section className="bg-brand-50/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Conditions We Treat</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Conditions in pharmacy scope
            </h2>
            <p className="mt-4 text-slate-600">
              All conditions below are within Ontario pharmacist prescribing scope. If yours isn't
              listed, contact us — we may still be able to help.
            </p>
          </div>

          <ConditionsGrid />
        </div>
      </section>

      {/* ── 4. How it works ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">How It Works</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            Assessment and prescription in 4 steps
          </h2>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, idx) => (
            <div key={step.step} className="relative flex flex-col gap-3">
              {idx < HOW_IT_WORKS.length - 1 && (
                <div className="absolute left-[calc(50%+2rem)] top-7 hidden h-0.5 w-[calc(100%-2rem)] bg-brand-100 lg:block" />
              )}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                <step.icon size={24} />
              </div>
              <span className="font-display text-3xl font-extrabold text-brand-100">{step.step}</span>
              <h3 className="font-display text-base font-semibold text-ink-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/patient/minor-ailments"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 transition"
          >
            Start your request now <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ── 5. FAQ ── */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            Common questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Still have questions?{" "}
          <Link href="/contact" className="font-semibold text-brand-600 hover:underline">
            Contact our pharmacists →
          </Link>
        </p>
      </section>

      {/* ── 6. CTA ── */}
      <section className="bg-gradient-to-r from-brand-700 to-brand-500 py-20 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Stethoscope size={40} className="mx-auto text-brand-200" />
          <h2 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
            Get treated today — no waiting room.
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Create your free Medisyn account, describe your symptoms, and a licensed pharmacist
            will assess and prescribe — usually the same day.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/patient/minor-ailments"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50"
            >
              Start a Minor Ailment Request <ArrowRight size={14} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ask a Pharmacist First
            </Link>
          </div>
          <p className="mt-6 text-sm text-brand-200">
            Ontario licensed · Same-day assessment · Covered by most insurance
          </p>
        </div>
      </section>
    </>
  );
}

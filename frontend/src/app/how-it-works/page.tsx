import type { Metadata } from "next";
import Link from "next/link";
import { UploadCloud, MessagesSquare, FlaskRound, Truck, FileText, Repeat, ArrowRightLeft } from "lucide-react";
import { TracingBeam } from "@/components/ui/tracing-beam";

export const metadata: Metadata = {
  title: "How It Works | Medisyn Compounding",
  description:
    "See how Medisyn Compounding takes your prescription from upload to doorstep delivery — new prescriptions, refills, and transfers made simple.",
};

const STEPS = [
  {
    icon: UploadCloud,
    step: "Step 1",
    title: "Submit your prescription",
    description:
      "Upload a photo of a new prescription, request a refill, or transfer an existing prescription from another pharmacy — all online in under two minutes.",
  },
  {
    icon: MessagesSquare,
    step: "Step 2",
    title: "Talk with a pharmacist",
    description:
      "A licensed Medisyn pharmacist reviews your health history and confirms the ideal strength, format and flavor for your compounded medication.",
  },
  {
    icon: FlaskRound,
    step: "Step 3",
    title: "We compound your medication",
    description:
      "Your formulation is prepared by hand in our lab using pharmaceutical-grade ingredients, tested for accuracy, and packaged for freshness.",
  },
  {
    icon: Truck,
    step: "Step 4",
    title: "Delivered to your door",
    description:
      "Track your order in real time. Delivery is free across Canada on orders over $49, with express options available.",
  },
];

const PATHS = [
  {
    icon: FileText,
    title: "New Prescription",
    description:
      "Have your doctor fax it to us, or upload a photo yourself — we'll confirm details before compounding.",
    href: "/get-started?type=new",
  },
  {
    icon: Repeat,
    title: "Refill Request",
    description:
      "Already a Medisyn patient? Request your next refill online and we'll have it ready for pickup or delivery.",
    href: "/get-started?type=refill",
  },
  {
    icon: ArrowRightLeft,
    title: "Transfer Prescription",
    description:
      "Switching from another pharmacy is easy — give us your current pharmacy's info and we handle the rest.",
    href: "/get-started?type=transfer",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">How It Works</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink-900 sm:text-5xl">
            From prescription to doorstep, simplified
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Whether it&rsquo;s a brand-new prescription or a routine refill, Medisyn makes getting your medication
            effortless.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <TracingBeam className="px-4 md:px-0">
          <div className="space-y-16 py-4">
            {STEPS.map((step) => (
              <div key={step.title} className="flex gap-6 md:gap-10">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                  <step.icon className="h-8 w-8" />
                </div>
                <div className="pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{step.step}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-ink-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </TracingBeam>
      </section>

      <section className="bg-brand-50/60 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">Choose your path</h2>
            <p className="mt-3 text-slate-600">Pick the option that matches where you are today.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PATHS.map((path) => (
              <Link
                key={path.title}
                href={path.href}
                className="group rounded-2xl bg-white p-7 ring-1 ring-slate-200 transition hover:-translate-y-1 hover:ring-brand-400"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition">
                  <path.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">{path.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{path.description}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-brand-700">Start now →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

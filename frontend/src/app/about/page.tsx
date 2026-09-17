import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck, GraduationCap, HeartHandshake, Leaf } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us | Medisyn Compounding",
  description:
    "Medisyn Compounding is a licensed Canadian pharmacy team dedicated to personalized medicine, quality ingredients, and compassionate patient care.",
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Quality & Safety First",
    description: "Every formulation follows strict quality control aligned with PCAB compounding standards.",
  },
  {
    icon: GraduationCap,
    title: "Pharmacist-Led Care",
    description: "Our compounding pharmacists bring decades of combined specialty pharmacy experience.",
  },
  {
    icon: HeartHandshake,
    title: "Patient-First Approach",
    description: "We take the time to understand your health story before we ever touch a formulation.",
  },
  {
    icon: Leaf,
    title: "Thoughtful Ingredients",
    description: "Dye-free, allergen-conscious options sourced from trusted pharmaceutical suppliers.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Our Story</p>
            <h1 className="mt-3 font-display text-4xl font-bold text-ink-900 sm:text-5xl">
              Medicine made for one person: you.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Medisyn Compounding was founded by pharmacists frustrated with the limits of one-size-fits-all
              medicine. Too many patients — kids who can&apos;t swallow pills, seniors managing complex
              regimens, people with rare allergies — were being told &ldquo;that&rsquo;s just how the
              medication comes.&rdquo; We built Medisyn to change that answer.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Today, our licensed compounding lab serves patients across Canada with custom formulations,
              backed by real pharmacist consultations and fast, reliable delivery.
            </p>
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <Image
              src="/images/about-team.jpg"
              alt="The Medisyn Compounding pharmacist team"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 90vw, 560px"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">What We Stand For</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Our values</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <value.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-base font-semibold text-ink-900">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink-900 py-16 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Licensed & regulated</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Medisyn Compounding is a licensed pharmacy accredited by the Ontario College of Pharmacists.
            Our compounding lab operates under strict non-sterile and sterile compounding protocols aligned
            with national standards to ensure every formulation is safe, accurate, and effective.
          </p>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-6">
              <p className="font-display text-2xl font-bold text-brand-300">OCP</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Licensed Pharmacy</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-6">
              <p className="font-display text-2xl font-bold text-brand-300">PCAB-Aligned</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Compounding Standards</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-6">
              <p className="font-display text-2xl font-bold text-brand-300">NAPRA</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">Compliant Practices</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

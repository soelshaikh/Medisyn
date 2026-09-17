import type { Metadata } from "next";
import Link from "next/link";
import {
  FlaskConical,
  RefreshCcw,
  ClipboardCheck,
  PackageCheck,
  PawPrint,
  Syringe,
  Sparkles,
  Baby,
  HeartPulse,
  Activity,
  Dna,
  Dumbbell,
  Pill,
  Gauge,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Services & Compounding Specialties | Medisyn Compounding",
  description:
    "Explore Medisyn Compounding's full range of pharmacy services: custom compounding, refills, transfers, MedsCheck reviews, compliance packaging, veterinary medicine and specialty formulations.",
};

const CORE_SERVICES = [
  {
    icon: FlaskConical,
    title: "Custom Compounding",
    description:
      "We prepare medications from pharmaceutical-grade base ingredients, adjusting strength, flavor, and format to match your exact needs — something a pre-made retail product can't do.",
  },
  {
    icon: RefreshCcw,
    title: "Prescription Refills & Transfers",
    description:
      "Manage every active prescription online. Request a refill in seconds or transfer your file from another pharmacy — we handle the paperwork and confirm with your current provider.",
  },
  {
    icon: ClipboardCheck,
    title: "MedsCheck Medication Reviews",
    description:
      "A one-on-one appointment with a pharmacist to review every medication you take, flag interactions, and simplify complicated regimens. Free for eligible Ontario patients.",
  },
  {
    icon: PackageCheck,
    title: "Compliance Packaging",
    description:
      "Multi-dose blister packs sorted by date and time of day at no additional cost — ideal for patients managing multiple prescriptions or caring for a loved one.",
  },
  {
    icon: PawPrint,
    title: "Veterinary Compounding",
    description:
      "We collaborate directly with veterinarians to compound medication in flavors and forms pets will actually take, at the correct weight-based dose.",
  },
  {
    icon: Syringe,
    title: "Vaccinations & Minor Ailments",
    description:
      "Seasonal flu shots, travel vaccinations, and pharmacist assessment and prescribing for minor ailments such as UTIs, pink eye, cold sores and allergies.",
  },
  {
    icon: Gauge,
    title: "Health Monitoring",
    description:
      "In-pharmacy blood pressure and glucose monitoring with pharmacist guidance for patients managing hypertension, diabetes, and other chronic conditions.",
  },
];

const SPECIALTIES = [
  { icon: Sparkles, title: "Dermatology & Anti-Aging", description: "Personalized creams and gels for acne, eczema, psoriasis, dermatitis and anti-wrinkle care." },
  { icon: Baby, title: "Pediatric Compounding", description: "Great-tasting, correctly dosed liquids and chewables for children who struggle with standard medication." },
  { icon: Dna, title: "Hormone Therapy & Fertility", description: "Bio-identical hormone replacement, progesterone, estradiol and testosterone formulations." },
  { icon: HeartPulse, title: "Men's Health", description: "Rapid-dissolve tablets and customized treatment options for erectile dysfunction and low testosterone." },
  { icon: Activity, title: "Pain Management", description: "Transdermal pain creams combining multiple active ingredients to target localized pain without systemic side effects." },
  { icon: Dumbbell, title: "Sports Recovery", description: "Recovery blends, magnesium formulations and topical anti-inflammatories built for active lifestyles." },
  { icon: PawPrint, title: "Veterinary Medicine", description: "Flavored, easy-to-administer medication for dogs, cats, and other companion animals." },
  { icon: Pill, title: "Allergy-Friendly Formulas", description: "Dye-free, gluten-free, lactose-free and preservative-free medication options available on request." },
];

export default function ServicesPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Services</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink-900 sm:text-5xl">
            Pharmacy care built around your prescription
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            From made-to-order compounds to everyday refills and vaccinations, our licensed pharmacists deliver
            precision care with a personal touch.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_SERVICES.map((service) => (
            <div key={service.title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <service.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-50/60 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Compounding Specialties</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Specialized formulations for every need
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SPECIALTIES.map((item) => (
              <div key={item.title} className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
          Not sure which service you need?
        </h2>
        <p className="mt-3 text-slate-600">
          Talk to a Medisyn pharmacist for free — we&rsquo;ll recommend the right formulation and handle the rest.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/get-started" className="rounded-full bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-brand-700">
            Get Started
          </Link>
          <Link href="/contact" className="rounded-full border border-slate-300 px-7 py-3.5 text-sm font-semibold text-ink-900 hover:border-brand-400">
            Ask a Pharmacist
          </Link>
        </div>
      </section>
    </>
  );
}

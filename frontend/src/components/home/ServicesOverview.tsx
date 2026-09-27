import Link from "next/link";
import {
  FlaskConical,
  RefreshCcw,
  ClipboardCheck,
  PackageCheck,
  PawPrint,
  Syringe,
} from "lucide-react";
import { CardHoverEffect } from "@/components/ui/card-hover-effect";

const SERVICES = [
  {
    icon: <FlaskConical className="h-6 w-6" />,
    title: "Custom Compounding",
    description:
      "Precision-dosed medications made from base ingredients — flavored liquids, capsules, topicals and more.",
  },
  {
    icon: <RefreshCcw className="h-6 w-6" />,
    title: "Refills & Transfers",
    description:
      "Move your prescriptions to Medisyn in minutes, or refill existing ones online in a few clicks.",
  },
  {
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: "MedsCheck Reviews",
    description:
      "One-on-one medication reviews with a pharmacist to catch interactions and optimize your regimen.",
  },
  {
    icon: <PackageCheck className="h-6 w-6" />,
    title: "Compliance Packaging",
    description:
      "Blister packs sorted by date and time at no extra cost, built for complex medication schedules.",
  },
  {
    icon: <PawPrint className="h-6 w-6" />,
    title: "Veterinary Compounding",
    description:
      "Palatable, correctly dosed medications for pets, made in partnership with your veterinarian.",
  },
  {
    icon: <Syringe className="h-6 w-6" />,
    title: "Vaccinations & Minor Ailments",
    description:
      "Flu shots, travel vaccines, and pharmacist prescribing for common ailments like UTIs and pink eye.",
  },
];

export default function ServicesOverview() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">What We Do</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
          Full-service pharmacy care, built around your prescription
        </h2>
        <p className="mt-4 text-slate-600">
          From made-to-order compounds to everyday refills, our pharmacists handle it all with the same
          attention to detail.
        </p>
      </div>

      <CardHoverEffect items={SERVICES} className="mt-4" />

      <div className="mt-4 text-center">
        <Link
          href="/services"
          className="inline-flex rounded-full bg-ink-900 px-7 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Explore All Services
        </Link>
      </div>
    </section>
  );
}

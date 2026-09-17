import type { Metadata } from "next";
import { Mail, MapPin, Phone, Clock, Printer } from "lucide-react";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us | Medisyn Compounding",
  description: "Reach the Medisyn Compounding pharmacy team by phone, email, or our contact form for questions about compounding, refills, and delivery.",
};

export default function ContactPage() {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Contact</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink-900 sm:text-5xl">We&apos;re here to help</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Questions about a formulation, a refill, or insurance coverage? Send us a message or call the
            pharmacy directly.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <h2 className="font-display text-lg font-semibold text-ink-900">Pharmacy Details</h2>
              <ul className="mt-5 space-y-4 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  4820 Bathurst Street, Unit 3, Toronto, ON M2R 1X9, Canada
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-brand-600" />
                  <a href="tel:18774331234" className="hover:text-brand-700">1-877-433-1234</a>
                </li>
                <li className="flex items-center gap-3">
                  <Printer className="h-5 w-5 shrink-0 text-brand-600" />
                  Fax: 416-555-0199
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-brand-600" />
                  <a href="mailto:care@medisyncompounding.ca" className="hover:text-brand-700">care@medisyncompounding.ca</a>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  <span>
                    Mon–Fri: 8:30am – 7:00pm
                    <br />
                    Saturday: 9:00am – 5:00pm
                    <br />
                    Sunday: Closed
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-ink-900 p-7 text-white">
              <h2 className="font-display text-lg font-semibold">Prefer to talk now?</h2>
              <p className="mt-2 text-sm text-slate-300">
                Our pharmacists are available by phone during business hours for urgent questions about your
                medication.
              </p>
              <a
                href="tel:18774331234"
                className="mt-4 inline-flex rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold hover:bg-brand-400"
              >
                Call 1-877-433-1234
              </a>
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}

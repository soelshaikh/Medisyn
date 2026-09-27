"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Clock, ShieldCheck, ChevronRight, Loader2 } from "lucide-react";
import { appointmentsApi } from "@/api/appointments.api";

export default function VaccinationsPage() {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["vaccine-services"],
    queryFn:  appointmentsApi.listServices,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Vaccinations</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink-900 sm:text-5xl">
            Protect yourself with trusted vaccines
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
            Book a vaccination appointment directly at MediSyn. Our licensed pharmacists administer a range
            of vaccines — from seasonal flu to travel immunizations.
          </p>
        </div>
      </section>

      {/* Vaccine cards */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">Available vaccines</h2>
        <p className="text-sm text-slate-500 mb-8">Select a vaccine to view details and book an appointment.</p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-slate-500">No vaccines currently available. Please check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc) => (
              <Link
                key={svc._id}
                href={`/services/vaccinations/${svc.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md block"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 mt-1 text-slate-300 group-hover:text-brand-400 transition-colors" />
                </div>

                <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{svc.name}</h3>

                {svc.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 line-clamp-2">{svc.description}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {svc.durationMinutes && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      <Clock className="h-3 w-3" />
                      {svc.durationMinutes} min
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    Book now
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer CTA */}
      <section className="bg-brand-50/60 py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-2xl font-bold text-ink-900">Questions about vaccines?</h2>
          <p className="mt-3 text-slate-600">
            Our pharmacists can help you determine which vaccines you need and whether you are eligible.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/patient/ask-a-pharmacist"
              className="rounded-full bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 transition"
            >
              Ask a Pharmacist
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-slate-300 px-7 py-3.5 text-sm font-semibold text-ink-900 hover:border-brand-400 transition"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

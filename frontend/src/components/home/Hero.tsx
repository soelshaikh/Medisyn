"use client";
import { ShieldCheck, Truck, Clock3, Star, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";
import { Spotlight } from "@/components/ui/spotlight";
import { FlipWords } from "@/components/ui/flip-words";
import { ShimmerButton } from "@/components/ui/shimmer-button";

const TAGLINES = ["Precision.", "Purity.", "Delivered.", "Care."];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#1677A8" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-1/2 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Star className="h-3.5 w-3.5 fill-brand-600 text-brand-600" /> Rated 4.9/5 by Canadian patients
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
            Personalized medication,
            <span className="block text-brand-600">compounded around you.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Medisyn Compounding is a licensed Canadian pharmacy that formulates custom-dosed medications from
            base ingredients — precisely tailored to your age, allergies and lifestyle — then delivers them to
            your door, anywhere in Canada.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ShimmerButton href="/get-started" variant="primary">
              Start Your Prescription
            </ShimmerButton>
            <ShimmerButton href="/how-it-works" variant="outline">
              See How It Works
            </ShimmerButton>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" />
              Licensed &amp; regulated
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Truck className="h-5 w-5 shrink-0 text-brand-600" />
              Free delivery over $49
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock3 className="h-5 w-5 shrink-0 text-brand-600" />
              Same-day compounding
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] shadow-2xl shadow-brand-900/20 ring-1 ring-black/5">
            <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-brand-50 via-brand-100 to-brand-200">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-lg shadow-brand-600/20">
                <FlaskConical className="h-14 w-14 text-brand-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-brand-700">Custom Compounding</p>
                <p className="mt-1 text-xs text-brand-500">
                  <FlipWords words={TAGLINES} />
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 hidden w-56 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Compounded &amp; ready</p>
            <p className="mt-1 text-sm text-slate-600">Most custom formulations prepared within 24 hours.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

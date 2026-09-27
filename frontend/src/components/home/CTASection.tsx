import { ShimmerButton } from "@/components/ui/shimmer-button";

export default function CTASection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-14 text-center text-white sm:px-16">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-gold-500/20 blur-2xl" />
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Ready for medication made just for you?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-brand-50">
          Book a free consultation with a Medisyn pharmacist and discover a formulation designed around your
          health needs.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ShimmerButton href="/get-started" variant="ghost" className="border-white/70 bg-white text-brand-700 hover:bg-brand-50">
            Book Free Consultation
          </ShimmerButton>
          <ShimmerButton href="/contact" variant="ghost">
            Ask a Pharmacist
          </ShimmerButton>
        </div>
      </div>
    </section>
  );
}

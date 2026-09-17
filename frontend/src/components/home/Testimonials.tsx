import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Way better than chain pharmacies. The pharmacist prepared my compound in under 15 minutes and actually explained how it works.",
    name: "Amara O.",
    location: "Toronto, ON",
  },
  {
    quote:
      "My daughter finally takes her medication without a fight thanks to the flavored pediatric compound. The team was so patient with our questions.",
    name: "Devon K.",
    location: "Mississauga, ON",
  },
  {
    quote:
      "Transferred all our family prescriptions in one call. Delivery to Alberta took two days and the packaging was perfect.",
    name: "Priya S.",
    location: "Calgary, AB",
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Patient Stories</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Trusted by patients across Canada</h2>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex gap-1 text-gold-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-gold-500" />
              ))}
            </div>
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-5 border-t border-slate-100 pt-4 text-sm">
              <span className="font-semibold text-ink-900">{t.name}</span>
              <span className="text-slate-500"> · {t.location}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

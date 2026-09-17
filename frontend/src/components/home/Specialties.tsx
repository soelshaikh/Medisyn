import { Sparkles, Baby, HeartPulse, Activity, Dna, PawPrint, Dumbbell, Pill } from "lucide-react";

const SPECIALTIES = [
  { icon: Sparkles, title: "Dermatology & Anti-Aging", description: "Custom acne, eczema, psoriasis and anti-wrinkle formulations." },
  { icon: Baby, title: "Pediatric Compounding", description: "Flavored, easy-to-take doses for kids who won't take standard medicine." },
  { icon: Dna, title: "Hormone Therapy & Fertility", description: "Bio-identical hormone therapy, progesterone and estradiol treatments." },
  { icon: HeartPulse, title: "Men's Health", description: "Rapid-dissolve tablets and tailored therapies for ED and low testosterone." },
  { icon: Activity, title: "Pain Management", description: "Topical pain creams and gels combining multiple active ingredients." },
  { icon: Dumbbell, title: "Sports Recovery", description: "Magnesium, recovery blends and topical anti-inflammatories for athletes." },
  { icon: PawPrint, title: "Veterinary Medicine", description: "Palatable, precisely dosed medication for pets of every size." },
  { icon: Pill, title: "Allergy-Friendly Formulas", description: "Dye-free, gluten-free and preservative-free options on request." },
];

export default function Specialties() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Compounding Specialties</p>
        <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
          Formulated for every stage of life
        </h2>
        <p className="mt-4 text-slate-600">
          Our pharmacists collaborate with your prescriber to design a formulation that fits your body, not
          the other way around.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SPECIALTIES.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl bg-gradient-to-b from-white to-brand-50/50 p-6 ring-1 ring-slate-200 transition hover:ring-brand-300"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

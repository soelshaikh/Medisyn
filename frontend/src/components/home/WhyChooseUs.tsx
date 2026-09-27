import { Check, FlaskConical, X } from "lucide-react";

const ROWS = [
  { feature: "Medications tailored to your exact dose & allergies", medisyn: true, chain: false },
  { feature: "Speak directly with the compounding pharmacist", medisyn: true, chain: false },
  { feature: "Free Canada-wide delivery over $49", medisyn: true, chain: false },
  { feature: "Most compounds prepared within 24 hours", medisyn: true, chain: false },
  { feature: "Online prescription upload, refill & transfer", medisyn: true, chain: true },
  { feature: "Long call-center wait times", medisyn: false, chain: true },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-brand-50/60">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-100 via-brand-200 to-brand-300">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg shadow-brand-600/20">
                <FlaskConical className="h-10 w-10 text-brand-600" />
              </div>
              <div className="text-center">
                <p className="font-display text-lg font-semibold text-brand-800">Precision Compounding</p>
                <p className="mt-1 text-sm text-brand-600">Custom formulations, every time</p>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Why Medisyn</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            Precision care that big-box pharmacies can&apos;t match
          </h2>
          <p className="mt-4 text-slate-600">
            We built Medisyn Compounding for patients who need more than a pre-mixed bottle off the shelf —
            here&apos;s how we compare.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 bg-ink-900 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white">
              <span>Feature</span>
              <span className="text-brand-300">Medisyn</span>
              <span className="text-slate-400">Chain Pharmacy</span>
            </div>
            {ROWS.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-slate-100 px-5 py-3.5 text-sm text-slate-700"
              >
                <span>{row.feature}</span>
                <span className="flex justify-center">
                  {row.medisyn ? (
                    <Check className="h-5 w-5 text-brand-600" />
                  ) : (
                    <X className="h-5 w-5 text-slate-300" />
                  )}
                </span>
                <span className="flex justify-center">
                  {row.chain ? (
                    <Check className="h-5 w-5 text-slate-400" />
                  ) : (
                    <X className="h-5 w-5 text-slate-300" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

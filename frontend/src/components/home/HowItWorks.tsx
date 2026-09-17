import { UploadCloud, MessagesSquare, FlaskRound, Truck } from "lucide-react";

const STEPS = [
  {
    icon: UploadCloud,
    title: "Send Your Prescription",
    description: "Upload a photo, fax it, or have your doctor send it directly — or request a refill or transfer online.",
  },
  {
    icon: MessagesSquare,
    title: "Consult a Pharmacist",
    description: "We review your health profile and confirm the exact formulation, strength and delivery format.",
  },
  {
    icon: FlaskRound,
    title: "We Compound It",
    description: "Your medication is prepared by hand in our lab using pharmaceutical-grade base ingredients.",
  },
  {
    icon: Truck,
    title: "Delivered to Your Door",
    description: "Tracked, discreet delivery anywhere in Canada — free on orders over $49.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-ink-900 py-20 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-400">How It Works</p>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">From prescription to doorstep in 4 steps</h2>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="font-display text-5xl font-bold text-white/10">{`0${index + 1}`}</span>
              <div className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

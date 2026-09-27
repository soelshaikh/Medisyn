import type { Metadata } from "next";
import Link from "next/link";
import {
  FlaskConical, FlaskRound, Sparkles, Baby, Dna, HeartPulse, Activity,
  PawPrint, Pill, Dumbbell, ShieldCheck, CheckCircle2, ArrowRight,
  Droplets, Layers, Zap, Wind, Beaker, Package, MessageCircle,
  ChevronDown, Star, Users, Clock, Truck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Custom Compounding | Medisyn Compounding Pharmacy",
  description:
    "Medisyn compounds personalized medications tailored to your unique needs — custom strength, allergen-free formulas, and hard-to-find preparations delivered across Canada.",
};

/* ─── Data ─── */
const STATS = [
  { value: "10,000+", label: "Prescriptions filled" },
  { value: "50+",     label: "Compounded formulas" },
  { value: "All",     label: "Canadian provinces" },
  { value: "PCAB",    label: "Aligned standards"  },
];

const WHY_COMPOUND = [
  {
    icon: Pill,
    title: "Commercial medication not available",
    description:
      "Certain drug concentrations or combinations have been discontinued or are on shortage. Compounding restores access to the exact formulation your doctor prescribed.",
  },
  {
    icon: ShieldCheck,
    title: "Allergies or intolerances",
    description:
      "Many commercial products contain dyes, gluten, lactose, or preservatives you can't tolerate. We formulate without those ingredients — same active drug, none of the fillers.",
  },
  {
    icon: Baby,
    title: "Pediatric or geriatric dosing",
    description:
      "Children need weight-based doses that retail pills can't provide. Seniors may need lower strengths or a liquid form. We calibrate every formulation to the individual.",
  },
  {
    icon: Sparkles,
    title: "Improved compliance",
    description:
      "A medication in a flavor kids love, a once-daily transdermal cream instead of three pills, or a lozenge instead of an injection — compliance skyrockets when the form fits the patient.",
  },
];

const SPECIALTIES = [
  {
    icon: Sparkles,
    title: "Dermatology & Anti-Aging",
    description: "Custom creams, gels, and serums for acne, rosacea, eczema, psoriasis, melasma, and anti-wrinkle therapy. We match active ingredients at concentrations your dermatologist specifies.",
    tags: ["Tretinoin", "Hydroquinone", "Niacinamide", "BHRT Topical"],
  },
  {
    icon: Baby,
    title: "Pediatric Compounding",
    description: "Accurate, weight-based doses in great-tasting liquids, chewable tablets, and flavored troches that children will actually take — including flavors like bubblegum, strawberry, and grape.",
    tags: ["Flavored Liquids", "Chewables", "Suppositories"],
  },
  {
    icon: Dna,
    title: "Hormone Therapy (BHRT)",
    description: "Bio-identical hormone replacement therapy in creams, troches, capsules, and vaginal preparations. Customized estradiol, progesterone, testosterone, and DHEA at your tested levels.",
    tags: ["Estradiol", "Progesterone", "Testosterone", "DHEA"],
  },
  {
    icon: HeartPulse,
    title: "Men's Health",
    description: "Rapid-dissolve sildenafil/tadalafil tablets, testosterone creams, and custom ED combinations your prescriber designs — discreet packaging, fast delivery.",
    tags: ["Testosterone", "Sildenafil", "Tadalafil", "Rapid-Dissolve"],
  },
  {
    icon: Activity,
    title: "Pain Management",
    description: "Transdermal pain creams combining multiple analgesics and anti-inflammatories at a single application site. Targeted relief without systemic side effects.",
    tags: ["Ketoprofen", "Gabapentin", "Lidocaine", "Transdermal"],
  },
  {
    icon: Dumbbell,
    title: "Sports & Recovery",
    description: "Recovery blends, magnesium infusions, and personalized anti-inflammatory topicals for athletes. Performance-optimized formulas designed for active lifestyles.",
    tags: ["Magnesium", "BPC-157", "Topical NSAID"],
  },
  {
    icon: PawPrint,
    title: "Veterinary Compounding",
    description: "We collaborate with veterinarians to prepare weight-appropriate, species-specific medications in forms pets accept — flavored chews, transdermal ear gels, and injectable preparations.",
    tags: ["Methimazole Transdermal", "Flavored Chews", "Equine Formulas"],
  },
  {
    icon: Pill,
    title: "Allergy-Free Formulas",
    description: "Dye-free, gluten-free, lactose-free, and preservative-free versions of common medications — and unique combinations not available commercially.",
    tags: ["Gluten-Free", "Dye-Free", "Preservative-Free", "Vegan"],
  },
];

const FORMS = [
  { icon: Droplets, title: "Oral Liquids",        desc: "Suspensions and solutions with custom flavoring and concentration for easy swallowing." },
  { icon: Layers,   title: "Capsules & Tablets",   desc: "Custom-strength capsules or rapid-dissolve tablets matched to the exact prescribed dose." },
  { icon: Zap,      title: "Transdermal Creams",   desc: "Medications absorbed through the skin for localized or systemic effect without GI side effects." },
  { icon: Wind,     title: "Nasal Sprays",         desc: "Customized intranasal sprays for sinusitis, allergy, hormone delivery, and migraine." },
  { icon: Beaker,   title: "Topical Gels",         desc: "Clear, non-greasy gels for pain, hormones, dermatology, and hair restoration." },
  { icon: Package,  title: "Suppositories",        desc: "Rectal and vaginal suppositories for pediatric dosing, hormones, and pain management." },
  { icon: FlaskRound, title: "Troches & Lozenges", desc: "Sublingual and buccal dissolving preparations for rapid systemic absorption." },
  { icon: FlaskConical, title: "Sterile Injectables", desc: "Prepared under strict sterile conditions in our ISO-compliant clean room for qualified prescriptions." },
];

const PROCESS = [
  {
    step: "01",
    icon: MessageCircle,
    title: "Pharmacist consultation",
    description: "A licensed Medisyn pharmacist reviews your prescription and discusses your health history, allergies, and preferences before any formulation begins.",
  },
  {
    step: "02",
    icon: FlaskConical,
    title: "Custom formulation",
    description: "Our team sources pharmaceutical-grade active ingredients and prepares your compound by hand in our licensed lab, adjusting strength, form, and flavor to spec.",
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Quality & potency testing",
    description: "Every batch undergoes potency verification and visual inspection before release. Beyond-use dates are assigned conservatively to guarantee freshness.",
  },
  {
    step: "04",
    icon: Truck,
    title: "Delivered to your door",
    description: "Orders ship in temperature-controlled packaging with Canada Post tracked delivery. Free shipping on orders over $49 — express options available.",
  },
];

const FAQS = [
  {
    q: "Is compounded medication covered by insurance?",
    a: "Coverage varies by plan. Many extended health benefit plans in Canada cover compounded prescriptions when dispensed by a licensed pharmacy. We provide detailed receipts to support your claim — contact us and we can advise on what information to include.",
  },
  {
    q: "How long does it take to fill a compounded prescription?",
    a: "Most compounds are ready within 2–4 business days after we receive and verify your prescription. Complex sterile preparations may require additional time. We will contact you with an expected ready date before we begin.",
  },
  {
    q: "Do I need a prescription for compounded medications?",
    a: "Yes. All compounded preparations at Medisyn require a valid prescription from a licensed Canadian healthcare provider. Your physician can fax it directly to us, or you can upload a clear photo through your patient portal.",
  },
  {
    q: "Is compounding safe?",
    a: "Absolutely. Medisyn operates under provincial pharmacy licensing and adheres to NAPRA Model Standards for pharmacy compounding. We use pharmaceutical-grade raw ingredients from audited suppliers, document every batch, and conduct quality checks before dispensing.",
  },
  {
    q: "Can you compound a medication that is on shortage?",
    a: "In many cases, yes. When an approved commercial product is temporarily unavailable or discontinued, a pharmacist can prepare an equivalent compound using the same active pharmaceutical ingredient — with Health Canada guidance in effect for shortage situations.",
  },
  {
    q: "What information do you need to start?",
    a: "A valid prescription from your healthcare provider, your date of birth for identity verification, and your preferred delivery address. If you have known allergies or past adverse reactions, please note those when you submit.",
  },
];

/* ─── Tiny FAQ accordion (client-side toggle not needed — pure CSS detail/summary) ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white px-5 transition-shadow hover:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown size={16} className="shrink-0 text-brand-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="pb-5 text-sm leading-relaxed text-slate-600">{a}</p>
    </details>
  );
}

/* ─── Page ─── */
export default function CompoundingPage() {
  return (
    <>
      {/* ── 1. Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-20 text-white">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-100">
                <FlaskConical size={12} /> Custom Compounding
              </span>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-[3.25rem]">
                Medication made<br />
                <span className="text-brand-200">exactly for you.</span>
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-brand-100">
                When commercial drugs don't fit — wrong dose, wrong form, wrong ingredients — our
                licensed compounding pharmacists build yours from scratch using pharmaceutical-grade
                ingredients.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/get-started"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50"
                >
                  Get Started <ArrowRight size={14} />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ask a Pharmacist
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm">
                  <p className="font-display text-3xl font-bold text-white">{s.value}</p>
                  <p className="mt-1 text-sm text-brand-200">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. What is compounding ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Visual */}
          <div className="relative order-2 lg:order-1">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-brand-100 to-brand-200 p-8 shadow-xl ring-1 ring-black/5">
              <div className="flex flex-col gap-4">
                {[
                  { icon: Star,    color: "bg-amber-50 text-amber-500",  label: "Pharmaceutical-grade ingredients" },
                  { icon: Users,   color: "bg-brand-50 text-brand-600",  label: "Licensed pharmacist oversight" },
                  { icon: Clock,   color: "bg-slate-50 text-slate-600",  label: "Ready in 2–4 business days" },
                  { icon: Truck,   color: "bg-green-50 text-green-600",  label: "Delivered across Canada" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-white">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                      <item.icon size={16} />
                    </div>
                    <span className="text-sm font-medium text-ink-800">{item.label}</span>
                    <CheckCircle2 size={15} className="ml-auto shrink-0 text-brand-500" />
                  </div>
                ))}
              </div>
            </div>
            {/* Floating badge */}
            <div className="absolute -right-3 -top-3 rounded-2xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-lg">
              PCAB-Aligned
            </div>
          </div>

          {/* Text */}
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">What Is Compounding?</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              The art and science of personalized medicine
            </h2>
            <p className="mt-5 leading-relaxed text-slate-600">
              Pharmaceutical compounding is the preparation of a customized medication for an individual
              patient. Unlike mass-manufactured drugs, a compounded prescription is made to order by a
              licensed pharmacist — tailored to your exact dose, form, and ingredient requirements.
            </p>
            <p className="mt-4 leading-relaxed text-slate-600">
              Compounding has existed as long as pharmacy itself, but modern techniques allow us to
              produce formulations with the same active pharmaceutical ingredients as commercial drugs,
              in formats that work better for you: a transdermal cream instead of a pill, a
              flavored liquid for a child, a combination of three drugs in one capsule.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                "Adjust strength above or below standard commercial doses",
                "Combine multiple medications into a single dosage form",
                "Eliminate inactive ingredients you're allergic to",
                "Create discontinued or short-supply formulations",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 3. Why Compound ── */}
      <section className="bg-brand-50/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Why Patients Choose Us</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              When standard medication isn't enough
            </h2>
            <p className="mt-4 text-slate-600">
              Compounding fills the gaps that mass-produced pharmaceuticals can't.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_COMPOUND.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white bg-white p-6 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <item.icon size={22} />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold leading-snug text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Specialties ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Compounding Specialties</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            Formulations for every specialty
          </h2>
          <p className="mt-4 text-slate-600">
            Our pharmacists hold training in a wide range of therapeutic areas. Whatever the clinical need,
            we have the expertise to compound it correctly.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SPECIALTIES.map((s) => (
            <div
              key={s.title}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <s.icon size={21} />
              </div>
              <h3 className="font-display text-base font-semibold text-ink-900">{s.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500 flex-1">{s.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {s.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Delivery forms ── */}
      <section className="bg-ink-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">Dosage Forms</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              We compound in any form your doctor prescribes
            </h2>
            <p className="mt-4 text-slate-400">
              The right delivery method makes all the difference in absorption, compliance, and tolerability.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FORMS.map((form) => (
              <div
                key={form.title}
                className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
                  <form.icon size={19} />
                </div>
                <h3 className="mt-3 font-display text-sm font-semibold text-white">{form.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{form.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Process ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">How It Works</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            From prescription to your door in 4 steps
          </h2>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((step, idx) => (
            <div key={step.step} className="relative flex flex-col gap-3">
              {/* Connector line */}
              {idx < PROCESS.length - 1 && (
                <div className="absolute left-[calc(50%+2rem)] top-7 hidden h-0.5 w-[calc(100%-2rem)] bg-brand-100 lg:block" />
              )}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                <step.icon size={24} />
              </div>
              <span className="font-display text-3xl font-extrabold text-brand-100">{step.step}</span>
              <h3 className="font-display text-base font-semibold text-ink-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 transition"
          >
            See the full process <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ── 7. Quality & Safety ── */}
      <section className="bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Quality & Safety</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
                Every compound meets rigorous standards
              </h2>
              <p className="mt-5 leading-relaxed text-slate-600">
                Compounding is only as good as the standards behind it. Medisyn operates under a
                provincial pharmacy licence and follows NAPRA Model Standards for sterile and
                non-sterile compounding. Our raw materials come exclusively from audited,
                pharmaceutical-grade suppliers with Certificates of Analysis on file.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  { title: "Licensed compounding lab",        desc: "Regulated by provincial pharmacy college and subject to inspection." },
                  { title: "NAPRA standards compliance",      desc: "Non-sterile and sterile preparations follow national model guidelines." },
                  { title: "Pharmaceutical-grade ingredients",desc: "USP/NF or equivalent raw materials with Certificates of Analysis." },
                  { title: "Batch documentation",             desc: "Complete compounding records retained for every prescription dispensed." },
                  { title: "Beyond-use dating",               desc: "Conservative stability windows assigned based on current literature." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-500" />
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-brand-600 p-8 text-white shadow-2xl shadow-brand-600/30">
              <FlaskConical size={36} className="text-brand-200" />
              <h3 className="mt-4 font-display text-2xl font-bold">Our commitment to you</h3>
              <p className="mt-3 leading-relaxed text-brand-100">
                Every prescription at Medisyn is reviewed by a licensed pharmacist before compounding
                begins. We verify drug-drug interactions, appropriate dosing for your weight and age,
                and compatibility of all ingredients. If anything looks off, we call you before we fill it.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Pharmacist consultation on every new compound",
                  "Allergy and interaction screening",
                  "Stability and compatibility verification",
                  "Temperature-controlled shipping",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-brand-100">
                    <CheckCircle2 size={15} className="shrink-0 text-brand-300" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/about"
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                About Our Team <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FAQ ── */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
            Common questions about compounding
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Don't see your question?{" "}
          <Link href="/contact" className="font-semibold text-brand-600 hover:underline">
            Ask a pharmacist directly →
          </Link>
        </p>
      </section>

      {/* ── 9. CTA ── */}
      <section className="bg-gradient-to-r from-brand-700 to-brand-500 py-20 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <FlaskConical size={40} className="mx-auto text-brand-200" />
          <h2 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
            Ready for medication that fits you?
          </h2>
          <p className="mt-4 text-lg text-brand-100">
            Upload your prescription and a Medisyn pharmacist will reach out to confirm your
            formulation details — usually within one business day.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold text-brand-700 shadow-lg transition hover:bg-brand-50"
            >
              Submit a Prescription <ArrowRight size={14} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Talk to a Pharmacist
            </Link>
          </div>
          <p className="mt-6 text-sm text-brand-200">
            Free shipping across Canada on orders over $49 · Licensed pharmacists · All provinces
          </p>
        </div>
      </section>
    </>
  );
}

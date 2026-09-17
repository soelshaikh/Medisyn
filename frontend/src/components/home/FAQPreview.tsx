import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import { HOME_FAQS } from "@/lib/faqs";

export default function FAQPreview() {
  return (
    <section className="bg-brand-50/60 py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Common questions</h2>
        </div>

        <div className="mt-10">
          <FAQAccordion items={HOME_FAQS} />
        </div>

        <div className="mt-8 text-center">
          <Link href="/faq" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            View all frequently asked questions →
          </Link>
        </div>
      </div>
    </section>
  );
}

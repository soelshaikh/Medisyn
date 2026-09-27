"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import FAQAccordion from "@/components/FAQAccordion";
import type { FAQItem as AccordionItem } from "@/components/FAQAccordion";
import { HOME_FAQS } from "@/lib/faqs";
import { faqsApi } from "@/api/faqs.api";

export default function FAQPreview() {
  const { data: apiFaqs, isError } = useQuery({
    queryKey: ["public-faqs"],
    queryFn:  () => faqsApi.listPublic(),
    retry:    1,
    staleTime: 5 * 60 * 1000,
  });

  /* Show first 5 published FAQs from API, or fall back to hardcoded HOME_FAQS */
  const items: AccordionItem[] =
    !isError && apiFaqs && apiFaqs.length > 0
      ? apiFaqs
          .filter((f) => f.isPublished)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .slice(0, 5)
          .map((f) => ({ question: f.question, answer: f.answer }))
      : HOME_FAQS;

  return (
    <section className="bg-brand-50/60 py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">Common questions</h2>
        </div>

        <div className="mt-10">
          <FAQAccordion items={items} />
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

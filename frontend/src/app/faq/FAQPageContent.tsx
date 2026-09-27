"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import FAQAccordion from "@/components/FAQAccordion";
import type { FAQItem as AccordionItem } from "@/components/FAQAccordion";
import { HOME_FAQS } from "@/lib/faqs";
import { faqsApi } from "@/api/faqs.api";

/* Hardcoded fallback items (used when API is unavailable or returns empty) */
const MORE_FAQS: AccordionItem[] = [
  {
    question: "What forms can compounded medications take?",
    answer:
      "We can prepare capsules, oral liquids and suspensions, topical creams and gels, suppositories, rapid-dissolve tablets, and flavored chewables — whichever format works best for you.",
  },
  {
    question: "Do I need a prescription for compounding?",
    answer:
      "Yes, compounded medications require a valid prescription from a licensed prescriber. Our pharmacists can also prescribe for certain minor ailments directly, where permitted.",
  },
  {
    question: "Can you remove specific ingredients, like dyes or gluten?",
    answer:
      "Absolutely — one of the biggest benefits of compounding is customizing the inactive ingredients. Let us know any allergies or sensitivities and we'll formulate around them.",
  },
  {
    question: "How do I pay, and do you accept insurance?",
    answer:
      "We accept major credit cards, e-transfer, and direct billing for many private insurance plans. Our team will help verify your coverage and estimate any out-of-pocket cost before we compound your medication.",
  },
  {
    question: "Is my information kept private and secure?",
    answer:
      "Yes. All prescription and personal health information is stored and transmitted securely in compliance with PHIPA and Canadian privacy regulations.",
  },
  {
    question: "Can I pick up my order in person instead of delivery?",
    answer:
      "Yes, in-store pickup is available at our Toronto location during business hours. Just select pickup at checkout or let our team know when you submit your request.",
  },
  {
    question: "Do you offer veterinary compounding for exotic pets?",
    answer:
      "We regularly compound for dogs, cats, birds, and small mammals. Reach out with your veterinarian's prescription and we'll confirm we can accommodate your pet's species and size.",
  },
  {
    question: "What if my medication needs adjusting after I start it?",
    answer:
      "Contact us any time — our pharmacists can consult with your prescriber to adjust dosage, flavor, or format based on how you're responding to treatment.",
  },
];

const FALLBACK_ITEMS: AccordionItem[] = [...HOME_FAQS, ...MORE_FAQS];

export default function FAQPageContent() {
  const { data: apiFaqs, isError } = useQuery({
    queryKey: ["public-faqs"],
    queryFn:  () => faqsApi.listPublic(),
    /* Don't block the page — use fallback while loading or on error */
    retry:    1,
    staleTime: 5 * 60 * 1000,
  });

  /* Map API items → AccordionItem shape; fall back to hardcoded if empty or errored */
  const items: AccordionItem[] =
    !isError && apiFaqs && apiFaqs.length > 0
      ? apiFaqs
          .filter((f) => f.isPublished)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((f) => ({ question: f.question, answer: f.answer }))
      : FALLBACK_ITEMS;

  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">FAQ</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink-900 sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            Can&apos;t find what you&apos;re looking for?{" "}
            <Link href="/contact" className="font-semibold text-brand-700 hover:text-brand-800">
              Ask a pharmacist directly.
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <FAQAccordion items={items} />
      </section>
    </>
  );
}

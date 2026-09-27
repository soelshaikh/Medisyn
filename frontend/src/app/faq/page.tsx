import type { Metadata } from "next";
import FAQPageContent from "./FAQPageContent";

export const metadata: Metadata = {
  title: "FAQ | Medisyn Compounding",
  description: "Answers to common questions about compounding, delivery, insurance coverage, and prescription transfers at Medisyn Compounding.",
};

export default function FAQPage() {
  return <FAQPageContent />;
}

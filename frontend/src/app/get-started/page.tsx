import type { Metadata } from "next";
import GetStartedContent from "./GetStartedContent";

export const metadata: Metadata = {
  title: "Get Started | MediSyn Compounding",
  description: "Start a new prescription, request a refill, or transfer your existing prescription to MediSyn.",
};

export default function GetStartedPage() {
  return <GetStartedContent />;
}

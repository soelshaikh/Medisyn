import Hero from "@/components/home/Hero";
import StatsBar from "@/components/home/StatsBar";
import PartnerLogos from "@/components/home/PartnerLogos";
import ServicesOverview from "@/components/home/ServicesOverview";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import Specialties from "@/components/home/Specialties";
import HowItWorks from "@/components/home/HowItWorks";
import Testimonials from "@/components/home/Testimonials";
import FAQPreview from "@/components/home/FAQPreview";
import CTASection from "@/components/home/CTASection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      <PartnerLogos />
      <ServicesOverview />
      <WhyChooseUs />
      <Specialties />
      <HowItWorks />
      <Testimonials />
      <FAQPreview />
      <CTASection />
    </>
  );
}

import { LogoSlider } from "@/components/ui/logo-slider";

const LOGOS = [
  { name: "Sun Life Financial", abbr: "SL" },
  { name: "Manulife", abbr: "ML" },
  { name: "Green Shield Canada", abbr: "GS" },
  { name: "Blue Cross", abbr: "BC" },
  { name: "Telus Health", abbr: "TH" },
  { name: "Great-West Life", abbr: "GW" },
  { name: "Ontario Drug Benefit", abbr: "OD" },
  { name: "Desjardins Insurance", abbr: "DJ" },
  { name: "Medavie Blue Cross", abbr: "MB" },
  { name: "Chamber of Commerce Group", abbr: "CC" },
];

export default function PartnerLogos() {
  return (
    <section className="border-t border-slate-100 py-10">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-7 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Accepted insurance &amp; drug benefit plans
        </p>
      </div>
      <LogoSlider logos={LOGOS} speed="normal" />
    </section>
  );
}

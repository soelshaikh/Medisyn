"use client";
import { cn } from "@/lib/utils";

interface LogoItem {
  name: string;
  abbr: string;
}

interface LogoSliderProps {
  logos: LogoItem[];
  speed?: "slow" | "normal" | "fast";
  className?: string;
}

export function LogoSlider({ logos, speed = "normal", className }: LogoSliderProps) {
  const duration = speed === "slow" ? "45s" : speed === "fast" ? "15s" : "28s";

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent" />

      <div
        className="flex w-max animate-marquee gap-6"
        style={{ "--marquee-duration": duration } as React.CSSProperties}
      >
        {[...logos, ...logos].map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className="flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-5 shadow-sm"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {logo.abbr}
            </span>
            <span className="text-sm font-semibold text-slate-600">{logo.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

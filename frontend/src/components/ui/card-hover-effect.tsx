"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HoverItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface CardHoverEffectProps {
  items: HoverItem[];
  className?: string;
}

export function CardHoverEffect({ items, className }: CardHoverEffectProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, idx) => (
        <div
          key={item.title}
          className="group relative block h-full w-full p-2"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-2xl bg-brand-50"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10 h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow group-hover:border-brand-200 group-hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              {item.icon}
            </div>
            <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface TracingBeamProps {
  children: React.ReactNode;
  className?: string;
}

export function TracingBeam({ children, className }: TracingBeamProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setSvgHeight(contentRef.current.offsetHeight);
    }
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y1 = useSpring(
    useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]),
    { stiffness: 500, damping: 90 }
  );
  const y2 = useSpring(
    useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]),
    { stiffness: 500, damping: 90 }
  );

  return (
    <motion.div ref={ref} className={cn("relative mx-auto h-full w-full max-w-4xl", className)}>
      <div className="absolute top-3 -left-4 hidden md:block md:-left-16">
        <div className="ml-[27px] flex h-4 w-4 items-center justify-center rounded-full border border-brand-300 bg-white shadow-sm">
          <div className="h-2 w-2 rounded-full bg-brand-600" />
        </div>
        <svg
          viewBox={`0 0 20 ${svgHeight}`}
          width="20"
          height={svgHeight}
          className="ml-4 block"
          aria-hidden="true"
        >
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="#E2E8F0"
            strokeOpacity="0.5"
          />
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
          />
          <defs>
            <motion.linearGradient
              id="beam-gradient"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={y1}
              y2={y2}
            >
              <stop stopColor="#1677A8" stopOpacity="0" />
              <stop stopColor="#1677A8" />
              <stop offset="0.5" stopColor="#2291D3" />
              <stop offset="1" stopColor="#47A7DF" stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
}

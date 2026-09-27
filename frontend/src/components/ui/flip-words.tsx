"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FlipWordsProps {
  words: string[];
  duration?: number;
  className?: string;
}

export function FlipWords({ words, duration = 3000, className }: FlipWordsProps) {
  const [currentWord, setCurrentWord] = useState(words[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = useCallback(() => {
    const idx = words.indexOf(currentWord);
    setCurrentWord(words[(idx + 1) % words.length]);
    setIsAnimating(true);
  }, [currentWord, words]);

  useEffect(() => {
    if (!isAnimating) {
      const timeout = setTimeout(startAnimation, duration);
      return () => clearTimeout(timeout);
    }
  }, [isAnimating, duration, startAnimation]);

  return (
    <AnimatePresence onExitComplete={() => setIsAnimating(false)} mode="wait">
      <motion.span
        key={currentWord}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn("inline-block", className)}
      >
        {currentWord}
      </motion.span>
    </AnimatePresence>
  );
}

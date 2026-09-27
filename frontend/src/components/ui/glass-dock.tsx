"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Info, HelpCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const DOCK_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/services", label: "Services", icon: Layers },
  { href: "/how-it-works", label: "How It Works", icon: Info },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/get-started", label: "Get Started", icon: ArrowRight, primary: true },
] as const;

export function GlassDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 lg:hidden">
      <div className="flex items-end gap-1 rounded-2xl border border-white/30 bg-white/75 px-2 py-2 shadow-2xl shadow-ink-900/20 backdrop-blur-xl">
        {DOCK_ITEMS.map((item) => {
          const active = pathname === item.href;
          const isPrimary = "primary" in item && item.primary;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-colors ${
                  isPrimary
                    ? "bg-brand-600 text-white"
                    : active
                      ? "bg-brand-50 text-brand-600"
                      : "text-ink-500 hover:bg-slate-100"
                }`}
                whileHover={{ scale: 1.15, y: -4 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] font-semibold leading-none">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

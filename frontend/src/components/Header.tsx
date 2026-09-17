"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Phone, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About Us" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="hidden bg-ink-900 text-white sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-xs">
          <p>
            Free Canada-wide delivery on orders over <span className="font-semibold text-brand-300">$49</span>{" "}
            &middot; Licensed pharmacists on call
          </p>
          <a href="tel:18774331234" className="flex items-center gap-1.5 font-medium">
            <Phone className="h-3.5 w-3.5" /> 1-877-433-1234
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white font-display">
            M
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-ink-900">
            Medisyn <span className="text-brand-600">Compounding</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-800 transition hover:text-brand-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/get-started?type=refill"
            className="rounded-full border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
          >
            Refill Prescription
          </Link>
          <Link
            href="/get-started"
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-ink-900 lg:hidden"
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-brand-100 bg-white px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-ink-800"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-3">
              <Link
                href="/get-started?type=refill"
                onClick={() => setOpen(false)}
                className="rounded-full border border-brand-200 px-4 py-2 text-center text-sm font-semibold text-brand-700"
              >
                Refill Prescription
              </Link>
              <Link
                href="/get-started"
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

import Link from "next/link";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import NewsletterForm from "@/components/NewsletterForm";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M13.5 21v-8.2h2.75l.41-3.2h-3.16V7.5c0-.93.26-1.56 1.6-1.56h1.7V3.1C15.99 3.03 15.05 3 13.94 3 11.63 3 10.05 4.4 10.05 7.19v2.41H7.3v3.2h2.75V21h3.45Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-ink-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white font-display">
                M
              </span>
              <span className="font-display text-xl font-bold tracking-tight text-white">
                Medisyn <span className="text-brand-400">Compounding</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              A licensed Canadian compounding pharmacy dedicated to precision medicine — custom formulations
              crafted by expert pharmacists and delivered straight to your door.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="https://facebook.com"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-brand-600"
              >
                <FacebookIcon />
              </a>
              <a
                href="https://instagram.com"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-brand-600"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">Explore</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link href="/services" className="hover:text-brand-400">Services &amp; Specialties</Link></li>
              <li><Link href="/how-it-works" className="hover:text-brand-400">How It Works</Link></li>
              <li><Link href="/about" className="hover:text-brand-400">About Us</Link></li>
              <li><Link href="/faq" className="hover:text-brand-400">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-brand-400">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">Get Started</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link href="/get-started?type=new" className="hover:text-brand-400">New Prescription</Link></li>
              <li><Link href="/get-started?type=refill" className="hover:text-brand-400">Refill Request</Link></li>
              <li><Link href="/get-started?type=transfer" className="hover:text-brand-400">Transfer Prescription</Link></li>
              <li><Link href="/contact" className="hover:text-brand-400">Ask a Pharmacist</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">Stay in Touch</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <span>4820 Bathurst Street, Unit 3, Toronto, ON M2R 1X9, Canada</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brand-400" />
                <a href="tel:18774331234">1-877-433-1234</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-brand-400" />
                <a href="mailto:care@medisyncompounding.ca">care@medisyncompounding.ca</a>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <span>Mon-Fri 8:30am–7pm · Sat 9am–5pm · Sun Closed</span>
              </li>
            </ul>
            <div className="mt-5">
              <NewsletterForm />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Medisyn Compounding Pharmacy. All rights reserved.</p>
          <p>Licensed by the Ontario College of Pharmacists · Compounded medications prepared to PCAB-aligned standards.</p>
        </div>
      </div>
    </footer>
  );
}

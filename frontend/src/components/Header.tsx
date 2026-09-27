"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ChevronDown, Search, ShoppingCart, User, LogOut,
  Phone, Mail, Printer, Menu, X, ArrowRight,
  LayoutDashboard, ClipboardList, Package,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { cartItemCount, formatPrice } from "@/api/cart.api";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/api/auth.api";

interface Child   { href: string; label: string; description?: string }
interface NavItem { label: string; href?: string; children?: Child[] }

const NAV: NavItem[] = [
  { href: "/compounding",    label: "Compounding"   },
  {
    label: "Prescription",
    children: [
      { href: "/get-started/new",      label: "New Prescription",      description: "Request delivery of a new prescription"    },
      { href: "/get-started/refill",   label: "Refill Prescription",   description: "Request a refill for existing medication"  },
      { href: "/get-started/transfer", label: "Transfer Prescription", description: "Move your Rx from another pharmacy"       },
    ],
  },
  { href: "/minor-ailments", label: "Minor Ailment" },
  { href: "/how-it-works",   label: "How It Works"  },
  {
    label: "Services",
    children: [
      { href: "/services",              label: "All Services"         },
      { href: "/compounding",           label: "Custom Compounding"   },
      { href: "/minor-ailments",        label: "Minor Ailments"       },
      { href: "/services/vaccinations", label: "Vaccinations"         },
      { href: "/contact",               label: "Consult a Pharmacist" },
    ],
  },
  { href: "/patient", label: "Patient Portal" },
];

/* ─── Animated dropdown ─── */
const dropdownVariants: Variants = {
  hidden:  { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.18, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } },
};

function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="group flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
      >
        {item.label}
        <ChevronDown
          size={13}
          className={`mt-px shrink-0 transition-transform duration-200 ${open ? "rotate-180 text-brand-600" : "text-ink-400"}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-[calc(100%+4px)] z-50 w-52 origin-top-left rounded-xl border border-ink-100 bg-white py-1.5 shadow-xl shadow-ink-900/10"
          >
            {item.children!.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                onClick={() => setOpen(false)}
                className="group/item flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-brand-50"
              >
                <span className="text-sm font-medium text-ink-800 group-hover/item:text-brand-700">
                  {c.label}
                </span>
                <ArrowRight
                  size={13}
                  className="shrink-0 text-brand-400 opacity-0 transition-all group-hover/item:translate-x-0.5 group-hover/item:opacity-100"
                />
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Search overlay ─── */
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/50 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        exit={{ y: -10, opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-xl rounded-2xl border border-ink-100 bg-white p-4 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <Search size={18} className="shrink-0 text-ink-400" />
          <input
            ref={ref}
            type="search"
            placeholder="Search medications, services…"
            className="flex-1 bg-transparent text-base text-ink-800 outline-none placeholder:text-ink-400"
          />
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800">
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
          Press <kbd className="rounded bg-ink-100 px-1.5 py-0.5 font-mono">Esc</kbd> to close
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ─── User menu (logged-in dropdown / logged-out link) ─── */
function UserMenu() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const router          = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    setOpen(false);
    router.push("/");
  }

  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/login"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-brand-50 hover:text-brand-700"
        aria-label="Sign in"
      >
        <User size={17} />
      </Link>
    );
  }

  const initials = user.fullName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials}
        {/* green online dot */}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 origin-top-right rounded-2xl border border-ink-100 bg-white py-1.5 shadow-xl shadow-ink-900/10"
          >
            {/* User info */}
            <div className="border-b border-ink-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-ink-900">{user.fullName}</p>
              <p className="truncate text-xs text-ink-400">{user.email}</p>
            </div>

            {/* Links */}
            <Link
              href="/patient"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <LayoutDashboard size={15} className="shrink-0 text-ink-400" />
              Patient Portal
            </Link>
            <Link
              href="/patient/prescriptions"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <ClipboardList size={15} className="shrink-0 text-ink-400" />
              My Prescriptions
            </Link>
            <Link
              href="/patient/orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <Package size={15} className="shrink-0 text-ink-400" />
              My Orders
            </Link>

            {/* Logout */}
            <div className="mt-1 border-t border-ink-100 pt-1">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={15} className="shrink-0" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Mobile drawer ─── */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    onClose();
    router.push("/");
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <span className="font-display text-lg font-bold text-ink-900">Menu</span>
              <button onClick={onClose} className="rounded-full p-1.5 text-ink-500 hover:bg-ink-100">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {NAV.map((item) =>
                item.href ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="block px-5 py-3 text-sm font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label}>
                    <p className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      {item.label}
                    </p>
                    {item.children!.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={onClose}
                        className="block px-8 py-2.5 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )
              )}
            </nav>

            <div className="space-y-2.5 border-t border-ink-100 p-5">
              {isAuthenticated && user && (
                <div className="mb-3 rounded-xl bg-brand-50 px-4 py-3">
                  <p className="text-xs font-semibold text-brand-800">Signed in as</p>
                  <p className="truncate text-sm font-bold text-ink-900">{user.fullName}</p>
                </div>
              )}
              <Link
                href="/shop"
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Shop Now
              </Link>
              {isAuthenticated ? (
                <>
                  <Link
                    href="/patient"
                    onClick={onClose}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-200 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    <LayoutDashboard size={14} /> Patient Portal
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/get-started"
                  onClick={onClose}
                  className="flex w-full items-center justify-center rounded-full border border-brand-200 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Get Started
                </Link>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Main header ─── */
export default function Header() {
  const pathname              = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const { data: cart } = useCart();
  const itemCount = cartItemCount(cart);
  const cartTotal = cart?.total ?? 0;

  /* close search on Esc */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full">

        {/* ── Top utility bar ── */}
        <div className="bg-brand-700 text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs sm:px-6">
            <p className="hidden sm:block">
              Free shipping · Ontario orders over <strong>$49</strong> · Other provinces over <strong>$99</strong>
            </p>
            <p className="sm:hidden text-xs">Free shipping on orders over $49</p>

            <div className="flex items-center gap-3">
              <Link
                href="/get-started"
                className="whitespace-nowrap rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                Get started
              </Link>
              <a href="mailto:rx@medisyncompounding.ca" className="hidden items-center gap-1 transition hover:text-brand-200 md:flex whitespace-nowrap">
                <Mail size={11} /> rx@medisyncompounding.ca
              </a>
              <a href="tel:14165551234" className="hidden items-center gap-1 transition hover:text-brand-200 sm:flex whitespace-nowrap">
                <Phone size={11} /> 416-555-1234
              </a>
              <a href="#" className="hidden items-center gap-1 transition hover:text-brand-200 lg:flex whitespace-nowrap">
                <Printer size={11} /> 416-555-0700
              </a>
            </div>
          </div>
        </div>

        {/* ── Main nav bar ── */}
        <div className="border-b border-ink-100 bg-white shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">

            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center gap-2.5 mr-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-base font-bold text-white shadow-sm">
                M
              </span>
              <div className="hidden sm:block">
                <p className="whitespace-nowrap font-display text-[15px] font-bold leading-none tracking-tight text-ink-900">
                  Medisyn <span className="text-brand-600">Compounding</span>
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                  Pharmacy
                </p>
              </div>
            </Link>

            {/* Desktop nav — fills remaining space */}
            <nav
              className="hidden flex-1 items-center xl:flex"
              onMouseLeave={() => setHoveredNav(null)}
            >
              {NAV.map((item) => {
                if (item.children) {
                  return <NavDropdown key={item.label} item={item} />;
                }
                const active = pathname === item.href;
                return (
                  <div
                    key={item.href}
                    className="relative"
                    onMouseEnter={() => setHoveredNav(item.href!)}
                  >
                    {/* spotlight pill */}
                    <AnimatePresence>
                      {hoveredNav === item.href && (
                        <motion.span
                          layoutId="nav-spotlight"
                          className="absolute inset-0 rounded-md bg-brand-50"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </AnimatePresence>
                    <Link
                      href={item.href!}
                      className={[
                        "relative z-10 block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active ? "text-brand-700 font-semibold" : "text-ink-700 hover:text-brand-700",
                      ].join(" ")}
                    >
                      {item.label}
                      {/* active underline */}
                      {active && (
                        <motion.span
                          layoutId="nav-underline"
                          className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brand-600"
                        />
                      )}
                    </Link>
                  </div>
                );
              })}
            </nav>

            {/* Spacer on non-xl */}
            <div className="flex-1 xl:hidden" />

            {/* Right utilities */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Shop Now */}
              <Link
                href="/shop"
                className="hidden whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 lg:inline-flex items-center"
              >
                Shop Now
              </Link>

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-brand-50 hover:text-brand-700"
                aria-label="Search"
              >
                <Search size={17} />
              </button>

              {/* User */}
              <UserMenu />

              {/* Cart */}
              <Link
                href="/cart"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                aria-label="Shopping cart"
              >
                <ShoppingCart size={15} className="shrink-0" />
                <span className="hidden text-xs sm:inline">{formatPrice(cartTotal)}</span>
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              </Link>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-600 transition hover:bg-brand-50 xl:hidden"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search modal */}
      <AnimatePresence>
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

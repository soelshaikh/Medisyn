"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  title:       string;
  subtitle:    string;
  sidebarTitle: string;
  sidebarBody:  ReactNode;
  children:    ReactNode;
}

export default function RxPageShell({ title, subtitle, sidebarTitle, sidebarBody, children }: Props) {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-rose-50 via-pink-50 to-brand-50">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-14 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col justify-center">
            <Link
              href="/get-started"
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-800 font-medium w-fit"
            >
              <ArrowLeft size={14} /> Prescription Services
            </Link>
            <h1 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
            <p className="mt-3 text-sm text-slate-500">
              Questions? Call us at{" "}
              <a href="tel:18774331234" className="font-semibold text-rose-700 hover:underline">
                1-877-433-1234
              </a>
              {" or fax your prescription to "}
              <span className="font-semibold text-rose-700">416-555-0700</span>
            </p>
          </div>

          {/* Pharmacist illustration placeholder */}
          <div className="hidden lg:flex items-end justify-center">
            <div className="flex h-52 w-44 items-end justify-center rounded-t-full bg-gradient-to-t from-rose-200 to-rose-100 shadow-inner">
              <div className="mb-4 h-28 w-28 rounded-full bg-gradient-to-br from-rose-300 to-pink-200 flex items-center justify-center">
                <span className="font-display text-4xl">💊</span>
              </div>
            </div>
          </div>
        </div>

        {/* decorative circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-rose-100/60" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-pink-100/40" />
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">

          {/* Form */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {children}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">
                {sidebarTitle}
              </p>
              <div className="text-sm leading-relaxed text-slate-600 space-y-3">
                {sidebarBody}
              </div>
            </div>

            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-5">
              <p className="text-sm font-semibold text-rose-800 mb-1">Need help?</p>
              <p className="text-xs text-rose-700 leading-relaxed">
                Our pharmacists are available Mon–Fri 8:30am–7pm and Sat 9am–5pm.
              </p>
              <Link
                href="/contact"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900"
              >
                Contact a pharmacist →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

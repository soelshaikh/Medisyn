"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, Clock, ShieldCheck, CheckCircle, Loader2,
  AlertTriangle, Info, UserCheck, CalendarDays, ChevronRight, CalendarX2,
} from "lucide-react";
import { appointmentsApi, type AvailableSlot, type VaccineService } from "@/api/appointments.api";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAuthStore } from "@/stores/authStore";
import { fmt12h } from "@/lib/utils";
import { format } from "date-fns";
import { inputClass, labelClass } from "@/lib/ui";

/* ── No-slot interest form (sidebar variant) ── */
function NoSlotInterestForm({ service }: { service: VaccineService }) {
  const { user } = useAuthStore();
  const [terms,          setTerms]          = useState(false);
  const [success,        setSuccess]        = useState(false);
  const [error,          setError]          = useState("");
  const [preferredDate,  setPreferredDate]  = useState<Date | undefined>(undefined);
  const [preferredTime,  setPreferredTime]  = useState("");

  const mutation = useMutation({
    mutationFn: appointmentsApi.submitInterest,
    onSuccess: () => setSuccess(true),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Submission failed. Please try again.");
    },
  });

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-6 text-center space-y-2">
        <CheckCircle className="mx-auto h-7 w-7 text-green-500" />
        <p className="text-sm font-semibold text-green-800">Request submitted!</p>
        <p className="text-xs text-green-700">We'll reach out to schedule your appointment as soon as slots open up.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-center">
          <CalendarX2 className="mx-auto h-6 w-6 text-amber-500 mb-1.5" />
          <p className="text-sm font-semibold text-amber-800">No slots available</p>
          <p className="text-xs text-amber-600 mt-0.5">Sign in to register your interest and we'll contact you when slots open.</p>
        </div>
        <Link
          href={`/login?redirect=/services/vaccinations/${service.slug}`}
          className="block w-full rounded-full bg-brand-600 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700 transition"
        >
          Log in to register interest
        </Link>
        <Link
          href="/register"
          className="block w-full rounded-full border border-slate-200 py-3 text-center text-sm font-semibold text-ink-900 hover:border-brand-300 transition"
        >
          Create a free account
        </Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      firstName:          fd.get("firstName") as string,
      lastName:           (fd.get("lastName") as string) || undefined,
      email:              fd.get("email") as string,
      phone:              fd.get("phone") as string,
      vaccineServiceName: service.name,
      preferredDate:      preferredDate ? format(preferredDate, "yyyy-MM-dd") : undefined,
      preferredTime:      preferredTime || undefined,
      notes:              (fd.get("notes") as string) || undefined,
      termsAccepted:      terms,
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
        <CalendarX2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">No slots available right now</p>
          <p className="text-xs text-amber-600 mt-0.5">Fill in your details and we'll contact you when a slot opens.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>First name <span className="text-red-500">*</span></label>
            <input
              required
              name="firstName"
              defaultValue={user.fullName?.split(" ")[0] ?? ""}
              className={inputClass}
              placeholder="First"
            />
          </div>
          <div>
            <label className={labelClass}>Last name</label>
            <input
              name="lastName"
              defaultValue={user.fullName?.split(" ").slice(1).join(" ") ?? ""}
              className={inputClass}
              placeholder="Last"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email <span className="text-red-500">*</span></label>
          <input
            required
            type="email"
            name="email"
            defaultValue={user.email ?? ""}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
          <input
            required
            type="tel"
            name="phone"
            className={inputClass}
            placeholder="e.g. 416-555-0100"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            label="Preferred date"
            value={preferredDate}
            onChange={setPreferredDate}
            placeholder="Pick a date"
            minDate={new Date()}
          />
          <Select
            label="Time slot"
            value={preferredTime}
            onChange={setPreferredTime}
            placeholder="Any"
            options={[
              { value: "morning",   label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
              { value: "evening",   label: "Evening" },
            ]}
          />
        </div>

        <div>
          <label className={labelClass}>Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            rows={2}
            name="notes"
            className={inputClass}
            placeholder="Allergies, health history…"
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span className="text-xs text-slate-600 leading-snug">I consent to being contacted by MediSyn regarding this appointment.</span>
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !terms}
          className="w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? "Submitting…" : "Notify Me When Available"}
        </button>
      </form>
    </div>
  );
}

export default function VaccineDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [patientNotes, setPatientNotes] = useState("");
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState(false);

  const { data: service, isLoading: loadingService, isError } = useQuery({
    queryKey: ["vaccine-service", slug],
    queryFn:  () => appointmentsApi.getServiceBySlug(slug),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["appointment-slots", "available", service?._id],
    queryFn:  () => appointmentsApi.listAvailableSlots(service!._id),
    enabled:  !!service,
    staleTime: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: appointmentsApi.book,
    onSuccess: () => {
      setSuccess(true);
      setSelectedSlot(null);
      setPatientNotes("");
      void qc.invalidateQueries({ queryKey: ["appointments", "my"] });
      void qc.invalidateQueries({ queryKey: ["appointment-slots", "available"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Booking failed. The slot may be full — please try another.");
    },
  });

  function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !service) return;
    setError("");
    const svcId = typeof selectedSlot.vaccineServiceId === "object"
      ? (selectedSlot.vaccineServiceId as { _id: string })._id
      : selectedSlot.vaccineServiceId;
    mutation.mutate({ slotId: selectedSlot._id, vaccineServiceId: svcId, patientNotes: patientNotes || undefined });
  }

  /* ── Loading ── */
  if (loadingService) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  /* ── Error / not found ── */
  if (isError || !service) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-400 mb-4" />
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-2">Vaccine not found</h1>
        <p className="text-slate-500 mb-6">This vaccine may no longer be available.</p>
        <Link href="/services/vaccinations" className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition">
          View all vaccines
        </Link>
      </div>
    );
  }

  const openSlots = slots.filter((s) => !(s.isFullyBooked && s.capacityType === "strict"));

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Breadcrumb ── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/services/vaccinations" className="hover:text-brand-600 transition flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> All vaccines
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-700 font-medium">{service.name}</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:items-start">

          {/* ══════════════════════════════════════════
              LEFT COLUMN — Vaccine info
          ══════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* Vaccine identity card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Accent stripe + title row */}
              <div className="flex items-start gap-5 p-6 border-b border-slate-100">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 border border-brand-100 text-brand-600">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-2xl font-bold text-ink-900 leading-tight sm:text-3xl">
                    {service.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {service.durationMinutes && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        <Clock className="h-3 w-3" /> {service.durationMinutes} min
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                      <UserCheck className="h-3 w-3" /> Licensed pharmacist
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {service.description && (
                <div className="px-6 py-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">About this vaccine</p>
                  <p className="text-slate-700 leading-relaxed">{service.description}</p>
                </div>
              )}
            </div>

            {/* Eligibility card */}
            {service.eligibilityNotes && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">Eligibility requirements</p>
                  <p className="text-sm text-blue-700 leading-relaxed">{service.eligibilityNotes}</p>
                </div>
              </div>
            )}

            {/* What to expect card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <p className="text-sm font-semibold text-ink-900 mb-4">What to expect</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {service.durationMinutes && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <Clock className="h-5 w-5 text-brand-500 mb-2" />
                    <p className="text-xs text-slate-500 mb-0.5">Appointment</p>
                    <p className="text-sm font-semibold text-ink-900">{service.durationMinutes} minutes</p>
                  </div>
                )}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <UserCheck className="h-5 w-5 text-brand-500 mb-2" />
                  <p className="text-xs text-slate-500 mb-0.5">Administered by</p>
                  <p className="text-sm font-semibold text-ink-900">Licensed pharmacist</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <CalendarDays className="h-5 w-5 text-brand-500 mb-2" />
                  <p className="text-xs text-slate-500 mb-0.5">Availability</p>
                  <p className={["text-sm font-semibold", openSlots.length > 0 ? "text-green-700" : "text-slate-500"].join(" ")}>
                    {loadingSlots ? "…" : openSlots.length > 0 ? `${openSlots.length} slot${openSlots.length !== 1 ? "s" : ""} open` : "Check back soon"}
                  </p>
                </div>
              </div>
            </div>

            {/* Help card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-ink-900 text-sm">Have questions?</p>
                <p className="text-sm text-slate-500 mt-0.5">Our pharmacists can help determine if this vaccine is right for you.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href="/patient/ask-a-pharmacist" className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition whitespace-nowrap">
                  Ask a Pharmacist
                </Link>
                <Link href="/contact" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-ink-900 hover:border-brand-300 transition whitespace-nowrap">
                  Contact Us
                </Link>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════
              RIGHT COLUMN — Booking widget (sticky)
          ══════════════════════════════════════════ */}
          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

              {/* Widget header */}
              <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900">Book an appointment</p>
                  <p className="text-xs text-slate-500 mt-0.5">Select an available time slot</p>
                </div>
                {!loadingSlots && openSlots.length > 0 && (
                  <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-700">
                    {openSlots.length} open
                  </span>
                )}
              </div>

              {/* Slot picker */}
              <div className="p-4">
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                  </div>
                ) : slots.length === 0 ? (
                  <NoSlotInterestForm service={service} />
                ) : (
                  <div className="space-y-2">
                    {slots.map((slot) => {
                      const full   = slot.isFullyBooked && slot.capacityType === "strict";
                      const picked = selectedSlot?._id === slot._id;
                      return (
                        <button
                          key={slot._id}
                          type="button"
                          disabled={full}
                          onClick={() => { setSelectedSlot(picked ? null : slot); setError(""); setSuccess(false); }}
                          className={[
                            "w-full rounded-xl border px-4 py-3 text-left transition-all duration-150 flex items-center justify-between gap-3",
                            picked
                              ? "border-brand-500 bg-brand-50 ring-2 ring-brand-400/30"
                              : full
                              ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
                              : "border-slate-200 hover:border-brand-300 hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="min-w-0">
                            <p className={["text-sm font-semibold leading-tight", picked ? "text-brand-800" : "text-ink-900"].join(" ")}>
                              {new Date(slot.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                            </p>
                            <p className={["text-xs mt-0.5", picked ? "text-brand-600" : "text-slate-500"].join(" ")}>
                              {fmt12h(slot.startTime)} – {fmt12h(slot.endTime)}
                            </p>
                          </div>
                          <span className={[
                            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            picked
                              ? "bg-brand-100 text-brand-700"
                              : full
                              ? "bg-slate-100 text-slate-400"
                              : slot.capacityType === "strict"
                              ? "bg-green-50 text-green-700"
                              : "bg-teal-50 text-teal-700",
                          ].join(" ")}>
                            {full
                              ? "Full"
                              : picked
                              ? "Selected"
                              : slot.capacityType === "strict"
                              ? `${slot.spotsLeft} left`
                              : "Open"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Confirm / Auth section */}
              {selectedSlot && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                  {/* Selected slot recap */}
                  <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 mb-4">
                    <p className="text-xs font-semibold text-brand-700 mb-0.5">Your selection</p>
                    <p className="text-sm font-bold text-brand-900">
                      {new Date(selectedSlot.date).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <p className="text-xs text-brand-700">{fmt12h(selectedSlot.startTime)} – {fmt12h(selectedSlot.endTime)}</p>
                  </div>

                  {user ? (
                    success ? (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 flex gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">Booked!</p>
                          <p className="text-xs text-green-700 mt-0.5">
                            View it in your{" "}
                            <Link href="/patient/appointments" className="font-semibold underline">Patient Portal</Link>.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleBook} className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-ink-900 mb-1">
                            Notes for pharmacist <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={patientNotes}
                            onChange={(e) => setPatientNotes(e.target.value)}
                            className={inputClass}
                            placeholder="Allergies, health history…"
                          />
                        </div>
                        {error && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">{error}</p>
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={mutation.isPending}
                          className="w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                        >
                          {mutation.isPending ? "Booking…" : "Confirm Appointment"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(null)}
                          className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition py-1"
                        >
                          Choose a different slot
                        </button>
                      </form>
                    )
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 text-center">Sign in to complete your booking</p>
                      <Link
                        href={`/login?redirect=/services/vaccinations/${slug}`}
                        className="block w-full rounded-full bg-brand-600 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700 transition"
                      >
                        Log in to book
                      </Link>
                      <Link
                        href="/register"
                        className="block w-full rounded-full border border-slate-200 py-3 text-center text-sm font-semibold text-ink-900 hover:border-brand-300 transition"
                      >
                        Create a free account
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

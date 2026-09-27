"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi, type AvailableSlot } from "@/api/appointments.api";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { inputClass, labelClass } from "@/lib/ui";
import { fmt12h } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarX2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

/* ── No-slot fallback form ── */
function NoSlotForm({
  vaccineServiceName,
  services,
  onSuccess,
}: {
  vaccineServiceName: string;
  services: { _id: string; name: string }[];
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [vaccineName,    setVaccineName]    = useState(vaccineServiceName);
  const [error,          setError]          = useState("");
  const [terms,          setTerms]          = useState(false);
  const [preferredDate,  setPreferredDate]  = useState<Date | undefined>(undefined);
  const [preferredTime,  setPreferredTime]  = useState("");

  const mutation = useMutation({
    mutationFn: appointmentsApi.submitInterest,
    onSuccess,
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Submission failed. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    mutation.mutate({
      firstName:          fd.get("firstName") as string,
      lastName:           (fd.get("lastName") as string) || undefined,
      email:              fd.get("email") as string,
      phone:              fd.get("phone") as string,
      vaccineServiceName: vaccineName || undefined,
      preferredDate:      preferredDate ? format(preferredDate, "yyyy-MM-dd") : undefined,
      preferredTime:      preferredTime || undefined,
      notes:              (fd.get("notes") as string) || undefined,
      termsAccepted:      terms,
    });
  }

  return (
    <div className="space-y-5">
      {/* No-slots notice */}
      <div className="flex flex-col items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-6 py-5 text-center">
        <CalendarX2 className="h-8 w-8 text-amber-500" />
        <p className="font-semibold text-amber-800">No slots available</p>
        <p className="text-sm text-amber-600">Please check back later or fill the form below and we'll contact you.</p>
      </div>

      {/* Fallback booking request form */}
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-ink-900">Book Your Vaccine Appointment</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>First name <span className="text-red-500">*</span></label>
            <input
              required
              name="firstName"
              defaultValue={user?.fullName?.split(" ")[0] ?? ""}
              className={inputClass}
              placeholder="First name"
            />
          </div>
          <div>
            <label className={labelClass}>Last name</label>
            <input
              name="lastName"
              defaultValue={user?.fullName?.split(" ").slice(1).join(" ") ?? ""}
              className={inputClass}
              placeholder="Last name"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Email <span className="text-red-500">*</span></label>
            <input
              required
              type="email"
              name="email"
              defaultValue={user?.email ?? ""}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className={labelClass}>Phone number <span className="text-red-500">*</span></label>
            <input
              required
              type="tel"
              name="phone"
              className={inputClass}
              placeholder="e.g. 416-555-0100"
            />
          </div>
        </div>

        <Select
          label="Select Vaccine"
          value={vaccineName}
          onChange={setVaccineName}
          placeholder="Select One…"
          options={services.map((s) => ({ value: s.name, label: s.name }))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder="Any time"
            options={[
              { value: "morning",   label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
              { value: "evening",   label: "Evening" },
            ]}
          />
        </div>

        <div>
          <label className={labelClass}>Notes <span className="text-slate-400 font-normal">(optional for special requests)</span></label>
          <textarea
            rows={3}
            name="notes"
            className={inputClass}
            placeholder="Allergies, health conditions, any special requests…"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span className="text-sm text-slate-600">I accept the terms and consent to being contacted by MediSyn.</span>
        </label>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending || !terms}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? "Submitting…" : "Book Appointment"}
        </button>
      </form>
    </div>
  );
}

/* ── Main appointment form ── */
export default function AppointmentForm() {
  const qc = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedSlot,      setSelectedSlot]      = useState<AvailableSlot | null>(null);
  const [error,             setError]             = useState("");
  const [success,           setSuccess]           = useState(false);
  const [interestSuccess,   setInterestSuccess]   = useState(false);

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["vaccine-services"],
    queryFn:  appointmentsApi.listServices,
    staleTime: 10 * 60 * 1000,
  });

  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["appointment-slots", "available", selectedServiceId],
    queryFn:  () => appointmentsApi.listAvailableSlots(selectedServiceId || undefined),
    enabled:  !!selectedServiceId,
    staleTime: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: appointmentsApi.book,
    onSuccess: () => {
      setSuccess(true);
      setSelectedSlot(null);
      void qc.invalidateQueries({ queryKey: ["appointments", "my"] });
      void qc.invalidateQueries({ queryKey: ["appointment-slots", "available"] });
      setTimeout(() => setSuccess(false), 5000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Booking failed. The slot may be full — please try another.");
    },
  });

  function handleBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot) return;
    setError("");
    const fd  = new FormData(e.currentTarget);
    const svcId = typeof selectedSlot.vaccineServiceId === "object"
      ? (selectedSlot.vaccineServiceId as { _id: string })._id
      : selectedSlot.vaccineServiceId;
    mutation.mutate({
      slotId:           selectedSlot._id,
      vaccineServiceId: svcId,
      patientNotes:     (fd.get("patientNotes") as string) || undefined,
    });
  }

  const selectedServiceName = services.find((s) => s._id === selectedServiceId)?.name ?? "";
  const noSlotsAvailable    = !!selectedServiceId && !loadingSlots && slots.length === 0;

  if (interestSuccess) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-semibold text-green-800">Request submitted!</p>
        <p className="mt-1 text-sm text-green-700">We'll reach out to schedule your appointment as soon as slots become available.</p>
        <button
          onClick={() => { setInterestSuccess(false); setSelectedServiceId(""); }}
          className="mt-4 text-sm text-brand-600 underline hover:text-brand-700"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Step 1 — choose service */}
      <Select
        label="Vaccine / Service"
        value={selectedServiceId}
        onChange={(v) => { setSelectedServiceId(v); setSelectedSlot(null); setInterestSuccess(false); }}
        placeholder={loadingServices ? "Loading services…" : "Select a service"}
        disabled={loadingServices}
        options={services.map((s) => ({ value: s._id, label: s.name }))}
      />

      {/* Step 2 — slots OR fallback form */}
      {selectedServiceId && (
        noSlotsAvailable ? (
          <NoSlotForm
            vaccineServiceName={selectedServiceName}
            services={services}
            onSuccess={() => setInterestSuccess(true)}
          />
        ) : (
          <div>
            <label className={labelClass}>Available slots</label>
            {loadingSlots ? (
              <p className="text-sm text-slate-500">Loading available slots…</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {slots.map((slot) => {
                  const full = slot.isFullyBooked && slot.capacityType === "strict";
                  return (
                    <button
                      key={slot._id}
                      type="button"
                      disabled={full}
                      onClick={() => setSelectedSlot(selectedSlot?._id === slot._id ? null : slot)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        selectedSlot?._id === slot._id
                          ? "border-brand-500 bg-brand-50 text-brand-900"
                          : full
                          ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                          : "border-slate-200 hover:border-brand-300"
                      }`}
                    >
                      <p className="font-semibold">
                        {new Date(slot.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <p className="text-slate-500">{fmt12h(slot.startTime)} – {fmt12h(slot.endTime)}</p>
                      {full ? (
                        <p className="mt-1 text-xs text-red-500">Fully booked</p>
                      ) : (
                        <p className="mt-1 text-xs text-green-600">
                          {slot.capacityType === "strict"
                            ? `${slot.spotsLeft} spot${slot.spotsLeft !== 1 ? "s" : ""} left`
                            : "Open capacity"}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* Step 3 — confirm slot booking */}
      {selectedSlot && (
        <form onSubmit={handleBook} className="space-y-4 rounded-xl bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-900">
            Booking:{" "}
            {new Date(selectedSlot.date).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}{" "}
            at {fmt12h(selectedSlot.startTime)}
          </p>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea rows={2} name="patientNotes" className={inputClass} placeholder="Allergies, relevant health history…" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {mutation.isPending ? "Booking…" : "Confirm Booking"}
          </button>
        </form>
      )}

      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Appointment booked! A MediSyn team member will confirm your appointment.
        </p>
      )}
    </div>
  );
}

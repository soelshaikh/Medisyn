"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { prescriptionsApi } from "@/api/prescriptions.api";
import RxPageShell from "../RxPageShell";
import { inputClass, labelClass } from "@/lib/ui";

export default function NewPrescriptionPage() {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const qc = useQueryClient();

  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login?redirect=/get-started/new");
  }, [_hasHydrated, isAuthenticated, router]);

  const mutation = useMutation({
    mutationFn: () =>
      prescriptionsApi.create({
        requestType:     "new_delivery",
        medicationName:  "New Prescription — Delivery Request",
        deliveryAddress: address,
        notes:           message,
      }),
    onSuccess: () => {
      setSuccess(true);
      setPhone(""); setAddress(""); setMessage("");
      void qc.invalidateQueries({ queryKey: ["prescriptions", "my"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to submit. Please try again.");
    },
  });

  if (!_hasHydrated || !isAuthenticated || !user) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <RxPageShell
      title="Prescription Delivery"
      subtitle="We offer the same day free home delivery as well as pick up of prescriptions. Fill out the form below or give us a call."
      sidebarTitle="Save your time"
      sidebarBody={
        <>
          <p>
            Transfer your prescriptions to us and start online refills with free delivery —
            straight to your door across Ontario and beyond.
          </p>
          <p>
            You can transfer an individual prescription or your entire file with just a few simple clicks.
          </p>
          <a href="/get-started/transfer" className="mt-1 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900">
            Transfer prescriptions →
          </a>
        </>
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <CheckCircle2 size={48} className="text-green-500" />
          <h2 className="font-display text-xl font-bold text-ink-900">Request Submitted!</h2>
          <p className="text-sm text-slate-600 max-w-sm">
            Our pharmacy team will review your delivery request and contact you shortly.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-2 rounded-full border border-brand-200 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Submit another request
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); setError(""); mutation.mutate(); }}
          className="space-y-5 p-6"
        >
          <div className="border-b border-slate-100 pb-4 mb-1">
            <h2 className="font-display text-base font-semibold text-ink-900">Delivery Request Form</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your account details are pre-filled below.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                className={`${inputClass} bg-slate-50 cursor-not-allowed`}
                value={user.fullName}
                readOnly
              />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                className={`${inputClass} bg-slate-50 cursor-not-allowed`}
                value={user.email}
                readOnly
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              className={inputClass}
              type="tel"
              placeholder="(416) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Delivery Address *</label>
            <input
              required
              className={inputClass}
              placeholder="123 Main Street, Toronto, ON M1A 2B3"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Message / Special Instructions</label>
            <textarea
              rows={4}
              className={inputClass}
              placeholder="Include your doctor's name, prescription details, or any special instructions…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !address.trim()}
            className="flex items-center gap-2 rounded-full bg-brand-600 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {mutation.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      )}
    </RxPageShell>
  );
}

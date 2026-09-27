"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { prescriptionsApi } from "@/api/prescriptions.api";
import RxPageShell from "../RxPageShell";
import { inputClass, labelClass } from "@/lib/ui";

export default function TransferPage() {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const qc = useQueryClient();

  const [dob,           setDob]           = useState("");
  const [phone,         setPhone]         = useState("");
  const [prevPharmacy,  setPrevPharmacy]  = useState("");
  const [prevPhone,     setPrevPhone]     = useState("");
  const [prevRx,        setPrevRx]        = useState("");
  const [message,       setMessage]       = useState("");
  const [transferAll,   setTransferAll]   = useState(false);
  const [agreeTerms,    setAgreeTerms]    = useState(false);
  const [agreePrivacy,  setAgreePrivacy]  = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [error,         setError]         = useState("");

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login?redirect=/get-started/transfer");
  }, [_hasHydrated, isAuthenticated, router]);

  const mutation = useMutation({
    mutationFn: () =>
      prescriptionsApi.create({
        requestType:           "transfer",
        medicationName:        "Transfer Request",
        prescriptionNumber:    prevRx,
        dateOfBirth:           dob,
        previousPharmacyName:  prevPharmacy,
        previousPharmacyPhone: prevPhone,
        transferAll,
        notes:                 message,
      }),
    onSuccess: () => {
      setSuccess(true);
      setDob(""); setPhone(""); setPrevPharmacy(""); setPrevPhone("");
      setPrevRx(""); setMessage(""); setTransferAll(false);
      setAgreeTerms(false); setAgreePrivacy(false);
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
      title="Transfer Prescriptions"
      subtitle="Please use this form to transfer your prescription(s) to us. We'll handle the process with your current pharmacy."
      sidebarTitle="Changing pharmacies has never been easier!"
      sidebarBody={
        <>
          <p>
            With our hassle-free process, you can transfer an individual prescription or your
            entire file with just a few simple clicks.
          </p>
          <p>
            We contact your previous pharmacy on your behalf and take care of all the paperwork
            — all you need to do is fill out the form.
          </p>
          <p className="font-medium text-slate-700 mt-2">
            Check "All Medication Transfer" to move your complete prescription file to MediSyn.
          </p>
        </>
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <CheckCircle2 size={48} className="text-green-500" />
          <h2 className="font-display text-xl font-bold text-ink-900">Transfer Request Submitted!</h2>
          <p className="text-sm text-slate-600 max-w-sm">
            Our team will contact your previous pharmacy and reach out to you once the transfer is complete.
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
            <h2 className="font-display text-base font-semibold text-ink-900">Transfer Request Form</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your account details are pre-filled below.</p>
          </div>

          {/* Personal info */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full Name</label>
              <input className={`${inputClass} bg-slate-50 cursor-not-allowed`} value={user.fullName} readOnly />
            </div>
            <div>
              <label className={labelClass}>Date of Birth *</label>
              <input
                required
                type="date"
                className={inputClass}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Email Address</label>
              <input className={`${inputClass} bg-slate-50 cursor-not-allowed`} value={user.email} readOnly />
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
          </div>

          {/* Previous pharmacy */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Previous Pharmacy Name *</label>
              <input
                required
                className={inputClass}
                placeholder="e.g. Shoppers Drug Mart"
                value={prevPharmacy}
                onChange={(e) => setPrevPharmacy(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Previous Pharmacy Phone</label>
              <input
                className={inputClass}
                type="tel"
                placeholder="(416) 555-0200"
                value={prevPhone}
                onChange={(e) => setPrevPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Previous Prescription Number</label>
            <input
              className={inputClass}
              placeholder="Enter your previous prescription number"
              value={prevRx}
              onChange={(e) => setPrevRx(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Message (optional)</label>
            <textarea
              rows={3}
              className={inputClass}
              placeholder="Any additional notes or instructions…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={transferAll}
                onChange={(e) => setTransferAll(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-brand-600"
              />
              <span className="text-sm font-medium text-slate-700">
                All Medication Transfer — transfer my complete prescription file to MediSyn
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-brand-600"
              />
              <span className="text-sm text-slate-600">
                I have read and I agree with{" "}
                <a href="/terms" className="font-semibold text-brand-700 hover:underline">terms and conditions</a>.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-brand-600"
              />
              <span className="text-sm text-slate-600">
                I have read and I agree with{" "}
                <a href="/privacy" className="font-semibold text-brand-700 hover:underline">privacy policy</a>.
              </span>
            </label>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !dob || !prevPharmacy || !agreeTerms || !agreePrivacy}
            className="flex items-center gap-2 rounded-full bg-brand-600 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {mutation.isPending ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}
    </RxPageShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { prescriptionsApi } from "@/api/prescriptions.api";
import RxPageShell from "../RxPageShell";
import { inputClass, labelClass } from "@/lib/ui";

export default function RefillPage() {
  const router = useRouter();
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const qc = useQueryClient();

  const [phone,        setPhone]        = useState("");
  const [rxNumbers,    setRxNumbers]    = useState(["", "", ""]);
  const [message,      setMessage]      = useState("");
  const [agreeTerms,   setAgreeTerms]   = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) router.replace("/login?redirect=/get-started/refill");
  }, [_hasHydrated, isAuthenticated, router]);

  function updateRx(i: number, val: string) {
    setRxNumbers((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  }
  function addRx() {
    if (rxNumbers.length < 10) setRxNumbers((prev) => [...prev, ""]);
  }
  function removeRx(i: number) {
    if (rxNumbers.length <= 1) return;
    setRxNumbers((prev) => prev.filter((_, idx) => idx !== i));
  }

  const filledRx = rxNumbers.filter((r) => r.trim());

  const mutation = useMutation({
    mutationFn: () =>
      prescriptionsApi.create({
        requestType:       "refill",
        medicationName:    "Refill Request",
        prescriptionNumber: filledRx[0] ?? "",
        rxNumbers:         filledRx,
        notes:             message,
      }),
    onSuccess: () => {
      setSuccess(true);
      setPhone(""); setRxNumbers(["", "", ""]); setMessage("");
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

  const nameParts = user.fullName.split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.slice(1).join(" ");

  return (
    <RxPageShell
      title="Refill Prescriptions"
      subtitle="A refill can only be processed online if you've already filled your previous prescription at this pharmacy."
      sidebarTitle="Changing pharmacies has never been easier!"
      sidebarBody={
        <>
          <p>
            With our hassle-free process, you can transfer an individual prescription or your entire
            file with just a few simple clicks.
          </p>
          <p>
            Already a MediSyn patient? Simply enter your prescription numbers below and we'll
            prepare your refill for pickup or free delivery.
          </p>
          <a href="/get-started/transfer" className="mt-1 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900">
            Transfer from another pharmacy →
          </a>
        </>
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <CheckCircle2 size={48} className="text-green-500" />
          <h2 className="font-display text-xl font-bold text-ink-900">Refill Requested!</h2>
          <p className="text-sm text-slate-600 max-w-sm">
            Our pharmacy team will process your refill and contact you when it&apos;s ready.
          </p>
          <p className="text-xs text-slate-400">Please contact us directly to inquire about delivery options and pick-up times.</p>
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
            <h2 className="font-display text-base font-semibold text-ink-900">Refill Request Form</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your account details are pre-filled below.</p>
          </div>

          {/* Name + contact (pre-filled) */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>First Name</label>
              <input className={`${inputClass} bg-slate-50 cursor-not-allowed`} value={firstName} readOnly />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input className={`${inputClass} bg-slate-50 cursor-not-allowed`} value={lastName} readOnly />
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

          {/* Rx numbers */}
          <div>
            <label className={labelClass}>Prescription Number(s) *</label>
            <p className="text-xs text-slate-400 mt-0.5 mb-2">Enter at least one prescription number.</p>
            <div className="space-y-2">
              {rxNumbers.map((rx, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    placeholder={`Prescription number ${i + 1}`}
                    value={rx}
                    onChange={(e) => updateRx(i, e.target.value)}
                  />
                  {rxNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRx(i)}
                      className="flex h-10 w-10 mt-1.5 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {rxNumbers.length < 10 && (
              <button
                type="button"
                onClick={addRx}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <Plus size={13} /> Add another prescription number
              </button>
            )}
          </div>

          <div>
            <label className={labelClass}>Message (optional)</label>
            <textarea
              rows={3}
              className={inputClass}
              placeholder="Any special instructions or notes for the pharmacist…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-1">
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

          <div className="space-y-2">
            <button
              type="submit"
              disabled={mutation.isPending || filledRx.length === 0 || !agreeTerms || !agreePrivacy}
              className="flex items-center gap-2 rounded-full bg-brand-600 px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              {mutation.isPending ? "Submitting…" : "Submit"}
            </button>
            <p className="text-xs text-slate-400">
              Please contact us directly to inquire about delivery options and pick up times.
            </p>
          </div>
        </form>
      )}
    </RxPageShell>
  );
}

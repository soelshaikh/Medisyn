"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { prescriptionsApi, type CreatePrescriptionDto } from "@/api/prescriptions.api";
import { inputClass, labelClass } from "@/lib/ui";

type ServiceType = "standard" | "new_delivery" | "refill" | "transfer";

const SERVICE_TYPES: { value: ServiceType; label: string; description: string }[] = [
  { value: "standard",     label: "New Prescription",  description: "Submit a new prescription from your doctor" },
  { value: "new_delivery", label: "New + Delivery",    description: "Submit a new prescription with home delivery" },
  { value: "refill",       label: "Refill",            description: "Request a refill of an existing prescription" },
  { value: "transfer",     label: "Transfer",          description: "Transfer prescriptions from another pharmacy" },
];

const EMPTY: CreatePrescriptionDto = {
  requestType:          "standard",
  prescriptionNumber:   "",
  prescriberName:       "",
  prescriberPhone:      "",
  medicationName:       "",
  dosage:               "",
  notes:                "",
  deliveryAddress:      "",
  previousPharmacyName:  "",
  previousPharmacyPhone: "",
  transferAll:           true,
  rxNumbers:             [],
};

export default function PrescriptionForm() {
  const qc = useQueryClient();
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [form,    setForm]    = useState<CreatePrescriptionDto>({ ...EMPTY });
  const [rxEntry, setRxEntry] = useState("");

  const serviceType = (form.requestType ?? "standard") as ServiceType;

  const mutation = useMutation({
    mutationFn: prescriptionsApi.create,
    onSuccess: () => {
      setSuccess(true);
      setForm({ ...EMPTY });
      setRxEntry("");
      void qc.invalidateQueries({ queryKey: ["prescriptions", "my"] });
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to submit. Please try again.");
    },
  });

  function set(field: keyof CreatePrescriptionDto, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addRx() {
    const trimmed = rxEntry.trim();
    if (!trimmed) return;
    set("rxNumbers", [...(form.rxNumbers ?? []), trimmed]);
    setRxEntry("");
  }

  function removeRx(i: number) {
    set("rxNumbers", (form.rxNumbers ?? []).filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload: CreatePrescriptionDto = { ...form };
    if (serviceType !== "transfer") {
      delete payload.previousPharmacyName;
      delete payload.previousPharmacyPhone;
      delete payload.transferAll;
      delete payload.rxNumbers;
    }
    if (serviceType !== "new_delivery") {
      delete payload.deliveryAddress;
    }
    mutation.mutate(payload);
  }

  const isTransfer    = serviceType === "transfer";
  const isDelivery    = serviceType === "new_delivery";
  const isRefill      = serviceType === "refill";
  const needsPrescriber = !isRefill && !isTransfer;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-ink-900">Prescription Services</h2>
        <p className="mt-0.5 text-sm text-slate-500">Choose a service type and fill in the details below.</p>
      </div>

      {/* Service type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pt-5">
        {SERVICE_TYPES.map((st) => (
          <button
            key={st.value}
            type="button"
            onClick={() => { set("requestType", st.value); setError(""); }}
            className={[
              "rounded-xl border-2 p-3 text-left transition-all",
              serviceType === st.value
                ? "border-brand-500 bg-brand-50"
                : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/50",
            ].join(" ")}
          >
            <p className={`text-sm font-semibold ${serviceType === st.value ? "text-brand-700" : "text-ink-900"}`}>
              {st.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 leading-snug">{st.description}</p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6">

        {/* Transfer fields */}
        {isTransfer && (
          <div className="space-y-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Previous Pharmacy</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Pharmacy name</label>
                <input
                  required
                  value={form.previousPharmacyName ?? ""}
                  onChange={(e) => set("previousPharmacyName", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Shoppers Drug Mart"
                />
              </div>
              <div>
                <label className={labelClass}>Pharmacy phone</label>
                <input
                  value={form.previousPharmacyPhone ?? ""}
                  onChange={(e) => set("previousPharmacyPhone", e.target.value)}
                  className={inputClass}
                  placeholder="(416) 555-0100"
                />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.transferAll ?? true}
                  onChange={(e) => set("transferAll", e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="text-sm text-ink-900 font-medium">Transfer all prescriptions on file</span>
              </label>
            </div>
            {!(form.transferAll ?? true) && (
              <div>
                <label className={labelClass}>Rx numbers to transfer</label>
                <div className="flex gap-2">
                  <input
                    value={rxEntry}
                    onChange={(e) => setRxEntry(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRx(); } }}
                    className={inputClass}
                    placeholder="e.g. RX-123456 — press Enter to add"
                  />
                  <button
                    type="button"
                    onClick={addRx}
                    className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {(form.rxNumbers ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(form.rxNumbers ?? []).map((rx, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                        {rx}
                        <button type="button" onClick={() => removeRx(i)} className="text-brand-400 hover:text-brand-700">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Medication fields (all types show these) */}
        {!isTransfer && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Medication name</label>
              <input
                required
                value={form.medicationName ?? ""}
                onChange={(e) => set("medicationName", e.target.value)}
                className={inputClass}
                placeholder="e.g. Progesterone cream 50mg"
              />
            </div>
            <div>
              <label className={labelClass}>Dosage / instructions</label>
              <input
                value={form.dosage ?? ""}
                onChange={(e) => set("dosage", e.target.value)}
                className={inputClass}
                placeholder="e.g. Apply 2mg daily"
              />
            </div>
          </div>
        )}

        {/* Prescription number (not needed for refill/transfer) */}
        {!isRefill && !isTransfer && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Prescription number</label>
              <input
                value={form.prescriptionNumber ?? ""}
                onChange={(e) => set("prescriptionNumber", e.target.value)}
                className={inputClass}
                placeholder="RX-123456"
              />
            </div>
          </div>
        )}

        {/* Prescriber info */}
        {needsPrescriber && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Prescriber name</label>
              <input
                required
                value={form.prescriberName ?? ""}
                onChange={(e) => set("prescriberName", e.target.value)}
                className={inputClass}
                placeholder="Dr. Sarah Kim"
              />
            </div>
            <div>
              <label className={labelClass}>Prescriber phone (optional)</label>
              <input
                value={form.prescriberPhone ?? ""}
                onChange={(e) => set("prescriberPhone", e.target.value)}
                className={inputClass}
                placeholder="(416) 555-0100"
              />
            </div>
          </div>
        )}

        {/* Delivery address */}
        {isDelivery && (
          <div>
            <label className={labelClass}>Delivery address</label>
            <input
              required
              value={form.deliveryAddress ?? ""}
              onChange={(e) => set("deliveryAddress", e.target.value)}
              className={inputClass}
              placeholder="123 Main St, Toronto, ON M5V 1A1"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className={labelClass}>Additional notes (optional)</label>
          <textarea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            className={inputClass}
            placeholder="Allergies, preferred flavor, delivery instructions…"
          />
        </div>

        {success && (
          <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            Prescription submitted successfully!
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? "Submitting…" : "Submit Prescription"}
        </button>
      </form>
    </div>
  );
}

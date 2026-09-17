"use client";

import { useActionState, useState } from "react";
import { FilePlus2, RefreshCcw, ArrowRightLeft, UploadCloud, FlaskConical } from "lucide-react";
import { submitPrescriptionRequest } from "@/actions/patient";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

const TABS = [
  { key: "new_rx", label: "New Rx", icon: FilePlus2 },
  { key: "refill", label: "Refill", icon: RefreshCcw },
  { key: "transfer", label: "Transfer", icon: ArrowRightLeft },
  { key: "upload", label: "Upload", icon: UploadCloud },
  { key: "custom_formulation", label: "Custom Formulation", icon: FlaskConical },
] as const;

type RequestType = (typeof TABS)[number]["key"];

export default function PrescriptionForm({ initialType }: { initialType: RequestType }) {
  const [type, setType] = useState<RequestType>(initialType);
  const [state, formAction] = useActionState(submitPrescriptionRequest, INITIAL_ACTION_STATE);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-1 rounded-t-2xl bg-brand-50 p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setType(tab.key)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              type === tab.key ? "bg-white text-brand-700 shadow-sm" : "text-brand-600/70 hover:text-brand-700"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <form action={formAction} encType="multipart/form-data" className="space-y-5 p-6">
        <input type="hidden" name="requestType" value={type} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Full name</label>
            <input required name="fullName" className={inputClass} placeholder="Jane Doe" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input required name="phone" className={inputClass} placeholder="(647) 555-0134" />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Email</label>
            <input required name="email" type="email" className={inputClass} placeholder="jane@email.com" />
          </div>
          <div>
            <label className={labelClass}>Province</label>
            <select name="province" className={inputClass} defaultValue="Ontario">
              {["Ontario","Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Nova Scotia","Prince Edward Island","Quebec","Saskatchewan","Northwest Territories","Nunavut","Yukon"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {type === "transfer" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Current pharmacy name</label>
              <input name="currentPharmacyName" className={inputClass} placeholder="Shoppers Drug Mart" />
            </div>
            <div>
              <label className={labelClass}>Current pharmacy phone</label>
              <input name="currentPharmacyPhone" className={inputClass} placeholder="(416) 555-0100" />
            </div>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>
            {type === "custom_formulation" ? "Requested formulation details" : "Medication name(s) / condition"}
          </label>
          <textarea
            rows={3}
            name="medicationDetails"
            className={inputClass}
            placeholder={type === "custom_formulation" ? "Dosage, allergies, format preference..." : "e.g. Progesterone cream 50mg, dye-free"}
          />
        </div>

        {(type === "upload" || type === "new_rx" || type === "custom_formulation") ? (
          <div>
            <label className={labelClass}>Attach a file (prescription photo, doctor's note)</label>
            <input type="file" name="file" accept="image/*,.pdf" className={`${inputClass} py-2`} />
            <p className="mt-1 text-xs text-slate-500">JPG, PNG or PDF, up to 5MB.</p>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Additional notes (optional)</label>
          <textarea rows={2} name="notes" className={inputClass} placeholder="Allergies, preferred flavor, delivery instructions..." />
        </div>

        <ActionMessage state={state} />
        <SubmitButton pendingText="Submitting...">Submit Request</SubmitButton>
      </form>
    </div>
  );
}

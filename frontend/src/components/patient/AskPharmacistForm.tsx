"use client";

import { useActionState } from "react";
import { submitAskPharmacist } from "@/actions/patient";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

const CATEGORIES = ["Medication Question", "Side Effects", "Drug Interaction", "Dosage", "Insurance/Billing", "Other"];

export default function AskPharmacistForm() {
  const [state, formAction] = useActionState(submitAskPharmacist, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className={labelClass}>Category</label>
        <select required name="category" className={inputClass} defaultValue="">
          <option value="" disabled>Select a category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Your question</label>
        <textarea required rows={4} name="message" className={inputClass} placeholder="Ask our pharmacists anything about your medications..." />
      </div>
      <div>
        <label className={labelClass}>Attach a file (optional)</label>
        <input type="file" name="file" accept="image/*,.pdf" className={`${inputClass} py-2`} />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Sending...">Ask a Pharmacist</SubmitButton>
    </form>
  );
}

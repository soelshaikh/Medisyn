"use client";

import { useActionState } from "react";
import { submitMinorAilmentRequest } from "@/actions/patient";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export const MINOR_AILMENTS = [
  "Urinary Tract Infection",
  "Pink Eye (Conjunctivitis)",
  "Cold Sores",
  "Acne",
  "Allergic Rhinitis",
  "Insect Bites",
  "Hemorrhoids",
  "Mild Eczema / Dermatitis",
  "Heartburn / GERD",
  "Smoking Cessation",
];

export default function MinorAilmentForm() {
  const [state, formAction] = useActionState(submitMinorAilmentRequest, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className={labelClass}>Minor ailment service</label>
        <select required name="ailment" className={inputClass} defaultValue="">
          <option value="" disabled>Select a condition</option>
          {MINOR_AILMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Describe your symptoms</label>
        <textarea rows={4} name="details" className={inputClass} placeholder="How long you've had symptoms, severity, any prior treatment..." />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Submitting...">Submit Minor Ailment Request</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { registerClinic } from "@/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export default function RegisterClinicForm() {
  const [state, formAction] = useActionState(registerClinic, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Clinic name</label>
          <input required name="clinicName" className={inputClass} placeholder="Yorkdale Family Clinic" />
        </div>
        <div>
          <label className={labelClass}>Primary contact name</label>
          <input required name="contactName" className={inputClass} placeholder="Dr. Alex Chen" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Work email</label>
          <input required name="email" type="email" className={inputClass} placeholder="clinic@email.com" />
        </div>
        <div>
          <label className={labelClass}>Clinic phone</label>
          <input required name="clinicPhone" className={inputClass} placeholder="(416) 555-0110" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Clinic address</label>
        <input required name="clinicAddress" className={inputClass} placeholder="123 Main St, Toronto, ON" />
      </div>
      <div>
        <label className={labelClass}>License / registration number (optional)</label>
        <input name="licenseNumber" className={inputClass} placeholder="CPSO / clinic license #" />
      </div>
      <div>
        <label className={labelClass}>Create a password</label>
        <input required name="password" type="password" minLength={8} className={inputClass} placeholder="At least 8 characters" />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Submitting request...">Request Clinic Access</SubmitButton>
      <p className="text-center text-xs text-slate-500">
        Clinic accounts require email verification and MediSyn admin approval before portal access is granted.
      </p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { registerPatient } from "@/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export default function RegisterPatientForm() {
  const [state, formAction] = useActionState(registerPatient, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Full name</label>
          <input required name="fullName" className={inputClass} placeholder="Jane Doe" />
        </div>
        <div>
          <label className={labelClass}>Date of birth</label>
          <input name="dateOfBirth" type="date" className={inputClass} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Email</label>
          <input required name="email" type="email" className={inputClass} placeholder="jane@email.com" />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input required name="phone" className={inputClass} placeholder="(647) 555-0134" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <input required name="password" type="password" minLength={8} className={inputClass} placeholder="At least 8 characters" />
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input required type="checkbox" name="consentGiven" className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600" />
        I consent to MediSyn collecting my health information to provide pharmacy services, in accordance with
        the Privacy Policy.
      </label>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Creating account...">Create Patient Account</SubmitButton>
    </form>
  );
}

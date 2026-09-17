"use client";

import { useActionState } from "react";
import { updateClinicProfile } from "@/actions/clinic";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

type Profile = {
  clinicName: string;
  contactName: string;
  email: string;
  clinicPhone: string;
  clinicAddress: string;
  licenseNumber: string;
};

export default function ClinicProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateClinicProfile, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Clinic name</label>
          <input required name="clinicName" defaultValue={profile.clinicName} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Primary contact name</label>
          <input required name="contactName" defaultValue={profile.contactName} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Email</label>
          <input disabled value={profile.email} className={`${inputClass} bg-slate-100 text-slate-500`} />
        </div>
        <div>
          <label className={labelClass}>Clinic phone</label>
          <input required name="clinicPhone" defaultValue={profile.clinicPhone} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Clinic address</label>
        <input required name="clinicAddress" defaultValue={profile.clinicAddress} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>License / registration number</label>
        <input name="licenseNumber" defaultValue={profile.licenseNumber} className={inputClass} />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Saving...">Save Changes</SubmitButton>
    </form>
  );
}

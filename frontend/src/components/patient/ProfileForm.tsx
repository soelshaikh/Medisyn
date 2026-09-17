"use client";

import { useActionState } from "react";
import { updatePatientProfile } from "@/actions/patient";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

type Profile = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  healthCardNumber: string;
  preferredContactMethod: string;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updatePatientProfile, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Full name</label>
          <input required name="fullName" defaultValue={profile.fullName} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input disabled value={profile.email} className={`${inputClass} bg-slate-100 text-slate-500`} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Phone</label>
          <input required name="phone" defaultValue={profile.phone} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Date of birth</label>
          <input type="date" name="dateOfBirth" defaultValue={profile.dateOfBirth} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Address</label>
        <input name="address" defaultValue={profile.address} className={inputClass} placeholder="Street, city, province, postal code" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Health card number (optional)</label>
          <input name="healthCardNumber" defaultValue={profile.healthCardNumber} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Preferred contact method</label>
          <select name="preferredContactMethod" defaultValue={profile.preferredContactMethod} className={inputClass}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">SMS</option>
          </select>
        </div>
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Saving...">Save Changes</SubmitButton>
    </form>
  );
}

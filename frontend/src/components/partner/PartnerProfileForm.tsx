"use client";

import { useActionState } from "react";
import { updatePartnerProfile } from "@/actions/partner";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

type Profile = {
  pharmacyName: string;
  contactName: string;
  email: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  licenseNumber: string;
};

export default function PartnerProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updatePartnerProfile, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Pharmacy name</label>
          <input required name="pharmacyName" defaultValue={profile.pharmacyName} className={inputClass} />
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
          <label className={labelClass}>Pharmacy phone</label>
          <input required name="pharmacyPhone" defaultValue={profile.pharmacyPhone} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Pharmacy address</label>
        <input required name="pharmacyAddress" defaultValue={profile.pharmacyAddress} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>License number</label>
        <input name="licenseNumber" defaultValue={profile.licenseNumber} className={inputClass} />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Saving...">Save Changes</SubmitButton>
    </form>
  );
}

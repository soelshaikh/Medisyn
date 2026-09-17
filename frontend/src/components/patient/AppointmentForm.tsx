"use client";

import { useActionState } from "react";
import { submitAppointmentRequest } from "@/actions/patient";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

const SERVICES = [
  "Seasonal Flu Vaccine",
  "COVID-19 Vaccine",
  "Travel Health Vaccination",
  "Shingles Vaccine",
  "Pneumonia Vaccine",
  "Tetanus Booster",
  "Naloxone Kit / Training",
  "MedsCheck Consultation",
];

export default function AppointmentForm() {
  const [state, formAction] = useActionState(submitAppointmentRequest, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className={labelClass}>Vaccine / Service</label>
        <select required name="service" className={inputClass} defaultValue="">
          <option value="" disabled>Select a service</option>
          {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Preferred date</label>
          <input required type="date" name="preferredDate" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Preferred time</label>
          <input type="time" name="preferredTime" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input required name="phone" className={inputClass} placeholder="(647) 555-0134" />
      </div>
      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea rows={3} name="notes" className={inputClass} placeholder="Any relevant health details..." />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Submitting...">Request Appointment</SubmitButton>
      <p className="text-center text-xs text-slate-500">
        This submits a request — a MediSyn team member will confirm your exact appointment time.
      </p>
    </form>
  );
}

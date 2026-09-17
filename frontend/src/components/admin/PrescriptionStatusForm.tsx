"use client";

import { useActionState } from "react";
import { updatePrescriptionRequest } from "@/actions/admin";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

const STATUSES = [
  "submitted",
  "received",
  "under_review",
  "more_info_required",
  "processing",
  "ready_pickup",
  "ready_delivery",
  "completed",
  "declined",
];

export default function PrescriptionStatusForm({
  id,
  currentStatus,
  currentNotes,
}: {
  id: number;
  currentStatus: string;
  currentNotes: string;
}) {
  const [state, formAction] = useActionState(updatePrescriptionRequest, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue={currentStatus} className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Internal / patient-facing note</label>
        <textarea name="adminNotes" defaultValue={currentNotes} rows={3} className={inputClass} />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Saving...">Update Request</SubmitButton>
    </form>
  );
}

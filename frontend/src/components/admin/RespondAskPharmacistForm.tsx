"use client";

import { useActionState } from "react";
import { respondToAskPharmacist } from "@/actions/admin";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export default function RespondAskPharmacistForm({
  id,
  currentResponse,
  currentStatus,
}: {
  id: number;
  currentResponse: string;
  currentStatus: string;
}) {
  const [state, formAction] = useActionState(respondToAskPharmacist, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className={labelClass}>Response to patient</label>
        <textarea name="response" rows={5} defaultValue={currentResponse} className={inputClass} placeholder="Write your reply..." />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select name="status" defaultValue={currentStatus === "submitted" ? "responded" : currentStatus} className={inputClass}>
          <option value="under_review">Under Review</option>
          <option value="responded">Responded</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Sending...">Send Response</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <label className={labelClass}>Email</label>
        <input required name="email" type="email" className={inputClass} placeholder="you@email.com" />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Sending link...">Send Reset Link</SubmitButton>
    </form>
  );
}

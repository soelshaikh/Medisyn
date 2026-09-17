"use client";

import { useActionState } from "react";
import { resetPassword } from "@/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className={labelClass}>New password</label>
        <input required name="password" type="password" minLength={8} className={inputClass} placeholder="At least 8 characters" />
      </div>
      <div>
        <label className={labelClass}>Confirm new password</label>
        <input required name="confirmPassword" type="password" minLength={8} className={inputClass} />
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Updating password...">Reset Password</SubmitButton>
    </form>
  );
}

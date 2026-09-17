"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginUser } from "@/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import ActionMessage from "@/components/forms/ActionMessage";
import SubmitButton from "@/components/forms/SubmitButton";
import { inputClass, labelClass } from "@/lib/ui";

export default function LoginForm() {
  const [state, formAction] = useActionState(loginUser, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <label className={labelClass}>Email</label>
        <input required name="email" type="email" className={inputClass} placeholder="you@email.com" />
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <input required name="password" type="password" className={inputClass} placeholder="••••••••" />
      </div>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="font-semibold text-brand-700 hover:text-brand-800">
          Forgot password?
        </Link>
      </div>
      <ActionMessage state={state} />
      <SubmitButton pendingText="Signing in...">Sign In</SubmitButton>
    </form>
  );
}

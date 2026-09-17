import Link from "next/link";
import { AlertCircle, CheckCircle2, TerminalSquare } from "lucide-react";
import type { ActionState } from "@/lib/action-state";

export default function ActionMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;

  return (
    <div className="space-y-3">
      {state.error ? (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}
      {state.success ? (
        <div className="flex items-start gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.success}</span>
        </div>
      ) : null}
      {state.devLink ? (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <TerminalSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            No email provider is configured in this environment, so here&rsquo;s your link directly:{" "}
            <Link href={state.devLink} className="font-semibold text-brand-700 underline">
              {state.devLink}
            </Link>
          </span>
        </div>
      ) : null}
    </div>
  );
}

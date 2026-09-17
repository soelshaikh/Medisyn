import { Clock3, CheckCircle2, XCircle, Ban } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Partner Dashboard | MediSyn Compounding" };

const STATUS_COPY: Record<string, { icon: typeof Clock3; title: string; body: string }> = {
  pending_verification: {
    icon: Clock3,
    title: "Verify your email",
    body: "Please check your inbox and click the verification link to continue your pharmacy partner application.",
  },
  pending_approval: {
    icon: Clock3,
    title: "Application under review",
    body: "Thanks for verifying your email. A MediSyn administrator is reviewing your partner application — you'll be notified by email once a decision is made.",
  },
  rejected: {
    icon: XCircle,
    title: "Application not approved",
    body: "Unfortunately your pharmacy partner application was not approved at this time. Contact MediSyn support for more information.",
  },
  suspended: {
    icon: Ban,
    title: "Account suspended",
    body: "Your partner account has been temporarily suspended. Contact MediSyn support for assistance.",
  },
  deactivated: {
    icon: Ban,
    title: "Account deactivated",
    body: "Your partner account is deactivated. Contact MediSyn support for assistance.",
  },
};

export default async function PartnerDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (user.status !== "approved") {
    const copy = STATUS_COPY[user.status] ?? STATUS_COPY.pending_approval;
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <copy.icon className="mx-auto h-12 w-12 text-brand-600" />
        <h1 className="mt-4 font-display text-xl font-bold text-ink-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.body}</p>
        <div className="mt-5 flex justify-center">
          <StatusBadge status={user.status} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-brand-600" />
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Welcome, {user.fullName}</h1>
          <p className="text-sm text-slate-600">Your pharmacy partner account is approved and active.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold text-ink-900">Account Status</h2>
          <div className="mt-3"><StatusBadge status={user.status} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold text-ink-900">Need something from MediSyn?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Reach our pharmacy team directly for partner requests, documentation, or general questions.
          </p>
          <a href="/contact" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800">
            Contact MediSyn →
          </a>
        </div>
      </div>
    </div>
  );
}

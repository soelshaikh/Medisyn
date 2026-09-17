import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  FileText,
  RefreshCcw,
  ArrowRightLeft,
  UploadCloud,
  MessageCircleQuestion,
  CalendarHeart,
  Bell,
  ShoppingBag,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { prescriptionRequests, appointmentRequests, askPharmacistRequests, notifications } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Patient Dashboard | MediSyn Compounding" };

const QUICK_ACTIONS = [
  { href: "/patient/prescriptions?type=transfer", label: "Transfer Prescription", icon: ArrowRightLeft },
  { href: "/patient/prescriptions?type=refill", label: "Request Refill", icon: RefreshCcw },
  { href: "/patient/prescriptions?type=upload", label: "Upload Prescription", icon: UploadCloud },
  { href: "/patient/ask-a-pharmacist", label: "Ask a Pharmacist", icon: MessageCircleQuestion },
  { href: "/patient/appointments", label: "Book Vaccine Appointment", icon: CalendarHeart },
  { href: "/shop", label: "Shop Products", icon: ShoppingBag },
];

export default async function PatientDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [rxList, apptList, askList, notifList] = await Promise.all([
    db.select().from(prescriptionRequests).where(eq(prescriptionRequests.patientId, user.id)).orderBy(desc(prescriptionRequests.createdAt)).limit(5),
    db.select().from(appointmentRequests).where(eq(appointmentRequests.patientId, user.id)).orderBy(desc(appointmentRequests.createdAt)).limit(5),
    db.select().from(askPharmacistRequests).where(eq(askPharmacistRequests.patientId, user.id)).orderBy(desc(askPharmacistRequests.createdAt)).limit(5),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(6),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Welcome back, {user.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-600">Here&rsquo;s what&rsquo;s happening with your MediSyn account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <action.icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-ink-900">{action.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
              <FileText className="h-5 w-5 text-brand-600" /> Recent Prescription Requests
            </h2>
            <Link href="/patient/prescriptions" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {rxList.length === 0 ? (
              <p className="text-sm text-slate-500">No prescription requests yet.</p>
            ) : (
              rxList.map((rx) => (
                <div key={rx.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900 capitalize">{rx.requestType.replace("_", " ")}</p>
                    <p className="text-xs text-slate-500">{new Date(rx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={rx.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
              <CalendarHeart className="h-5 w-5 text-brand-600" /> Appointment Requests
            </h2>
            <Link href="/patient/appointments" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {apptList.length === 0 ? (
              <p className="text-sm text-slate-500">No appointment requests yet.</p>
            ) : (
              apptList.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{appt.service}</p>
                    <p className="text-xs text-slate-500">{appt.preferredDate}</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
              <MessageCircleQuestion className="h-5 w-5 text-brand-600" /> Ask a Pharmacist
            </h2>
            <Link href="/patient/ask-a-pharmacist" className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {askList.length === 0 ? (
              <p className="text-sm text-slate-500">No questions submitted yet.</p>
            ) : (
              askList.map((ask) => (
                <div key={ask.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{ask.category}</p>
                    <p className="truncate text-xs text-slate-500">{ask.message}</p>
                  </div>
                  <StatusBadge status={ask.status} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Bell className="h-5 w-5 text-brand-600" /> Notifications
          </h2>
          <div className="mt-4 space-y-3">
            {notifList.length === 0 ? (
              <p className="text-sm text-slate-500">You&rsquo;re all caught up.</p>
            ) : (
              notifList.map((n) => (
                <div key={n.id} className="rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

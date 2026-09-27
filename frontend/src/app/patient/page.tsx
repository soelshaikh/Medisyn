"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  RefreshCcw,
  ArrowRightLeft,
  UploadCloud,
  MessageCircleQuestion,
  CalendarHeart,
  Bell,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { prescriptionsApi } from "@/api/prescriptions.api";
import { askPharmacistApi } from "@/api/ask-pharmacist.api";
import { appointmentsApi } from "@/api/appointments.api";
import { notificationsApi } from "@/api/notifications.api";
import StatusBadge from "@/components/StatusBadge";

const QUICK_ACTIONS = [
  { href: "/patient/prescriptions", label: "Add Prescription", icon: ArrowRightLeft },
  { href: "/patient/prescriptions", label: "View Prescriptions", icon: RefreshCcw },
  { href: "/patient/prescriptions", label: "Prescription Services", icon: UploadCloud },
  { href: "/patient/ask-a-pharmacist", label: "Ask a Pharmacist", icon: MessageCircleQuestion },
  { href: "/patient/appointments", label: "Book Vaccine Appointment", icon: CalendarHeart },
  { href: "/shop", label: "Shop Products", icon: ShoppingBag },
];

export default function PatientDashboard() {
  const { user } = useAuthStore();

  const { data: rxData, isLoading: rxLoading } = useQuery({
    queryKey: ["prescriptions", "my"],
    queryFn: () => prescriptionsApi.list(1, 5),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: askData, isLoading: askLoading } = useQuery({
    queryKey: ["ask-pharmacist", "my"],
    queryFn: () => askPharmacistApi.list(1, 5),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: apptData, isLoading: apptLoading } = useQuery({
    queryKey: ["appointments", "my"],
    queryFn: () => appointmentsApi.listMyBookings(1, 5),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: notifData, isLoading: notifLoading } = useQuery({
    queryKey: ["notifications", "my"],
    queryFn: () => notificationsApi.list(1, 6),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const firstName = user?.fullName.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Welcome back, {firstName}</h1>
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
        {/* Prescriptions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
              <FileText className="h-5 w-5 text-brand-600" /> Recent Prescriptions
            </h2>
            <Link href="/patient/prescriptions" className="text-xs font-semibold text-brand-700 hover:text-brand-800">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {rxLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : !rxData?.docs?.length ? (
              <p className="text-sm text-slate-500">No prescriptions yet.</p>
            ) : (
              rxData.docs.map((rx) => (
                <div key={rx._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{rx.medicationName}</p>
                    <p className="text-xs text-slate-500">{new Date(rx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={rx.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Appointments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
              <CalendarHeart className="h-5 w-5 text-brand-600" /> Appointment Bookings
            </h2>
            <Link href="/patient/appointments" className="text-xs font-semibold text-brand-700 hover:text-brand-800">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {apptLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : !apptData?.docs?.length ? (
              <p className="text-sm text-slate-500">No appointment bookings yet.</p>
            ) : (
              apptData.docs.map((appt) => (
                <div key={appt._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {appt.vaccineService?.name ?? "Appointment"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {appt.slot ? new Date(appt.slot.date).toLocaleDateString() : new Date(appt.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ask a Pharmacist */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
              <MessageCircleQuestion className="h-5 w-5 text-brand-600" /> Ask a Pharmacist
            </h2>
            <Link href="/patient/ask-a-pharmacist" className="text-xs font-semibold text-brand-700 hover:text-brand-800">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {askLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : !askData?.docs?.length ? (
              <p className="text-sm text-slate-500">No questions submitted yet.</p>
            ) : (
              askData.docs.map((ask) => (
                <div key={ask._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{ask.subject}</p>
                    <p className="truncate text-xs text-slate-500">{ask.question}</p>
                  </div>
                  <StatusBadge status={ask.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
            <Bell className="h-5 w-5 text-brand-600" /> Notifications
          </h2>
          <div className="mt-4 space-y-3">
            {notifLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : !notifData?.docs?.length ? (
              <p className="text-sm text-slate-500">You&rsquo;re all caught up.</p>
            ) : (
              notifData.docs.map((n) => (
                <div key={n._id} className={`rounded-lg px-4 py-3 ${n.read ? "bg-slate-50" : "bg-brand-50"}`}>
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

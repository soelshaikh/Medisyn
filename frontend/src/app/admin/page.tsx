import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  Users,
  Building2,
  Store,
  FileText,
  MessageCircleQuestion,
  CalendarHeart,
  ScrollText,
} from "lucide-react";
import { db } from "@/db";
import {
  users,
  prescriptionRequests,
  askPharmacistRequests,
  appointmentRequests,
  adminAuditLog,
} from "@/db/schema";

export const metadata = { title: "Admin Dashboard | MediSyn Compounding" };

export default async function AdminDashboard() {
  const [
    patientCountRows,
    pendingClinicsRows,
    pendingPartnersRows,
    newPrescriptionsRows,
    newAppointmentsRows,
    newAskPharmacistRows,
    recentActivity,
  ] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(users).where(eq(users.role, "patient")),
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.role} = 'clinic' and ${users.status} = 'pending_approval'`),
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.role} = 'pharmacy_partner' and ${users.status} = 'pending_approval'`),
    db.select({ value: sql<number>`count(*)` }).from(prescriptionRequests).where(eq(prescriptionRequests.status, "submitted")),
    db.select({ value: sql<number>`count(*)` }).from(appointmentRequests).where(eq(appointmentRequests.status, "submitted")),
    db.select({ value: sql<number>`count(*)` }).from(askPharmacistRequests).where(eq(askPharmacistRequests.status, "submitted")),
    db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(8),
  ]);

  const patientCount = Number(patientCountRows[0]?.value ?? 0);
  const pendingClinics = Number(pendingClinicsRows[0]?.value ?? 0);
  const pendingPartners = Number(pendingPartnersRows[0]?.value ?? 0);
  const newPrescriptions = Number(newPrescriptionsRows[0]?.value ?? 0);
  const newAppointments = Number(newAppointmentsRows[0]?.value ?? 0);
  const newAskPharmacist = Number(newAskPharmacistRows[0]?.value ?? 0);

  const cards = [
    { label: "Registered Patients", value: patientCount, href: "/admin/patients", icon: Users },
    { label: "Pending Clinic Approvals", value: pendingClinics, href: "/admin/clinics", icon: Building2 },
    { label: "Pending Pharmacy Partner Approvals", value: pendingPartners, href: "/admin/pharmacy-partners", icon: Store },
    { label: "New Prescription Requests", value: newPrescriptions, href: "/admin/prescriptions", icon: FileText },
    { label: "New Appointment Requests", value: newAppointments, href: "/admin/appointments", icon: CalendarHeart },
    { label: "New Ask-a-Pharmacist Questions", value: newAskPharmacist, href: "/admin/ask-a-pharmacist", icon: MessageCircleQuestion },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Operational overview of the MediSyn platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <card.icon className="h-5 w-5" />
              </span>
              <span className="font-display text-3xl font-bold text-ink-900">{card.value}</span>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
          <ScrollText className="h-5 w-5 text-brand-600" /> Recent Admin Activity
        </h2>
        <div className="mt-4 space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No admin activity recorded yet.</p>
          ) : (
            recentActivity.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <span className="text-ink-900">{log.action}</span>
                <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

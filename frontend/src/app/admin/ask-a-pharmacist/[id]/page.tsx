import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { FileDown } from "lucide-react";
import { db } from "@/db";
import { askPharmacistRequests, users } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";
import RespondAskPharmacistForm from "@/components/admin/RespondAskPharmacistForm";

export const metadata = { title: "Ask a Pharmacist Detail | MediSyn Admin" };

export default async function AdminAskPharmacistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqId = Number(id);
  if (!reqId) notFound();

  const [row] = await db.select().from(askPharmacistRequests).where(eq(askPharmacistRequests.id, reqId)).limit(1);
  if (!row) notFound();
  const [patient] = await db.select().from(users).where(eq(users.id, row.patientId)).limit(1);
  const fileUrl = row.fileData ? `data:${row.fileType};base64,${row.fileData}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{row.category}</h1>
          <p className="text-sm text-slate-600">From {patient?.fullName} ({patient?.email})</p>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="font-display text-base font-semibold text-ink-900">Patient Question</h2>
          <p className="mt-3 text-sm text-slate-700">{row.message}</p>
          {fileUrl ? (
            <a href={fileUrl} download={row.fileName ?? "attachment"} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
              <FileDown className="h-4 w-4" /> Download attachment ({row.fileName})
            </a>
          ) : null}
          {row.response ? (
            <div className="mt-5 rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
              <p className="font-semibold">Current response:</p>
              <p className="mt-1">{row.response}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold text-ink-900">Respond</h2>
          <div className="mt-4">
            <RespondAskPharmacistForm id={row.id} currentResponse={row.response ?? ""} currentStatus={row.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

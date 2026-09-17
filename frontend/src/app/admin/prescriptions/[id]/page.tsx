import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { FileDown } from "lucide-react";
import { db } from "@/db";
import { prescriptionRequests } from "@/db/schema";
import StatusBadge from "@/components/StatusBadge";
import PrescriptionStatusForm from "@/components/admin/PrescriptionStatusForm";

export const metadata = { title: "Prescription Request | MediSyn Admin" };

export default async function AdminPrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reqId = Number(id);
  if (!reqId) notFound();

  const [rx] = await db.select().from(prescriptionRequests).where(eq(prescriptionRequests.id, reqId)).limit(1);
  if (!rx) notFound();

  const fileUrl = rx.fileData ? `data:${rx.fileType};base64,${rx.fileData}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold capitalize text-ink-900">{rx.requestType.replace("_", " ")} Request</h1>
          <p className="text-sm text-slate-600">Submitted {new Date(rx.createdAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={rx.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold text-ink-900">Patient Details</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="text-ink-900">{rx.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="text-ink-900">{rx.email}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="text-ink-900">{rx.phone}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Province</dt><dd className="text-ink-900">{rx.province || "—"}</dd></div>
              {rx.requestType === "transfer" ? (
                <>
                  <div className="flex justify-between"><dt className="text-slate-500">Current pharmacy</dt><dd className="text-ink-900">{rx.currentPharmacyName || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Pharmacy phone</dt><dd className="text-ink-900">{rx.currentPharmacyPhone || "—"}</dd></div>
                </>
              ) : null}
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold text-ink-900">Medication Details / Notes</h2>
            <p className="mt-3 text-sm text-slate-700">{rx.medicationDetails || "No medication details provided."}</p>
            {rx.notes ? <p className="mt-3 text-sm text-slate-600"><strong>Patient notes:</strong> {rx.notes}</p> : null}
            {fileUrl ? (
              <a
                href={fileUrl}
                download={rx.fileName ?? "attachment"}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                <FileDown className="h-4 w-4" /> Download attachment ({rx.fileName})
              </a>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold text-ink-900">Manage Request</h2>
          <div className="mt-4">
            <PrescriptionStatusForm id={rx.id} currentStatus={rx.status} currentNotes={rx.adminNotes ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}

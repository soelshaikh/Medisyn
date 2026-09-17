import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { clinicProfiles } from "@/db/schema";
import ClinicProfileForm from "@/components/clinic/ClinicProfileForm";

export const metadata = { title: "Clinic Profile | MediSyn Compounding" };

export default async function ClinicProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [profile] = await db.select().from(clinicProfiles).where(eq(clinicProfiles.userId, user.id)).limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Clinic Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Keep your clinic&rsquo;s details current.</p>
      </div>
      <ClinicProfileForm
        profile={{
          clinicName: profile?.clinicName ?? "",
          contactName: profile?.contactName ?? user.fullName,
          email: user.email,
          clinicPhone: profile?.clinicPhone ?? user.phone ?? "",
          clinicAddress: profile?.clinicAddress ?? "",
          licenseNumber: profile?.licenseNumber ?? "",
        }}
      />
    </div>
  );
}

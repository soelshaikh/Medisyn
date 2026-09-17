import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { patientProfiles } from "@/db/schema";
import ProfileForm from "@/components/patient/ProfileForm";

export const metadata = { title: "My Profile | MediSyn Compounding" };

export default async function PatientProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.userId, user.id)).limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Keep your contact details current so we can reach you quickly.</p>
      </div>
      <ProfileForm
        profile={{
          fullName: user.fullName,
          email: user.email,
          phone: user.phone ?? "",
          dateOfBirth: profile?.dateOfBirth ?? "",
          address: profile?.address ?? "",
          healthCardNumber: profile?.healthCardNumber ?? "",
          preferredContactMethod: profile?.preferredContactMethod ?? "email",
        }}
      />
    </div>
  );
}

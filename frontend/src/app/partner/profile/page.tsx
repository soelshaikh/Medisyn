import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { pharmacyPartnerProfiles } from "@/db/schema";
import PartnerProfileForm from "@/components/partner/PartnerProfileForm";

export const metadata = { title: "Pharmacy Partner Profile | MediSyn Compounding" };

export default async function PartnerProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [profile] = await db
    .select()
    .from(pharmacyPartnerProfiles)
    .where(eq(pharmacyPartnerProfiles.userId, user.id))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Pharmacy Partner Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Keep your pharmacy&rsquo;s details current.</p>
      </div>
      <PartnerProfileForm
        profile={{
          pharmacyName: profile?.pharmacyName ?? "",
          contactName: profile?.contactName ?? user.fullName,
          email: user.email,
          pharmacyPhone: profile?.pharmacyPhone ?? user.phone ?? "",
          pharmacyAddress: profile?.pharmacyAddress ?? "",
          licenseNumber: profile?.licenseNumber ?? "",
        }}
      />
    </div>
  );
}

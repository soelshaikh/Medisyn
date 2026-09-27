"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usersApi } from "@/api/users.api";
import ProfileForm from "@/components/patient/ProfileForm";

export default function PartnerProfilePage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: usersApi.getMe,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Pharmacy Partner Profile</h1>
        <p className="mt-1 text-sm text-slate-600">Keep your pharmacy&rsquo;s details current.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : user ? (
        <ProfileForm user={user} />
      ) : null}
    </div>
  );
}

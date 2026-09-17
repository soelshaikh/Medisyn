import type { Metadata } from "next";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset Password | MediSyn Compounding" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <section className="bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Account Recovery</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Set a new password</h1>
        </div>
        <div className="mt-8">
          <ResetPasswordForm token={token ?? ""} />
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailToken } from "@/actions/auth";

export const metadata = { title: "Verify Email | MediSyn Compounding" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verifyEmailToken(token ?? "");

  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        {result.ok ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-brand-600" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
        )}
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">
          {result.ok ? "Email verified" : "Verification failed"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{result.message}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to Login
        </Link>
      </div>
    </section>
  );
}

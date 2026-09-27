"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { authApi } from "@/api/auth.api";
import type { AxiosError } from "axios";

export default function VerifyEmailContent({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please use the link from your email.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified. You can now log in.");
      })
      .catch((err: AxiosError<{ error?: string }>) => {
        setStatus("error");
        setMessage(
          err.response?.data?.error ?? "This verification link is invalid or has already been used.",
        );
      });
  }, [token]);

  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        {status === "loading" ? (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500" />
        ) : status === "success" ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-brand-600" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
        )}
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">
          {status === "loading"
            ? "Verifying your email…"
            : status === "success"
            ? "Email verified"
            : "Verification failed"}
        </h1>
        {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
        {status !== "loading" ? (
          <Link
            href="/login"
            className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Go to Login
          </Link>
        ) : null}
      </div>
    </section>
  );
}

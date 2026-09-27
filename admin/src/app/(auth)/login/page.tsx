"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/apiClient";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth, clearAuth, isAuthenticated, _hasHydrated } = useAdminAuthStore();
  const [email,    setEmail]    = useState("admin@medisyn.ca");
  const [password, setPassword] = useState("Admin@123456");
  const [error,    setError]    = useState("");

  // If the store says authenticated, verify the session is actually valid
  // by checking sessionStorage for a token. If there's no token, the session
  // has expired — clear stale auth rather than bouncing to dashboard.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (isAuthenticated) {
      const token = sessionStorage.getItem("access_token");
      if (token) {
        router.replace("/dashboard");
      } else {
        // Token gone (new tab / browser restart) — clear stale auth flag
        clearAuth();
      }
    }
  }, [_hasHydrated, isAuthenticated, router, clearAuth]);

  const login = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/auth/login", { email, password });
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(
        {
          id:          data.user.id,
          email:       data.user.email,
          fullName:    data.user.fullName,
          roles:       data.user.roles ?? [],
          permissions: data.user.permissions ?? [],
        },
        data.accessToken,
      );
      router.replace("/dashboard");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Invalid email or password");
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm bg-[var(--color-white)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-8">
        <div className="mb-8 text-center">
          <h1 className="text-[var(--font-size-2xl)] font-bold text-[var(--color-text-primary)]">
            MediSyn Admin
          </h1>
          <p className="mt-1 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            Sign in to the administration panel
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setError(""); login.mutate(); }}
          className="flex flex-col gap-[var(--space-4)]"
        >
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{error}</p>
          )}

          <Button type="submit" loading={login.isPending} fullWidth>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}

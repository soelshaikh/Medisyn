"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAdminAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/auth/login", { email, password });
      return res.data.data;
    },
    onSuccess: (data) => {
      setAuth(
        {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.fullName,
          roles: data.user.roles ?? [],
          permissions: data.user.permissions ?? [],
        },
        data.accessToken,
      );
      router.replace("/dashboard");
    },
    onError: () => setError("Invalid email or password"),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] px-4">
      <div
        className="w-full max-w-sm bg-[var(--color-white)] rounded-[var(--radius-xl)]
                   shadow-[var(--shadow-lg)] p-8"
      >
        <div className="mb-8 text-center">
          <h1 className="text-[var(--font-size-2xl)] font-[var(--font-weight-bold)] text-[var(--color-text-primary)]">
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

"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { Button } from "@/components/ui/Button";

export function AdminTopbar() {
  const { user, clearAuth } = useAdminAuthStore();
  const router = useRouter();

  const logout = useMutation({
    mutationFn: () => apiClient.post("/auth/logout"),
    onSettled: () => {
      clearAuth();
      router.replace("/login");
    },
  });

  return (
    <header
      className="h-[var(--header-height)] bg-[var(--color-white)] border-b border-[var(--color-border)]
                 flex items-center justify-between px-[var(--space-6)] shrink-0"
    >
      <div />
      <div className="flex items-center gap-[var(--space-4)]">
        {user && (
          <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            {user.fullName}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LogOut size={14} />}
          loading={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}

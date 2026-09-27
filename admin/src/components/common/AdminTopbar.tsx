"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Bell, CheckCheck } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import apiClient from "@/lib/apiClient";
import { notificationsApi, type AdminNotification } from "@/api/notifications.api";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { Button } from "@/components/ui/Button";

const TYPE_LABELS: Record<string, string> = {
  order_update:          "Order",
  compounding_update:    "Compounding",
  appointment_update:    "Appointment",
  ask_pharmacist_update: "Ask Pharmacist",
  prescription_update:   "Prescription",
  system:                "System",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AdminTopbar() {
  const { user, clearAuth } = useAdminAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn:  notificationsApi.unreadCount,
    enabled:  !!user,
    refetchInterval: !!user ? 30_000 : false,
    staleTime: 20_000,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications-list"],
    queryFn:  () => notificationsApi.list(1, 10),
    enabled:  open,
  });

  const markReadMut = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const logout = useMutation({
    mutationFn: () => apiClient.post("/auth/logout"),
    onSettled: () => {
      clearAuth();
      router.replace("/login");
    },
  });

  const notifications = notifData?.data ?? [];

  return (
    <header
      className="h-[var(--header-height)] bg-[var(--color-white)] border-b border-[var(--color-border)]
                 flex items-center justify-between px-[var(--space-6)] shrink-0"
    >
      <div />
      <div className="flex items-center gap-[var(--space-3)]">
        {user && (
          <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            {user.fullName}
          </span>
        )}

        {/* Notification bell */}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              className="relative p-2 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              className="z-[var(--z-modal)] w-80 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-xl)] animate-fade-in outline-none"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllMut.mutate()}
                    disabled={markAllMut.isPending}
                    className="flex items-center gap-1 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n: AdminNotification) => (
                    <button
                      key={n._id}
                      onClick={() => !n.read && markReadMut.mutate(n._id)}
                      className={[
                        "w-full text-left px-4 py-3 hover:bg-[var(--color-surface)] transition-colors",
                        !n.read ? "bg-[var(--color-primary-light)]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {!n.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                            )}
                            <span className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
                              {TYPE_LABELS[n.type] ?? n.type}
                            </span>
                          </div>
                          <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] truncate">
                            {n.title}
                          </p>
                          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] line-clamp-2 mt-0.5">
                            {n.message}
                          </p>
                        </div>
                        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] shrink-0 mt-0.5">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

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

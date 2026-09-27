"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Search, Shield } from "lucide-react";
import { rolesApi } from "@/api/roles.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import type { AdminRole } from "@/types/admin";

interface PermissionEntry {
  key: string;
  group: string;
  description: string;
}

const GROUP_LABELS: Record<string, string> = {
  users:           "Users",
  roles:           "Roles",
  permissions:     "Permissions",
  products:        "Products",
  categories:      "Categories",
  inventory:       "Inventory",
  orders:          "Orders",
  coupons:         "Coupons",
  prescriptions:   "Prescriptions",
  compounding:     "Compounding",
  "ask-pharmacist":"Ask Pharmacist",
  "minor-ailments":"Minor Ailments",
  appointments:    "Appointments",
  vaccines:        "Vaccines",
  clinics:         "Clinics",
  partners:        "Pharmacy Partners",
  reports:         "Reports",
  audit:           "Audit",
  notifications:   "Notifications",
  content:         "Content",
  settings:        "Settings",
};

const GROUP_ORDER = Object.keys(GROUP_LABELS);

function groupBy<T extends { group: string }>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});
}

function rolesForPermission(key: string, roles: AdminRole[]): AdminRole[] {
  return roles.filter((r) => r.permissions.includes(key));
}

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: permissions, isLoading: loadingPerms } = useQuery({
    queryKey: ["permissions"],
    queryFn: rolesApi.listPermissions,
  });

  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
  });

  const filtered = useMemo<PermissionEntry[]>(() => {
    if (!permissions) return [];
    const q = search.toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q),
    );
  }, [permissions, search]);

  const grouped = useMemo(() => groupBy(filtered), [filtered]);

  const isLoading = loadingPerms || loadingRoles;

  const sortedGroups = useMemo(() => {
    const present = Object.keys(grouped);
    return [
      ...GROUP_ORDER.filter((g) => present.includes(g)),
      ...present.filter((g) => !GROUP_ORDER.includes(g)),
    ];
  }, [grouped]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Permissions"
        description={`${permissions?.length ?? 0} permissions across ${Object.keys(grouped).length} groups`}
        onRefresh={() => Promise.all([
          qc.invalidateQueries({ queryKey: ["permissions"] }),
          qc.invalidateQueries({ queryKey: ["roles"] }),
        ])}
        filters={
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permissions…"
              className="w-full pl-9 pr-4 py-2 text-[var(--font-size-sm)] border border-[var(--color-border)]
                         rounded-[var(--radius-md)] bg-[var(--color-white)] text-[var(--color-text-primary)]
                         placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]
                         focus:ring-2 focus:ring-[var(--color-primary-light)]"
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Key size={40} className="text-[var(--color-text-muted)]" />}
          title="No permissions found"
          description={search ? "Try a different search term." : "No permissions are registered."}
        />
      ) : (
        <div className="space-y-6">
          {sortedGroups.map((group) => {
            const perms = grouped[group] ?? [];
            return (
              <div key={group} className="bg-[var(--color-white)] rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-[var(--space-5)] py-[var(--space-3)] bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <Shield size={15} className="text-[var(--color-primary)]" />
                  <span className="font-[var(--font-weight-semibold)] text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
                    {GROUP_LABELS[group] ?? group}
                  </span>
                  <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-[var(--radius-full)] bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[var(--font-size-xs)] font-[var(--font-weight-semibold)]">
                    {perms.length}
                  </span>
                </div>

                {/* Permission rows */}
                <div className="divide-y divide-[var(--color-border)]">
                  {perms.map((perm) => {
                    const assignedRoles = rolesForPermission(perm.key, roles ?? []);
                    return (
                      <div
                        key={perm.key}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 px-[var(--space-5)] py-[var(--space-3)]"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-[var(--font-size-xs)] font-[var(--font-weight-medium)] text-[var(--color-primary)] truncate">
                            {perm.key}
                          </p>
                          <p className="mt-0.5 text-[var(--font-size-sm)] text-[var(--color-text-secondary)] truncate">
                            {perm.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 justify-end max-w-[260px]">
                          {assignedRoles.length === 0 ? (
                            <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] italic">
                              No roles
                            </span>
                          ) : (
                            assignedRoles.map((r) => (
                              <span
                                key={r._id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-full)]
                                           bg-[var(--color-primary-light)] text-[var(--color-primary)]
                                           text-[var(--font-size-xs)] font-[var(--font-weight-medium)]"
                              >
                                <Shield size={10} />
                                {r.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

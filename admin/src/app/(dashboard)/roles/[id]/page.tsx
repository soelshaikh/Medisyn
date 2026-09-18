"use client";

import { use, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { rolesApi } from "@/api/roles.api";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowLeft, Check } from "lucide-react";

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: role, isLoading: loadingRole } = useQuery({
    queryKey: ["role", id],
    queryFn:  () => rolesApi.getById(id),
  });

  const { data: allPerms, isLoading: loadingPerms } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn:  rolesApi.listPermissions,
  });

  useEffect(() => {
    if (role) setSelected(role.permissions);
  }, [role]);

  const saveMut = useMutation({
    mutationFn: () => rolesApi.setPermissions(id, selected),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["role", id] }),
  });

  const toggle = (key: string) =>
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const toggleGroup = (keys: string[]) => {
    const allOn = keys.every((k) => selected.includes(k));
    setSelected((prev) =>
      allOn ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])]
    );
  };

  if (loadingRole || loadingPerms) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }
  if (!role || !allPerms) return null;

  const groups = allPerms.reduce<Record<string, Array<{ key: string; description: string }>>>((acc, p) => {
    (acc[p.group] ??= []).push({ key: p.key, description: p.description });
    return acc;
  }, {});

  const isDirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...role.permissions].sort());

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{role.name}</h1>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            {selected.length} of {allPerms.length} permissions enabled
          </p>
        </div>
        <Button
          loading={saveMut.isPending}
          disabled={!isDirty || role.isSystem}
          onClick={() => saveMut.mutate()}
        >
          Save Changes
        </Button>
      </div>

      {role.isSystem && (
        <div className="bg-[var(--color-info-light)] border border-[var(--color-info)] rounded-[var(--radius-md)] px-4 py-3 text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
          This is a system role. Permissions can be viewed but not edited.
        </div>
      )}

      {/* Permission groups */}
      <div className="space-y-4">
        {Object.entries(groups).map(([group, perms]) => {
          const groupKeys    = perms.map((p) => p.key);
          const allSelected  = groupKeys.every((k) => selected.includes(k));
          const someSelected = groupKeys.some((k)  => selected.includes(k));

          return (
            <div key={group} className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => !role.isSystem && toggleGroup(groupKeys)}
                    disabled={role.isSystem}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer disabled:cursor-default"
                  />
                  <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)] capitalize">
                    {group.replace(/-/g, " ")}
                  </span>
                  <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                    {groupKeys.filter((k) => selected.includes(k)).length}/{groupKeys.length}
                  </span>
                </div>
              </div>

              {/* Permissions */}
              <div className="divide-y divide-[var(--color-border)]">
                {perms.map((p) => (
                  <label
                    key={p.key}
                    className={[
                      "flex items-center gap-4 px-5 py-3 transition-colors",
                      role.isSystem ? "cursor-default" : "cursor-pointer hover:bg-[var(--color-surface)]",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.key)}
                      onChange={() => !role.isSystem && toggle(p.key)}
                      disabled={role.isSystem}
                      className="w-4 h-4 accent-[var(--color-primary)] shrink-0 disabled:cursor-default"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--font-size-sm)] font-mono text-[var(--color-text-primary)]">{p.key}</p>
                      <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{p.description}</p>
                    </div>
                    {selected.includes(p.key) && (
                      <Check size={14} className="text-[var(--color-success)] shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

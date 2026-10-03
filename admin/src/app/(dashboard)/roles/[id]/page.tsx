"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "@/api/roles.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Check, Search, X } from "lucide-react";

type FilterMode = "all" | "enabled" | "disabled";
type SortMode   = "az" | "za" | "most" | "least";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "az",    label: "Group A–Z"         },
  { value: "za",    label: "Group Z–A"         },
  { value: "most",  label: "Most enabled first" },
  { value: "least", label: "Least enabled first"},
];

export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();

  const [selected, setSelected] = useState<string[]>([]);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<FilterMode>("all");
  const [sort,     setSort]     = useState<SortMode>("az");

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

  /* ── Derived: filtered + sorted groups ── */
  const groups = useMemo(() => {
    if (!allPerms) return {} as Record<string, Array<{ key: string; description: string }>>;
    const q = search.toLowerCase();

    return allPerms.reduce<Record<string, Array<{ key: string; description: string }>>>(
      (acc, p) => {
        /* search filter */
        if (q && !p.key.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
          return acc;
        }
        /* enabled/disabled filter */
        const isEnabled = selected.includes(p.key);
        if (filter === "enabled"  && !isEnabled) return acc;
        if (filter === "disabled" &&  isEnabled) return acc;

        (acc[p.group] ??= []).push({ key: p.key, description: p.description });
        return acc;
      },
      {},
    );
  }, [allPerms, search, filter, selected]);

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(groups);
    return entries.sort(([ga, pa], [gb, pb]) => {
      switch (sort) {
        case "za":    return gb.localeCompare(ga);
        case "most":  return pb.filter((p) => selected.includes(p.key)).length
                           - pa.filter((p) => selected.includes(p.key)).length;
        case "least": return pa.filter((p) => selected.includes(p.key)).length
                           - pb.filter((p) => selected.includes(p.key)).length;
        default:      return ga.localeCompare(gb);
      }
    });
  }, [groups, sort, selected]);

  const hasFilter = search !== "" || filter !== "all" || sort !== "az";

  const clearFilters = () => { setSearch(""); setFilter("all"); setSort("az"); };

  if (loadingRole || loadingPerms) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }
  if (!role || !allPerms) return null;

  const isDirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...role.permissions].sort());

  const totalVisible = sortedEntries.reduce((sum, [, perms]) => sum + perms.length, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title={role.name}
        description={`${selected.length} of ${allPerms.length} permissions enabled`}
        onBack="auto"
        actions={
          <Button
            loading={saveMut.isPending}
            disabled={!isDirty}
            onClick={() => saveMut.mutate()}
          >
            Save Changes
          </Button>
        }
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions…"
            className="w-full pl-9 pr-9 py-2 text-[var(--font-size-sm)] border border-[var(--color-border)]
                       rounded-[var(--radius-md)] bg-[var(--color-white)] text-[var(--color-text-primary)]
                       placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]
                       focus:ring-2 focus:ring-[var(--color-primary-light)]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-white)] p-1 shrink-0">
          {(["all", "enabled", "disabled"] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "px-3 py-1 rounded-[var(--radius-sm)] text-[var(--font-size-xs)] font-medium transition-colors capitalize",
                filter === f
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="shrink-0 w-44">
          <Select
            value={sort}
            onChange={(v) => setSort(v as SortMode)}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      {/* Active filter summary */}
      {hasFilter && (
        <div className="flex items-center justify-between text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          <span>
            Showing <strong className="text-[var(--color-text-primary)]">{totalVisible}</strong> of{" "}
            <strong className="text-[var(--color-text-primary)]">{allPerms.length}</strong> permissions
          </span>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium"
          >
            <X size={11} /> Clear filters
          </button>
        </div>
      )}

      {/* No results */}
      {sortedEntries.length === 0 && (
        <div className="text-center py-16 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
          No permissions match your search or filter.
        </div>
      )}

      {/* Permission groups */}
      <div className="space-y-4">
        {sortedEntries.map(([group, perms]) => {
          const groupKeys    = perms.map((p) => p.key);
          const allSelected  = groupKeys.every((k) => selected.includes(k));
          const someSelected = groupKeys.some((k)  => selected.includes(k));
          const enabledCount = groupKeys.filter((k) => selected.includes(k)).length;

          return (
            <div
              key={group}
              className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden"
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleGroup(groupKeys)}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                  <span className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)] capitalize">
                    {group.replace(/-/g, " ")}
                  </span>
                  <span className={[
                    "text-[var(--font-size-xs)] px-2 py-0.5 rounded-[var(--radius-full)] font-medium",
                    enabledCount > 0
                      ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)]",
                  ].join(" ")}>
                    {enabledCount}/{groupKeys.length}
                  </span>
                </div>
              </div>

              {/* Permissions */}
              <div className="divide-y divide-[var(--color-border)]">
                {perms.map((p) => {
                  const isEnabled = selected.includes(p.key);
                  /* highlight matching search text */
                  const q = search.toLowerCase();
                  const highlightKey = q && p.key.toLowerCase().includes(q);
                  const highlightDesc = q && p.description.toLowerCase().includes(q);

                  return (
                    <label
                      key={p.key}
                      className={[
                        "flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer hover:bg-[var(--color-surface)]",
                        isEnabled ? "bg-[var(--color-primary-light)]/30" : "",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggle(p.key)}
                        className="w-4 h-4 accent-[var(--color-primary)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={[
                          "text-[var(--font-size-sm)] font-mono",
                          highlightKey
                            ? "text-[var(--color-primary)] font-semibold"
                            : "text-[var(--color-text-primary)]",
                        ].join(" ")}>
                          {p.key}
                        </p>
                        <p className={[
                          "text-[var(--font-size-xs)]",
                          highlightDesc
                            ? "text-[var(--color-text-secondary)] font-medium"
                            : "text-[var(--color-text-muted)]",
                        ].join(" ")}>
                          {p.description}
                        </p>
                      </div>
                      {isEnabled && (
                        <Check size={14} className="text-[var(--color-success)] shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

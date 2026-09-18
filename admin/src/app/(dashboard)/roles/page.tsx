"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { rolesApi } from "@/api/roles.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Shield, Trash2 } from "lucide-react";
import type { AdminRole } from "@/types/admin";

export default function RolesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);
  const [name, setName]               = useState("");
  const [slug, setSlug]               = useState("");
  const [desc, setDesc]               = useState("");

  const { data: roles, isLoading } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });

  const createMut = useMutation({
    mutationFn: () => rolesApi.create({ name, slug, description: desc }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setCreateOpen(false);
      setName(""); setSlug(""); setDesc("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["roles"] }); setDeleteTarget(null); },
  });

  const columns: Column<AdminRole>[] = [
    {
      key: "name", header: "Role",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center">
            <Shield size={14} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{r.name}</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] font-mono">{r.slug}</p>
          </div>
        </div>
      ),
    },
    { key: "desc",  header: "Description", render: (r) => <span className="text-[var(--color-text-secondary)]">{r.description || "—"}</span> },
    { key: "perms", header: "Permissions",  render: (r) => (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[var(--font-size-xs)] font-semibold">
        {r.permissions.length}
      </span>
    )},
    { key: "system", header: "Type", render: (r) => (
      <span className={[
        "text-[var(--font-size-xs)] font-medium px-2 py-0.5 rounded-[var(--radius-sm)]",
        r.isSystem
          ? "bg-[var(--color-info-light)] text-[var(--color-info)]"
          : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
      ].join(" ")}>
        {r.isSystem ? "System" : "Custom"}
      </span>
    )},
    {
      key: "actions", header: "", width: "120px",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/roles/${r._id}`}
            className="text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)] hover:underline"
          >
            Edit permissions
          </Link>
          {!r.isSystem && (
            <button
              onClick={() => setDeleteTarget(r)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors ml-1"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles"
        description="Manage admin roles and their permission bundles"
        actions={<Button onClick={() => setCreateOpen(true)}>Create Role</Button>}
      />

      <DataTable columns={columns} data={roles ?? []} loading={isLoading} keyFn={(r) => r._id} />

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Role">
        <div className="space-y-4">
          <Input label="Role Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pharmacist" />
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
            placeholder="e.g. pharmacist"
            hint="Lowercase, underscores only"
          />
          <Input label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description" />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={createMut.isPending} disabled={!name || !slug} onClick={() => createMut.mutate()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Role">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget._id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

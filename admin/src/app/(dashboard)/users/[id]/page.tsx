"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { usersApi } from "@/api/users.api";
import { rolesApi } from "@/api/roles.api";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowLeft } from "lucide-react";

const USER_STATUSES = ["active", "suspended", "deactivated"];

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const router = useRouter();
  const [statusModal, setStatusModal] = useState(false);
  const [roleModal,   setRoleModal]   = useState(false);
  const [newStatus,   setNewStatus]   = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin-user", id],
    queryFn:  () => usersApi.getById(id),
  });

  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });

  const statusMut = useMutation({
    mutationFn: () => usersApi.updateStatus(id, newStatus),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-user", id] }); setStatusModal(false); },
  });

  const roleMut = useMutation({
    mutationFn: () => usersApi.updateRoles(id, selectedRoles),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-user", id] }); setRoleModal(false); },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!user) return <p className="text-[var(--color-text-muted)]">User not found.</p>;

  const userRoleIds = (user.roles as Array<{ _id: string } | string>).map((r) =>
    typeof r === "string" ? r : r._id
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{user.fullName}</h1>
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">{user.email}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={user.status} /></div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">Account Details</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[var(--font-size-sm)]">
          {[
            ["Role",           (user.role as string).replace(/_/g, " ")],
            ["Status",         user.status],
            ["Email Verified", user.emailVerified ? "Yes" : "No"],
            ["Phone",          user.phone || "—"],
            ["Joined",         new Date(user.createdAt).toLocaleDateString("en-CA")],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[var(--color-text-muted)]">{k}</dt>
              <dd className="font-medium text-[var(--color-text-primary)] capitalize mt-0.5">{v as string}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Roles card */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Admin Roles</h2>
          <Button size="sm" variant="outline" onClick={() => { setSelectedRoles(userRoleIds); setRoleModal(true); }}>
            Edit Roles
          </Button>
        </div>
        {userRoleIds.length === 0 ? (
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No admin roles assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(user.roles as Array<{ _id: string; name: string } | string>).map((r) => (
              <span key={typeof r === "string" ? r : r._id}
                className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-[var(--radius-full)] text-[var(--font-size-xs)] font-medium">
                {typeof r === "string" ? r : r.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-sm)]">
        <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">Account Actions</h2>
        <Button variant="outline" onClick={() => { setNewStatus(user.status as string); setStatusModal(true); }}>
          Change Status
        </Button>
      </div>

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change User Status">
        <div className="space-y-4">
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[var(--font-size-sm)]"
          >
            {USER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button loading={statusMut.isPending} onClick={() => statusMut.mutate()}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Role assignment modal */}
      <Modal open={roleModal} onClose={() => setRoleModal(false)} title="Assign Roles">
        <div className="space-y-4">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(roles ?? []).map((role) => (
              <label key={role._id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role._id)}
                  onChange={(e) => setSelectedRoles(
                    e.target.checked
                      ? [...selectedRoles, role._id]
                      : selectedRoles.filter((r) => r !== role._id)
                  )}
                  className="rounded"
                />
                <div>
                  <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">{role.name}</p>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">{role.description}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setRoleModal(false)}>Cancel</Button>
            <Button loading={roleMut.isPending} onClick={() => roleMut.mutate()}>Save Roles</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

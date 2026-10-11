"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield } from "lucide-react";
import { platformApi } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

export default function SuperAdminsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "" });
  const [err,  setErr]  = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-super-admins"],
    queryFn:  platformApi.listSuperAdmins,
  });

  const create = useMutation({
    mutationFn: () => platformApi.createSuperAdmin(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-super-admins"] });
      setShowModal(false);
      setForm({ email: "", password: "", firstName: "", lastName: "" });
      setErr("");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setErr(msg ?? "Failed to create super admin");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Super Admins" description="Platform administrators with full access" />
        <Button onClick={() => setShowModal(true)}>
          <Plus size={15} className="mr-1.5" /> Add Super Admin
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {data && (
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
          {data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Shield size={32} className="text-[var(--color-text-muted)]" />
              <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">No super admins yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  {["Name", "Email", "Created", "Last login"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3 text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{u.email}</td>
                    <td className="px-4 py-3 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                      {new Date(u.createdAt).toLocaleDateString("en-CA")}
                    </td>
                    <td className="px-4 py-3 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-CA") : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <Modal open={showModal} title="Add Super Admin" onClose={() => { setShowModal(false); setErr(""); }}>
          <form
            onSubmit={(e) => { e.preventDefault(); setErr(""); create.mutate(); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input label="Last name"  value={form.lastName}  onChange={(e) => setForm({ ...form, lastName:  e.target.value })} required />
            </div>
            <Input label="Email"    type="email"    value={form.email}    onChange={(e) => setForm({ ...form, email:    e.target.value })} required />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            {err && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{err}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={create.isPending}>Create</Button>
              <Button type="button" variant="outline" onClick={() => { setShowModal(false); setErr(""); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

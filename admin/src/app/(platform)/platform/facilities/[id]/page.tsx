"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Users, Shield, UserPlus } from "lucide-react";
import { platformApi, type FacilitySeatResource } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

const ROLE_OPTIONS = [
  { value: "admin",       label: "Admin",      description: "Full facility management access" },
  { value: "pharmacist",  label: "Pharmacist",  description: "Clinical workflows and patient care" },
  { value: "staff",       label: "Staff",       description: "Day-to-day operational tasks" },
];

const SEAT_LABELS: Record<string, string> = {
  admin_seats:      "Admin",
  staff_seats:      "Staff",
  pharmacist_seats: "Pharmacist",
};

function SeatBar({ used, limit }: { used: number; limit: number }) {
  if (limit === -1) {
    return (
      <span className="text-[var(--font-size-xs)] tabular-nums text-[var(--color-text-muted)]">
        {used} <span className="text-[var(--color-text-muted)] opacity-50">/ —</span>
      </span>
    );
  }
  const pct = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const full = used >= limit;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[var(--color-surface)] overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all ${full ? "bg-[var(--color-error)]" : "bg-[var(--color-primary)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[var(--font-size-xs)] tabular-nums shrink-0 ${full ? "text-[var(--color-error)]" : "text-[var(--color-text-muted)]"}`}>
        {used} / {limit}
      </span>
    </div>
  );
}

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: facility, isLoading, isError } = useQuery({
    queryKey: ["platform-facility", id],
    queryFn:  () => platformApi.getFacility(id),
    enabled:  !!id,
  });

  const { data: plans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn:  platformApi.plans,
  });

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["platform-facility-staff", id],
    queryFn:  () => platformApi.listFacilityStaff(id),
    enabled:  !!id,
  });

  const { data: seatConfig, isLoading: seatsLoading } = useQuery({
    queryKey: ["platform-facility-seats", id],
    queryFn:  () => platformApi.getFacilitySeatConfig(id),
    enabled:  !!id,
  });

  // ── Details form ──
  const [name,   setName]   = useState<string | undefined>();
  const [planId, setPlanId] = useState<string | undefined>();
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  const update = useMutation({
    mutationFn: (body: { name?: string; planId?: string }) => platformApi.updateFacility(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-facility", id] });
      qc.invalidateQueries({ queryKey: ["platform-facilities"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setName(undefined);
      setPlanId(undefined);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErr(msg ?? "Update failed");
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => platformApi.updateFacility(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-facility", id] }),
  });

  // ── Seat overrides ──
  const [seatInputs, setSeatInputs] = useState<Record<string, string>>({});

  const saveSeat = useMutation({
    mutationFn: ({ resourceKey, limitValue }: { resourceKey: string; limitValue: number }) =>
      platformApi.setFacilitySeatOverride(id, { resourceKey, limitValue }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-facility-seats", id] });
    },
  });

  function getSeatInput(seat: FacilitySeatResource): string {
    return seatInputs[seat.resourceKey] !== undefined
      ? seatInputs[seat.resourceKey]
      : seat.overrideLimit !== null
        ? String(seat.overrideLimit)
        : "";
  }

  // ── Add staff modal ──
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ firstName: "", lastName: "", email: "", password: "", roleName: "" });
  const [staffErr, setStaffErr] = useState("");

  const createStaff = useMutation({
    mutationFn: () => platformApi.createFacilityStaff(id, {
      email:     staffForm.email,
      password:  staffForm.password,
      firstName: staffForm.firstName,
      lastName:  staffForm.lastName,
      roleName:  staffForm.roleName,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-facility-staff", id] });
      qc.invalidateQueries({ queryKey: ["platform-facility-seats", id] });
      qc.invalidateQueries({ queryKey: ["platform-facility", id] });
      setShowAddStaff(false);
      setStaffForm({ firstName: "", lastName: "", email: "", password: "", roleName: "" });
      setStaffErr("");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setStaffErr(msg ?? "Failed to create user");
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (isError || !facility) return <p className="text-[var(--color-error)]">Facility not found.</p>;

  const displayName   = name   ?? facility.name;
  const displayPlanId = planId ?? facility.planId;
  const hasChanges    = name !== undefined || planId !== undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/platform/facilities" className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <PageHeader title={facility.name} description={`slug: ${facility.slug}`} />
        <div className="ml-auto shrink-0"><StatusBadge status={facility.status} size="md" /></div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-5">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Facility details</h2>

        <Input label="Name" value={displayName} onChange={(e) => setName(e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Slug</label>
            <code className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
              {facility.slug}
            </code>
          </div>
          <div>
            <label className="block text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] mb-1.5">Prefix</label>
            <code className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
              {facility.prefix ?? <span className="opacity-40">not set</span>}
            </code>
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] -mt-2">Slug and prefix cannot be changed after creation</p>

        <Select
          label="Subscription plan"
          value={displayPlanId ?? ""}
          onChange={(v) => setPlanId(v)}
          options={(plans ?? []).filter((p) => p.isActive).map((p) => ({
            value: p.id, label: p.name, description: p.description ?? undefined,
          }))}
          placeholder="Select a plan…"
        />

        <div className="grid grid-cols-2 gap-4 text-[var(--font-size-sm)]">
          <div>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide font-medium mb-0.5">Users</p>
            <p className="font-semibold text-[var(--color-text-primary)]">{facility.userCount}</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide font-medium mb-0.5">Created</p>
            <p className="font-semibold text-[var(--color-text-primary)]">{new Date(facility.createdAt).toLocaleDateString("en-CA")}</p>
          </div>
        </div>

        {err && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{err}</p>}
        {saved && <p className="text-[var(--font-size-sm)] text-[var(--color-success)]">Saved successfully.</p>}

        <Button disabled={!hasChanges} loading={update.isPending} onClick={() => { setErr(""); update.mutate({ name: name?.trim(), planId }); }}>
          Save changes
        </Button>
      </div>

      {/* Seat configuration */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border)]">
          <Shield size={14} className="text-[var(--color-primary)]" />
          <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Seat limits</h2>
        </div>

        {seatsLoading && <div className="p-4"><Spinner size="sm" /></div>}

        {seatConfig && (
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-surface)]">
                {["Role", "Usage", "Plan default", "Override", ""].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seatConfig.map((seat) => {
                const inputVal = getSeatInput(seat);
                const hasOverride = seat.overrideLimit !== null;
                return (
                  <tr key={seat.resourceKey} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                          {SEAT_LABELS[seat.resourceKey] ?? seat.resourceKey}
                        </span>
                        {hasOverride && <Badge variant="warning" size="sm" dot>Custom</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <SeatBar used={seat.currentUsage} limit={seat.effectiveLimit} />
                    </td>
                    <td className="px-4 py-3 text-[var(--font-size-xs)] text-[var(--color-text-muted)] whitespace-nowrap">
                      {seat.planLimit === -1 ? <span className="text-[var(--color-text-muted)] opacity-50">Not set</span> : seat.planLimit}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={inputVal}
                        placeholder={seat.overrideLimit !== null ? String(seat.overrideLimit) : "—"}
                        onChange={(e) => setSeatInputs((prev) => ({ ...prev, [seat.resourceKey]: e.target.value }))}
                        className="w-16 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-2 py-1 text-[var(--font-size-sm)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={saveSeat.isPending}
                        disabled={!inputVal}
                        onClick={() => {
                          const parsed = parseInt(inputVal, 10);
                          if (!isNaN(parsed)) {
                            saveSeat.mutate({ resourceKey: seat.resourceKey, limitValue: parsed });
                            setSeatInputs((prev) => { const n = { ...prev }; delete n[seat.resourceKey]; return n; });
                          }
                        }}
                      >
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Staff members */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[var(--color-primary)]" />
            <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Staff members</h2>
          </div>
          <Button size="sm" onClick={() => setShowAddStaff(true)}>
            <UserPlus size={13} className="mr-1.5" />Add staff
          </Button>
        </div>

        {staffLoading && <Spinner size="sm" />}

        {staff && staff.length === 0 && (
          <div className="text-center py-8">
            <Users size={28} className="mx-auto text-[var(--color-text-muted)] mb-2" />
            <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">No staff yet</p>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-1">
              Add an admin first — they can then manage day-to-day staff from the facility panel.
            </p>
          </div>
        )}

        {staff && staff.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                {["Name", "Email", "Role", "Status", "Joined"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.healthProfessionalId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-3 py-2.5 text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--font-size-xs)] text-[var(--color-text-secondary)]">
                    {m.email}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((role) => (
                        <Badge key={role} variant={role === "facility_admin" ? "primary" : "default"} size="sm">
                          {role === "facility_admin" ? "Admin" : role.charAt(0).toUpperCase() + role.slice(1)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={m.isActive ? "active" : "deactivated"} />
                  </td>
                  <td className="px-3 py-2.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)] whitespace-nowrap">
                    {new Date(m.joinedAt).toLocaleDateString("en-CA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status management */}
      <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 space-y-4">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Status management</h2>
        <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          Current status: <strong className="capitalize">{facility.status}</strong>. Suspending prevents staff and patients from accessing this facility.
        </p>
        <div className="flex gap-3 flex-wrap">
          {facility.status !== "active" && (
            <Button size="sm" onClick={() => setStatus.mutate("active")} loading={setStatus.isPending}>Activate</Button>
          )}
          {facility.status === "active" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("suspended")} loading={setStatus.isPending}>Suspend</Button>
          )}
          {facility.status !== "deactivated" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("deactivated")} loading={setStatus.isPending}>Deactivate</Button>
          )}
        </div>
      </div>

      {/* Quick login link */}
      <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-[var(--radius-lg)] px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">Access facility panel</p>
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-secondary)] mt-0.5">
            Log in as super admin into this facility to manage its data
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href={`/login?facility=${facility.slug}`}>
            <ExternalLink size={13} className="mr-1.5" /> Open
          </Link>
        </Button>
      </div>

      {/* Add Staff Modal */}
      <Modal open={showAddStaff} onClose={() => { setShowAddStaff(false); setStaffErr(""); }} title="Add Staff Member">
        <div className="space-y-4">
          <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
            Create a new account and assign it to this facility. The user will be able to log in immediately.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              value={staffForm.firstName}
              onChange={(e) => setStaffForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              value={staffForm.lastName}
              onChange={(e) => setStaffForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={staffForm.email}
            onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
          />

          <Input
            label="Password"
            type="password"
            value={staffForm.password}
            onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
            hint="Minimum 8 characters"
          />

          <Select
            label="Role"
            value={staffForm.roleName}
            onChange={(v) => setStaffForm((f) => ({ ...f, roleName: v }))}
            options={ROLE_OPTIONS}
            placeholder="Select a role…"
          />

          {staffErr && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{staffErr}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              loading={createStaff.isPending}
              disabled={!staffForm.email || !staffForm.password || !staffForm.roleName || !staffForm.firstName}
              onClick={() => { setStaffErr(""); createStaff.mutate(); }}
              className="flex-1"
            >
              Create account
            </Button>
            <Button variant="outline" onClick={() => { setShowAddStaff(false); setStaffErr(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

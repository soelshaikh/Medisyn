"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { couponsApi } from "@/api/products.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { AdminCoupon } from "@/types/admin";
import { fmtDate } from "@/lib/format";

function fmtCAD(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

interface CouponForm {
  code:           string;
  discountType:   string;
  discountValue:  string;
  minOrderAmount: string;
  usageLimit:     string;
  firstOrderOnly: boolean;
  expiresAt:      string;
}
const BLANK: CouponForm = {
  code: "", discountType: "percentage", discountValue: "",
  minOrderAmount: "", usageLimit: "", firstOrderOnly: false, expiresAt: "",
};

export default function CouponsPage() {
  const qc = useQueryClient();

  const [modal,        setModal]        = useState(false);
  const [editing,      setEditing]      = useState<AdminCoupon | null>(null);
  const [form,         setForm]         = useState<CouponForm>(BLANK);
  const [error,        setError]        = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminCoupon | null>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn:  () => couponsApi.list({ limit: 100 }),
  });

  const save = useMutation({
    mutationFn: () => {
      const val = parseFloat(form.discountValue);
      if (isNaN(val) || val <= 0) throw new Error("Enter a valid discount value.");
      const payload: Record<string, unknown> = {
        code:           form.code.trim().toUpperCase(),
        type:           form.discountType,
        value:          form.discountType === "percentage" ? val : Math.round(val * 100),
        firstOrderOnly: form.firstOrderOnly,
      };
      if (form.minOrderAmount) payload.minOrderAmount = Math.round(parseFloat(form.minOrderAmount) * 100);
      if (form.usageLimit)     payload.usageLimit     = parseInt(form.usageLimit, 10);
      if (form.expiresAt)      payload.expiresAt      = new Date(form.expiresAt).toISOString();
      return editing ? couponsApi.update(editing._id, payload) : couponsApi.create(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setModal(false); setEditing(null); setForm(BLANK);
    },
    onError: (e: Error) => setError(e.message ?? "Failed to save coupon."),
  });

  const del = useMutation({
    mutationFn: (id: string) => couponsApi.delete(id),
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setDeleteTarget(null); },
  });

  function openAdd() { setEditing(null); setForm(BLANK); setError(""); setModal(true); }
  function openEdit(c: AdminCoupon) {
    setEditing(c);
    setForm({
      code:           c.code,
      discountType:   c.type,
      discountValue:  c.type === "percentage" ? String(c.value) : String((c.value / 100).toFixed(2)),
      minOrderAmount: c.minOrderAmount ? String((c.minOrderAmount / 100).toFixed(2)) : "",
      usageLimit:     c.usageLimit ? String(c.usageLimit) : "",
      firstOrderOnly: c.firstOrderOnly,
      expiresAt:      c.expiresAt ? c.expiresAt.slice(0, 10) : "",
    });
    setError(""); setModal(true);
  }

  const cols: Column<AdminCoupon>[] = [
    {
      key: "code", header: "Code",
      render: (c) => <span className="font-mono font-semibold text-[var(--color-text-primary)]">{c.code}</span>,
    },
    {
      key: "type", header: "Type", width: "130px",
      render: (c) => <span className="capitalize text-[var(--font-size-xs)] text-[var(--color-text-secondary)]">{c.type?.replace(/_/g, " ")}</span>,
    },
    {
      key: "value", header: "Value", width: "100px",
      render: (c) => (
        <span className="font-semibold text-[var(--color-text-primary)]">
          {c.type === "percentage" ? `${c.value}%` : fmtCAD(c.value)}
        </span>
      ),
    },
    {
      key: "used", header: "Used", width: "80px",
      render: (c) => (
        <span className="text-[var(--color-text-secondary)]">
          {c.usageCount}{c.usageLimit ? `/${c.usageLimit}` : ""}
        </span>
      ),
    },
    {
      key: "expiry", header: "Expires", width: "110px",
      render: (c) => (
        <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
          {c.expiresAt ? fmtDate(c.expiresAt) : "Never"}
        </span>
      ),
    },
    {
      key: "status", header: "Status", width: "80px",
      render: (c) => (
        <span className={[
          "text-[var(--font-size-xs)] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)]",
          c.isActive
            ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
            : "bg-[var(--color-surface)] text-[var(--color-text-muted)]",
        ].join(" ")}>
          {c.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "80px",
      render: (c) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(c)} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(c)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  const list  = (coupons as AdminCoupon[] | undefined) ?? [];
  const total = list.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Coupons"
        description={`${total} coupon${total === 1 ? "" : "s"}`}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["admin-coupons"] })}
        actions={
          <Button onClick={openAdd}>
            <Plus size={14} className="mr-1.5" /> Add Coupon
          </Button>
        }
      />

      <DataTable
        columns={cols}
        data={list}
        loading={isLoading}
        keyFn={(c) => c._id}
        emptyTitle="No coupons yet"
        emptyDescription="Create a coupon code to offer discounts to customers."
      />

      {/* Add / Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Coupon" : "Add Coupon"} width="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Coupon Code *"
              placeholder="SAVE20"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
            <Select
              label="Type"
              value={form.discountType}
              onChange={(v) => setForm((f) => ({ ...f, discountType: v }))}
              options={[
                { value: "percentage",   label: "Percentage (%)" },
                { value: "fixed_amount", label: "Fixed Amount ($)" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={form.discountType === "percentage" ? "Discount % *" : "Discount Amount (CAD) *"}
              type="text"
              inputMode="decimal"
              placeholder={form.discountType === "percentage" ? "20" : "10.00"}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value.replace(/[^0-9.]/g, "") }))}
              hint={form.discountType === "percentage" ? "Enter 20 for 20% off" : "Enter in dollars"}
            />
            <Input
              label="Min Order Amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.minOrderAmount}
              onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value.replace(/[^0-9.]/g, "") }))}
              hint="Leave blank for no minimum"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Usage Limit"
              type="text"
              inputMode="numeric"
              placeholder="Unlimited"
              value={form.usageLimit}
              onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value.replace(/[^0-9]/g, "") }))}
              hint="Leave blank for unlimited"
            />
            <DatePicker
              label="Expiry Date"
              value={form.expiresAt}
              onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))}
              hint="Leave blank for no expiry"
              placeholder="No expiry"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.firstOrderOnly}
              onChange={(e) => setForm((f) => ({ ...f, firstOrderOnly: e.target.checked }))}
              className="w-4 h-4 rounded accent-[var(--color-primary)]"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">First order only</span>
          </label>

          {error && (
            <p className="text-[var(--font-size-xs)] text-[var(--color-error)] bg-[var(--color-error-light)] px-3 py-2 rounded-[var(--radius-md)]">{error}</p>
          )}
          <div className="flex gap-3 justify-end pt-1 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button loading={save.isPending} disabled={!form.code.trim() || !form.discountValue} onClick={() => save.mutate()}>
              {editing ? "Save Changes" : "Add Coupon"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Coupon">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Delete coupon <strong>{deleteTarget?.code}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={del.isPending} onClick={() => deleteTarget && del.mutate(deleteTarget._id)}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

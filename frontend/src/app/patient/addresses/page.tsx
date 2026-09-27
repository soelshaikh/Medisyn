"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Pencil, Trash2, Star, StarOff, X } from "lucide-react";
import { addressesApi, type SavedAddress, type AddressDto } from "@/api/addresses.api";
import { Select } from "@/components/ui/Select";

const PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

const LABELS = ["Home", "Work", "Other"];

const BLANK: AddressDto = {
  label: "Home", fullName: "", phone: "", address1: "", address2: "",
  city: "", province: "ON", postalCode: "", isDefault: false,
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-ink-500";

export default function AddressesPage() {
  const qc = useQueryClient();
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [form, setForm]       = useState<AddressDto>(BLANK);
  const [province, setProvince] = useState("ON");
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);
  const [formError, setFormError] = useState("");

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn:  addressesApi.list,
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? addressesApi.update(editing._id, { ...form, province })
        : addressesApi.add({ ...form, province }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-addresses"] }); closeModal(); },
    onError:   () => setFormError("Failed to save address. Please check all fields."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => addressesApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["my-addresses"] }); setDeleteTarget(null); },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => addressesApi.setDefault(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["my-addresses"] }),
  });

  function openAdd() {
    setEditing(null);
    setForm(BLANK);
    setProvince("ON");
    setFormError("");
    setModal(true);
  }

  function openEdit(addr: SavedAddress) {
    setEditing(addr);
    setForm({
      label: addr.label, fullName: addr.fullName, phone: addr.phone,
      address1: addr.address1, address2: addr.address2, city: addr.city,
      province: addr.province, postalCode: addr.postalCode, isDefault: addr.isDefault,
    });
    setProvince(addr.province);
    setFormError("");
    setModal(true);
  }

  function closeModal() { setModal(false); setEditing(null); setForm(BLANK); setFormError(""); }

  function field(k: keyof AddressDto, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">My Addresses</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your saved delivery and billing addresses.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          <Plus size={15} /> Add Address
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-ink-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <MapPin size={24} className="text-brand-500" />
          </div>
          <div>
            <p className="font-semibold text-ink-700">No saved addresses yet</p>
            <p className="mt-1 text-sm text-slate-500">Add an address to speed up checkout.</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Plus size={14} /> Add your first address
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div
              key={addr._id}
              className={[
                "relative rounded-2xl border bg-white p-5 shadow-sm transition",
                addr.isDefault ? "border-brand-400 ring-1 ring-brand-200" : "border-ink-100",
              ].join(" ")}
            >
              {addr.isDefault && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  <Star size={10} className="fill-brand-500 text-brand-500" /> Default
                </span>
              )}

              <div className="mb-3 flex items-center gap-2">
                <MapPin size={14} className="text-brand-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink-500">{addr.label}</span>
              </div>

              <p className="font-semibold text-ink-900">{addr.fullName}</p>
              <p className="text-sm text-ink-600">{addr.phone}</p>
              <p className="mt-1 text-sm text-ink-700">{addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}</p>
              <p className="text-sm text-ink-700">{addr.city}, {addr.province} · {addr.postalCode}</p>

              <div className="mt-4 flex items-center gap-2 border-t border-ink-50 pt-3">
                {!addr.isDefault && (
                  <button
                    onClick={() => setDefault.mutate(addr._id)}
                    disabled={setDefault.isPending}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-600 transition-colors"
                  >
                    <StarOff size={12} /> Set default
                  </button>
                )}
                <button
                  onClick={() => openEdit(addr)}
                  className="ml-auto flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-brand-600 transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(addr)}
                  className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-ink-900">
                {editing ? "Edit Address" : "Add New Address"}
              </h2>
              <button onClick={closeModal} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Label"
                  value={form.label ?? "Home"}
                  onChange={(v) => field("label", v)}
                  options={LABELS.map((l) => ({ value: l, label: l }))}
                />
                <div>
                  <label className={labelClass}>Full name</label>
                  <input required value={form.fullName} onChange={(e) => field("fullName", e.target.value)} className={fieldClass} placeholder="Jane Doe" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Phone</label>
                <input required type="tel" minLength={7} value={form.phone} onChange={(e) => field("phone", e.target.value)} className={fieldClass} placeholder="(647) 555-0100" />
              </div>

              <div>
                <label className={labelClass}>Address line 1</label>
                <input required value={form.address1} onChange={(e) => field("address1", e.target.value)} className={fieldClass} placeholder="123 Main St" />
              </div>
              <div>
                <label className={labelClass}>Address line 2 (optional)</label>
                <input value={form.address2 ?? ""} onChange={(e) => field("address2", e.target.value)} className={fieldClass} placeholder="Apt, suite, unit…" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>City</label>
                  <input required value={form.city} onChange={(e) => field("city", e.target.value)} className={fieldClass} placeholder="Toronto" />
                </div>
                <Select
                  label="Province"
                  value={province}
                  onChange={setProvince}
                  options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
                />
                <div>
                  <label className={labelClass}>Postal code</label>
                  <input required maxLength={7} value={form.postalCode} onChange={(e) => field("postalCode", e.target.value.toUpperCase())} className={fieldClass} placeholder="M5V 3A8" />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.isDefault ?? false}
                  onChange={(e) => field("isDefault", e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 accent-brand-600"
                />
                <span className="text-sm text-ink-700">Set as default address</span>
              </label>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
                <button type="button" onClick={closeModal} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
                >
                  {save.isPending ? "Saving…" : editing ? "Save Changes" : "Add Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-ink-900">Delete Address?</h2>
            <p className="mt-2 text-sm text-ink-600">
              <span className="font-medium">{deleteTarget.address1}, {deleteTarget.city}</span> will be permanently removed.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => remove.mutate(deleteTarget._id)}
                disabled={remove.isPending}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

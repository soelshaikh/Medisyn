"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type WorkingHours, type Holiday } from "@/api/settings.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TimePicker } from "@/components/ui/TimePicker";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Plus, Pencil, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PROVINCE_OPTIONS = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]
  .map((p) => ({ value: p, label: p }));

const TAB_LABELS = ["Pharmacy Info", "Working Hours", "Holidays", "Policies"] as const;
type Tab = (typeof TAB_LABELS)[number];

/* ── Small section card ── */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
      <div className="border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const qc  = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Pharmacy Info");

  /* ── Fetch settings ── */
  const { data: settings, isLoading, isFetching } = useQuery({
    queryKey: ["admin-settings"],
    queryFn:  settingsApi.get,
  });

  /* ────────────────────────────────── PHARMACY INFO ── */
  const [info, setInfo] = useState({
    pharmacyName:  "",
    phone:         "",
    email:         "",
    address:       "",
    city:          "",
    province:      "ON",
    postalCode:    "",
    licenseNumber: "",
  });
  const [infoSaved,  setInfoSaved]  = useState(false);
  const [infoError,  setInfoError]  = useState("");
  const [infoInit,   setInfoInit]   = useState(false);

  useEffect(() => {
    if (settings && !infoInit) {
      setInfo({
        pharmacyName:  settings.pharmacyName,
        phone:         settings.phone,
        email:         settings.email,
        address:       settings.address,
        city:          settings.city,
        province:      settings.province || "ON",
        postalCode:    settings.postalCode,
        licenseNumber: settings.licenseNumber,
      });
      setInfoInit(true);
    }
  }, [settings, infoInit]);

  const infoMut = useMutation({
    mutationFn: () => settingsApi.updateInfo(info),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setInfoError("");
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 3000);
    },
    onError: () => setInfoError("Failed to save — please try again."),
  });

  /* ────────────────────────────────── WORKING HOURS ── */
  const [hours, setHours] = useState<WorkingHours[]>([]);
  const [hoursInit, setHoursInit] = useState(false);
  const [hoursSaved,  setHoursSaved]  = useState(false);
  const [hoursError,  setHoursError]  = useState("");

  useEffect(() => {
    if (settings && !hoursInit) {
      // Sort by day index and fill missing days
      const filled: WorkingHours[] = DAYS.map((_, day) => {
        const existing = settings.workingHours.find((h) => h.day === day);
        return existing ?? { day, isOpen: false, openTime: "09:00", closeTime: "18:00" };
      });
      setHours(filled);
      setHoursInit(true);
    }
  }, [settings, hoursInit]);

  function setHourField<K extends keyof WorkingHours>(day: number, field: K, value: WorkingHours[K]) {
    setHours((prev) => prev.map((h) => h.day === day ? { ...h, [field]: value } : h));
  }

  const hoursMut = useMutation({
    mutationFn: () => settingsApi.updateHours(hours),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setHoursError("");
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 3000);
    },
    onError: () => setHoursError("Failed to save working hours — please try again."),
  });

  /* ────────────────────────────────── HOLIDAYS ── */
  const [holidayModal,    setHolidayModal]    = useState(false);
  const [editingHoliday,  setEditingHoliday]  = useState<Holiday | null>(null);
  const [deleteHoliday,   setDeleteHoliday]   = useState<Holiday | null>(null);
  const [hForm, setHForm] = useState({ date: "", name: "", isClosed: true });

  function openAddHoliday() {
    setEditingHoliday(null);
    setHForm({ date: "", name: "", isClosed: true });
    setHolidayModal(true);
  }
  function openEditHoliday(h: Holiday) {
    setEditingHoliday(h);
    setHForm({ date: h.date, name: h.name, isClosed: h.isClosed });
    setHolidayModal(true);
  }

  const holidaySave = useMutation({
    mutationFn: () =>
      editingHoliday
        ? settingsApi.updateHoliday(editingHoliday._id, hForm)
        : settingsApi.addHoliday(hForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setHolidayModal(false);
    },
  });

  const holidayDelete = useMutation({
    mutationFn: () => settingsApi.deleteHoliday(deleteHoliday!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setDeleteHoliday(null);
    },
  });

  /* ────────────────────────────────── POLICIES ── */
  const policiesMut = useMutation({
    mutationFn: (data: { emailVerificationRequired?: boolean }) =>
      settingsApi.updatePolicies(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
  });

  /* ────────────────────────────────── RENDER ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Pharmacy information, operating hours and public holidays"
        onRefresh={() => {
          setInfoInit(false);
          setHoursInit(false);
          qc.invalidateQueries({ queryKey: ["admin-settings"] });
        }}
        refreshing={isFetching}
      />

      {/* ── Tab bar ── */}
      <div
        className="flex gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
        style={{ width: "fit-content" }}
      >
        {TAB_LABELS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "rounded-[var(--radius-md)] px-4 py-1.5 text-[var(--font-size-sm)] font-medium transition-colors",
              activeTab === tab
                ? "bg-white text-[var(--color-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ──────────────── PHARMACY INFO TAB ── */}
      {activeTab === "Pharmacy Info" && (
        <Card title="Pharmacy Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Pharmacy Name"
                value={info.pharmacyName}
                onChange={(e) => setInfo((s) => ({ ...s, pharmacyName: e.target.value }))}
                placeholder="MediSyn Compounding Pharmacy"
              />
              <Input
                label="License Number"
                value={info.licenseNumber}
                onChange={(e) => setInfo((s) => ({ ...s, licenseNumber: e.target.value }))}
                placeholder="OCP-XXXXXX"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                value={info.phone}
                onChange={(e) => setInfo((s) => ({ ...s, phone: e.target.value }))}
                placeholder="(416) 555-0100"
              />
              <Input
                label="Email"
                type="email"
                value={info.email}
                onChange={(e) => setInfo((s) => ({ ...s, email: e.target.value }))}
                placeholder="info@medisyn.ca"
              />
            </div>
            <Input
              label="Street Address"
              value={info.address}
              onChange={(e) => setInfo((s) => ({ ...s, address: e.target.value }))}
              placeholder="123 Main Street"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="City"
                value={info.city}
                onChange={(e) => setInfo((s) => ({ ...s, city: e.target.value }))}
                placeholder="Toronto"
              />
              <Select
                label="Province"
                value={info.province}
                onChange={(v) => setInfo((s) => ({ ...s, province: v }))}
                options={PROVINCE_OPTIONS}
              />
              <Input
                label="Postal Code"
                value={info.postalCode}
                onChange={(e) => setInfo((s) => ({ ...s, postalCode: e.target.value.toUpperCase() }))}
                placeholder="M5H 2N2"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              {infoError && (
                <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-error)]">
                  <AlertTriangle size={12} /> {infoError}
                </span>
              )}
              {infoSaved && (
                <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-success)] font-medium">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              <Button loading={infoMut.isPending} onClick={() => infoMut.mutate()}>
                Save Info
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ──────────────── WORKING HOURS TAB ── */}
      {activeTab === "Working Hours" && (
        <Card title="Weekly Hours">
          <div className="space-y-3">
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
              Set your pharmacy&apos;s regular operating hours. Times use 24-hour format (e.g. 09:00, 17:30).
            </p>

            <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
              {hours.map((h) => (
                <div key={h.day} className="flex items-center gap-4 px-4 py-3 bg-white">
                  {/* Day label */}
                  <span
                    className="w-24 shrink-0 text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]"
                  >
                    {DAYS[h.day]}
                  </span>

                  {/* Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={h.isOpen}
                      onChange={(e) => setHourField(h.day, "isOpen", e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-primary)]"
                    />
                    <span className={["text-[var(--font-size-xs)] font-medium w-10", h.isOpen ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"].join(" ")}>
                      {h.isOpen ? "Open" : "Closed"}
                    </span>
                  </label>

                  {/* Time range */}
                  {h.isOpen ? (
                    <div className="flex items-center gap-2 flex-1">
                      <TimePicker
                        value={h.openTime}
                        onChange={(v) => setHourField(h.day, "openTime", v)}
                      />
                      <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">to</span>
                      <TimePicker
                        value={h.closeTime}
                        onChange={(v) => setHourField(h.day, "closeTime", v)}
                      />
                    </div>
                  ) : (
                    <span className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] italic flex-1">Closed all day</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              {hoursError && (
                <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-error)]">
                  <AlertTriangle size={12} /> {hoursError}
                </span>
              )}
              {hoursSaved && (
                <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-success)] font-medium">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              <Button loading={hoursMut.isPending} onClick={() => hoursMut.mutate()}>
                Save Hours
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ──────────────── HOLIDAYS TAB ── */}
      {activeTab === "Holidays" && (
        <Card title="Holidays & Closures">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                Dates when the pharmacy is closed or has modified hours.
              </p>
              <Button size="sm" onClick={openAddHoliday}>
                <Plus size={14} className="mr-1.5" /> Add Holiday
              </Button>
            </div>

            {(settings?.holidays ?? []).length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-10 text-center">
                <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No holidays configured yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
                {(settings?.holidays ?? [])
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h) => (
                    <div key={h._id} className="flex items-center gap-4 px-4 py-3 bg-white">
                      <span className="font-mono text-[var(--font-size-sm)] text-[var(--color-text-secondary)] w-28 shrink-0">{h.date}</span>
                      <span className="flex-1 text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">{h.name}</span>
                      <span className={[
                        "text-[var(--font-size-xs)] font-semibold shrink-0",
                        h.isClosed ? "text-[var(--color-error)]" : "text-[var(--color-warning)]",
                      ].join(" ")}>
                        {h.isClosed ? "Closed" : "Modified hours"}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEditHoliday(h)}
                          className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteHoliday(h)}
                          className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-error-light)] hover:text-[var(--color-error)] transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ──────────────── POLICIES TAB ── */}
      {activeTab === "Policies" && (
        <Card title="Platform Policies">
          <div className="space-y-1">
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mb-4">
              These settings control registration and login behaviour across the platform. Changes take effect immediately.
            </p>

            {/* Policy row */}
            <div className="flex items-start justify-between gap-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                  Require email verification before login
                </p>
                <p className="mt-0.5 text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                  When enabled, new registrants must click the verification link in their email before they can sign in.
                  When disabled, accounts are activated instantly on registration.
                </p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                disabled={policiesMut.isPending}
                onClick={() =>
                  policiesMut.mutate({
                    emailVerificationRequired: !(settings?.emailVerificationRequired ?? false),
                  })
                }
                className={[
                  "relative shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors duration-[var(--transition-base)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1",
                  settings?.emailVerificationRequired
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border)]",
                ].join(" ")}
                aria-label={settings?.emailVerificationRequired ? "Disable email verification" : "Enable email verification"}
              >
                <span
                  className={[
                    "absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-[var(--transition-base)]",
                    settings?.emailVerificationRequired ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Add / Edit holiday modal ── */}
      <Modal
        open={holidayModal}
        onClose={() => setHolidayModal(false)}
        title={editingHoliday ? "Edit Holiday" : "Add Holiday"}
        width="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="Date *"
            type="date"
            value={hForm.date}
            onChange={(e) => setHForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            label="Holiday Name *"
            value={hForm.name}
            onChange={(e) => setHForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Christmas Day"
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hForm.isClosed}
              onChange={(e) => setHForm((f) => ({ ...f, isClosed: e.target.checked }))}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">
              Fully closed (uncheck if modified hours only)
            </span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setHolidayModal(false)}>Cancel</Button>
            <Button
              loading={holidaySave.isPending}
              disabled={!hForm.date || !hForm.name.trim()}
              onClick={() => holidaySave.mutate()}
            >
              {editingHoliday ? "Save Changes" : "Add Holiday"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete holiday confirm ── */}
      <Modal open={!!deleteHoliday} onClose={() => setDeleteHoliday(null)} title="Delete Holiday">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            Are you sure you want to remove <strong>{deleteHoliday?.name}</strong> ({deleteHoliday?.date})? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setDeleteHoliday(null)}>Cancel</Button>
            <Button variant="danger" loading={holidayDelete.isPending} onClick={() => holidayDelete.mutate()}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

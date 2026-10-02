"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Select } from "@/components/ui";
import { invoicesApi, type AdhocInvoicePayload } from "@/api/invoices.api";
import { usersApi, type UserSearchResult } from "@/api/users.api";

const CA_PROVINCE_OPTIONS = [
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
].map((p) => ({ value: p, label: p }));

interface LineItem {
  name:      string;
  sku:       string;
  quantity:  string;
  unitPrice: string;
}

interface TaxLine {
  label:  string;
  rate:   string;
  amount: string;
}

const blankLine = (): LineItem => ({ name: "", sku: "", quantity: "1", unitPrice: "" });
const blankTax  = (): TaxLine  => ({ label: "", rate: "", amount: "" });

function toCents(s: string) { return Math.round(parseFloat(s || "0") * 100); }

export default function NewAdhocInvoicePage() {
  const router = useRouter();

  const [customerName,  setCustomerName]  = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerUhid,  setCustomerUhid]  = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [activeField,   setActiveField]   = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCustomerInput(field: string, value: string, setter: (v: string) => void) {
    setter(value);
    setCustomerUhid(null);
    setActiveField(field);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { setSearchResults(await usersApi.search(value.trim())); } catch { /* ignore */ }
    }, 280);
  }

  function pickCustomer(u: UserSearchResult) {
    setCustomerName(u.fullName);
    setCustomerEmail(u.email);
    setCustomerPhone(u.phone ?? "");
    setCustomerUhid(u.uhid);
    setSearchResults([]);
    setActiveField(null);
  }

  function dismissSearch() {
    setTimeout(() => setActiveField(null), 150);
  }

  const [addr, setAddr] = useState({
    fullName: "", phone: "", addressLine1: "", addressLine2: "",
    city: "", province: "ON", postalCode: "", country: "Canada",
  });

  const [items,    setItems]    = useState<LineItem[]>([blankLine()]);
  const [taxLines, setTaxLines] = useState<TaxLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [coupon,   setCoupon]   = useState("");
  const [notes,    setNotes]    = useState("");
  const [error,    setError]    = useState("");

  const mut = useMutation({
    mutationFn: (payload: AdhocInvoicePayload) => invoicesApi.createAdhoc(payload),
    onSuccess:  (inv) => router.push(`/invoices/${inv._id}`),
    onError:    () => setError("Failed to create invoice. Please check the form and try again."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsedItems = items.map((i) => ({
      name:      i.name.trim(),
      sku:       i.sku.trim(),
      quantity:  parseInt(i.quantity, 10) || 1,
      unitPrice: toCents(i.unitPrice),
    }));

    if (parsedItems.some((i) => !i.name || !i.sku || i.unitPrice < 0)) {
      setError("All line items must have a name, SKU, and valid price.");
      return;
    }

    const parsedTaxLines = taxLines
      .filter((t) => t.label.trim())
      .map((t) => ({
        label:  t.label.trim(),
        rate:   parseFloat(t.rate) || 0,
        amount: toCents(t.amount),
      }));

    mut.mutate({
      customerName:  customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || undefined,
      billingAddress: {
        fullName:     addr.fullName.trim() || customerName.trim(),
        phone:        addr.phone.trim()    || customerPhone.trim(),
        addressLine1: addr.addressLine1.trim(),
        addressLine2: addr.addressLine2.trim() || undefined,
        city:         addr.city.trim(),
        province:     addr.province,
        postalCode:   addr.postalCode.trim(),
        country:      addr.country.trim() || "Canada",
      },
      items: parsedItems,
      taxLines: parsedTaxLines.length > 0 ? parsedTaxLines : undefined,
      discountAmount: toCents(discount) || undefined,
      couponCode: coupon.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const subtotalCents = items.reduce((s, i) => s + toCents(i.unitPrice) * (parseInt(i.quantity, 10) || 1), 0);
  const discountCents = toCents(discount);
  const taxCents      = taxLines.reduce((s, t) => s + toCents(t.amount), 0);
  const totalCents    = subtotalCents - discountCents + taxCents;
  function cad(c: number) { return `$${(c / 100).toFixed(2)}`; }

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Adhoc Invoice"
        description="Create a direct invoice not tied to an order"
        actions={
          <Link href="/invoices">
            <Button size="sm" variant="outline"><ArrowLeft size={14} className="mr-1.5" />Back</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="flex gap-5 items-start">

          {/* ── Left column: Customer + Billing (sticky) ── */}
          <div className="w-[360px] shrink-0 space-y-4 sticky top-4">

            <Section title="Customer">
              {customerUhid && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[var(--font-size-xs)] font-semibold text-[var(--color-primary)]">
                    {customerUhid}
                  </span>
                  <button type="button" onClick={() => setCustomerUhid(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors" title="Clear">
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="space-y-3">
                <AcField
                  label="Full Name *" value={customerName} required
                  onChange={(v) => handleCustomerInput("name", v, setCustomerName)}
                  onBlur={dismissSearch}
                  open={activeField === "name"} results={searchResults}
                  onPick={pickCustomer}
                />
                <AcField
                  label="Email *" value={customerEmail} required
                  onChange={(v) => handleCustomerInput("email", v, setCustomerEmail)}
                  onBlur={dismissSearch}
                  open={activeField === "email"} results={searchResults}
                  onPick={pickCustomer}
                />
                <AcField
                  label="Phone" value={customerPhone}
                  onChange={(v) => handleCustomerInput("phone", v, setCustomerPhone)}
                  onBlur={dismissSearch}
                  open={activeField === "phone"} results={searchResults}
                  onPick={pickCustomer}
                />
              </div>
            </Section>

            <Section title="Billing Address">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name"  value={addr.fullName} onChange={(v) => setAddr((a) => ({ ...a, fullName: v }))} />
                <Field label="Phone"      value={addr.phone}    onChange={(v) => setAddr((a) => ({ ...a, phone: v }))} />
                <Field label="Address Line 1 *" value={addr.addressLine1} onChange={(v) => setAddr((a) => ({ ...a, addressLine1: v }))} required className="col-span-2" />
                <Field label="Address Line 2"   value={addr.addressLine2} onChange={(v) => setAddr((a) => ({ ...a, addressLine2: v }))} className="col-span-2" />
                <Field label="City *" value={addr.city} onChange={(v) => setAddr((a) => ({ ...a, city: v }))} required />
                <Select
                  label="Province *"
                  value={addr.province}
                  onChange={(v) => setAddr((a) => ({ ...a, province: v }))}
                  options={CA_PROVINCE_OPTIONS}
                />
                <Field label="Postal Code *" value={addr.postalCode} onChange={(v) => setAddr((a) => ({ ...a, postalCode: v }))} required />
                <Field label="Country"       value={addr.country}    onChange={(v) => setAddr((a) => ({ ...a, country: v }))} />
              </div>
            </Section>

          </div>

          {/* ── Right column: Items + Tax + Adjustments + Totals ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Line items */}
            <Section title="Line Items">
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-4">
                      {i === 0 && <label className={LABEL_CLS}>Description *</label>}
                      <input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} required placeholder="Product name" className={INPUT_CLS} />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <label className={LABEL_CLS}>SKU *</label>}
                      <input value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)} required placeholder="SKU" className={INPUT_CLS} />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <label className={LABEL_CLS}>Qty</label>}
                      <input type="text" inputMode="numeric" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} onKeyDown={(e) => blockNonNumeric(e, false)} className={INPUT_CLS} />
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className={LABEL_CLS}>Unit Price (CAD) *</label>}
                      <input type="text" inputMode="decimal" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} onKeyDown={(e) => blockNonNumeric(e, true)} required placeholder="0.00" className={INPUT_CLS} />
                    </div>
                    <div className="col-span-1 flex items-end justify-center">
                      {i === 0 && <div className={LABEL_CLS}>&nbsp;</div>}
                      <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors" title="Remove">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems((prev) => [...prev, blankLine()])}
                className="mt-2 flex items-center gap-1 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"
              >
                <Plus size={12} />Add line item
              </button>
            </Section>

            {/* Tax lines */}
            <Section title="Tax Lines (optional)">
              <div className="space-y-1.5">
                {taxLines.map((t, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-6">
                      {i === 0 && <label className={LABEL_CLS}>Label</label>}
                      <input value={t.label} onChange={(e) => updateTax(i, "label", e.target.value)} placeholder='e.g. "GST (5%)"' className={INPUT_CLS} />
                    </div>
                    <div className="col-span-3">
                      {i === 0 && <label className={LABEL_CLS}>Amount (CAD)</label>}
                      <input type="text" inputMode="decimal" value={t.amount} onChange={(e) => updateTax(i, "amount", e.target.value)} onKeyDown={(e) => blockNonNumeric(e, true)} placeholder="0.00" className={INPUT_CLS} />
                    </div>
                    <div className="col-span-2">
                      {i === 0 && <label className={LABEL_CLS}>Rate</label>}
                      <input type="text" inputMode="decimal" value={t.rate} onChange={(e) => updateTax(i, "rate", e.target.value)} onKeyDown={(e) => blockNonNumeric(e, true)} placeholder="0.05" className={INPUT_CLS} />
                    </div>
                    <div className="col-span-1 flex items-end justify-center">
                      {i === 0 && <div className={LABEL_CLS}>&nbsp;</div>}
                      <button type="button" onClick={() => removeTax(i)} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setTaxLines((prev) => [...prev, blankTax()])}
                className="mt-2 flex items-center gap-1 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"
              >
                <Plus size={12} />Add tax line
              </button>
            </Section>

            {/* Adjustments & Notes */}
            <Section title="Adjustments & Notes">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount Amount (CAD)" value={discount} onChange={setDiscount} numeric placeholder="0.00" />
                <Field label="Coupon Code"            value={coupon}   onChange={setCoupon}   placeholder="Optional" />
              </div>
              <div className="mt-3">
                <label className={LABEL_CLS}>Notes (visible on invoice)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes to print on the invoice…"
                  className={INPUT_CLS + " resize-none"}
                />
              </div>
            </Section>

            {/* Preview totals + submit */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3">
              <h3 className="text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Preview Totals</h3>
              <div className="w-44 ml-auto space-y-1 text-[var(--font-size-sm)]">
                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Subtotal</span><span>{cad(subtotalCents)}</span></div>
                {discountCents > 0 && <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Discount</span><span className="text-[var(--color-success)]">-{cad(discountCents)}</span></div>}
                {taxLines.map((t, i) => (
                  <div key={i} className="flex justify-between"><span className="text-[var(--color-text-muted)]">{t.label || "Tax"}</span><span>{cad(toCents(t.amount))}</span></div>
                ))}
                <div className="flex justify-between font-semibold border-t border-[var(--color-border)] pt-1"><span>Total</span><span>{cad(totalCents)}</span></div>
              </div>
            </div>

            {error && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{error}</p>}

            <div className="flex justify-end gap-2">
              <Link href="/invoices">
                <Button type="button" variant="outline" size="sm">Cancel</Button>
              </Link>
              <Button type="submit" size="sm" disabled={mut.isPending}>
                {mut.isPending ? "Creating…" : "Create Invoice"}
              </Button>
            </div>

          </div>
        </div>
      </form>
    </div>
  );

  function updateItem(i: number, key: keyof LineItem, val: string) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateTax(i: number, key: keyof TaxLine, val: string) {
    setTaxLines((prev) => prev.map((t, idx) => idx === i ? { ...t, [key]: val } : t));
  }
  function removeTax(i: number) {
    setTaxLines((prev) => prev.filter((_, idx) => idx !== i));
  }
}

const LABEL_CLS = "block text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1";
const INPUT_CLS = "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <h3 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function AcField({
  label, value, required, onChange, onBlur, open, results, onPick,
}: {
  label: string; value: string; required?: boolean;
  onChange: (v: string) => void;
  onBlur:   () => void;
  open:     boolean;
  results:  UserSearchResult[];
  onPick:   (u: UserSearchResult) => void;
}) {
  return (
    <div className="relative">
      <label className={LABEL_CLS}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={required}
        className={INPUT_CLS}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-md)] overflow-hidden">
          {results.map((u) => (
            <li key={u._id}>
              <button
                type="button"
                onMouseDown={() => onPick(u)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--color-primary-light)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {u.uhid && (
                    <span className="text-[var(--font-size-xs)] font-mono font-semibold text-[var(--color-primary)] shrink-0">{u.uhid}</span>
                  )}
                  <span className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] truncate">{u.fullName}</span>
                </div>
                <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] truncate mt-0.5">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const NUMERIC_KEYS = new Set(["Backspace","Delete","Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"]);
function blockNonNumeric(e: React.KeyboardEvent<HTMLInputElement>, allowDot = true) {
  if (NUMERIC_KEYS.has(e.key)) return;
  if ((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key)) return;
  if (/^\d$/.test(e.key)) return;
  if (allowDot && e.key === "." && !(e.currentTarget.value.includes("."))) return;
  e.preventDefault();
}

function Field({
  label, value, onChange, type = "text", required, placeholder, className, numeric = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; className?: string; numeric?: boolean;
}) {
  return (
    <div className={className}>
      <label className={LABEL_CLS}>{label}</label>
      <input
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={numeric ? (e) => blockNonNumeric(e, true) : undefined}
        required={required}
        placeholder={placeholder}
        className={INPUT_CLS}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Truck, Store, FileText, CheckCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/api/cart.api";
import { apiClient } from "@/lib/apiClient";
import { useMe } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";

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

const fieldClass =
  "mt-1 w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-ink-500";

export default function CheckoutPage() {
  const router = useRouter();
  const { data: cart, isLoading } = useCart();
  const { isAuthenticated } = useAuthStore();
  const { data: user } = useMe();
  const isGuest = !isAuthenticated;

  const [method, setMethod]           = useState<"delivery" | "pickup">("delivery");
  const [province, setProvince]       = useState("ON");
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [billProvince, setBillProvince]   = useState("ON");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]   = useState("");
  const [placed, setPlaced] = useState(false);
  const [orderRef, setOrderRef] = useState("");

  const isEmpty = !cart || cart.items.length === 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);

    const shippingAddress = {
      fullName:   fd.get("fullName") as string,
      phone:      fd.get("phone") as string,
      address1:   fd.get("address1") as string,
      address2:   fd.get("address2") as string || "",
      city:       fd.get("city") as string,
      province,
      postalCode: fd.get("postalCode") as string,
      country:    "CA",
    };

    const billingAddress = (method === "pickup" || sameAsBilling)
      ? shippingAddress
      : {
          fullName:   fd.get("billFullName") as string || shippingAddress.fullName,
          phone:      shippingAddress.phone,
          address1:   fd.get("billAddress1") as string,
          address2:   fd.get("billAddress2") as string || "",
          city:       fd.get("billCity") as string,
          province:   billProvince,
          postalCode: fd.get("billPostalCode") as string,
          country:    "CA",
        };

    const body: Record<string, unknown> = {
      paymentMethod: method,
      notes: fd.get("notes") as string || undefined,
      shippingAddress,
      billingAddress,
    };

    if (isGuest) {
      body.guestInfo = {
        email:    fd.get("guestEmail") as string,
        fullName: fd.get("fullName") as string,
        phone:    fd.get("phone") as string,
      };
    }

    try {
      const { data } = await apiClient.post<{ data: { orderNumber: string } }>("/orders/checkout", body);
      setOrderRef(data.data.orderNumber);
      setPlaced(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Could not place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="h-64 animate-pulse rounded-2xl bg-ink-100" />
      </div>
    );
  }

  if (placed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <CheckCircle size={40} className="text-green-500" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Order Placed!</h1>
          {orderRef && (
            <p className="mt-1 text-sm font-medium text-brand-700">Order #{orderRef}</p>
          )}
          <p className="mt-2 text-ink-500">
            Thank you for your order. You will receive a confirmation shortly.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/shop"
            className="rounded-full border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300"
          >
            Continue Shopping
          </Link>
          {!isGuest && (
            <Link
              href="/patient/orders"
              className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              View Orders
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-ink-500">Your cart is empty.</p>
        <Link href="/shop" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/cart" className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700">
            <ArrowLeft size={15} /> Cart
          </Link>
          <span className="text-ink-300">/</span>
          <h1 className="font-display text-2xl font-bold text-ink-900">Checkout</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

            {/* ── Left column ── */}
            <div className="space-y-5">

              {/* Guest info */}
              {isGuest && (
                <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink-500">
                    Contact Information
                  </h2>
                  <div>
                    <label className={labelClass}>Email address</label>
                    <input required name="guestEmail" type="email" className={fieldClass} placeholder="you@example.com" />
                  </div>
                  <p className="mt-2 text-xs text-ink-400">
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-brand-700 underline">Sign in</Link>
                  </p>
                </section>
              )}

              {/* Delivery method */}
              <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-ink-500">
                  Delivery Method
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["delivery", "pickup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={[
                        "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                        method === m
                          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                          : "border-ink-200 hover:border-brand-300",
                      ].join(" ")}
                    >
                      {m === "delivery" ? (
                        <Truck size={20} className={method === m ? "text-brand-600" : "text-ink-400"} />
                      ) : (
                        <Store size={20} className={method === m ? "text-brand-600" : "text-ink-400"} />
                      )}
                      <div>
                        <p className={`text-sm font-semibold ${method === m ? "text-brand-700" : "text-ink-800"}`}>
                          {m === "delivery" ? "Ship to Address" : "In-Store Pickup"}
                        </p>
                        <p className="text-xs text-ink-500">
                          {m === "delivery" ? "Delivered across Canada" : "Pick up at our pharmacy"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Shipping address */}
              <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-500">
                  <MapPin size={14} />
                  {method === "pickup" ? "Billing Address" : "Shipping Address"}
                </h2>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Full name</label>
                      <input
                        required
                        name="fullName"
                        defaultValue={user?.fullName}
                        className={fieldClass}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input
                        required
                        type="tel"
                        name="phone"
                        minLength={7}
                        defaultValue={user?.phone}
                        className={fieldClass}
                        placeholder="(647) 555-0100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Address line 1</label>
                    <input required name="address1" className={fieldClass} placeholder="123 Main St" />
                  </div>
                  <div>
                    <label className={labelClass}>Address line 2 (optional)</label>
                    <input name="address2" className={fieldClass} placeholder="Apt, suite, unit…" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>City</label>
                      <input required name="city" className={fieldClass} placeholder="Toronto" />
                    </div>
                    <div>
                      <Select
                        label="Province"
                        value={province}
                        onChange={setProvince}
                        options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Postal code</label>
                      <input required name="postalCode" className={fieldClass} placeholder="M5V 3A8" maxLength={7} />
                    </div>
                  </div>

                  {method === "pickup" && (
                    <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
                      <p className="font-semibold">Pickup location: MediSyn Compounding Pharmacy</p>
                      <p className="mt-0.5 text-xs text-brand-600">123 Pharmacy Lane, Toronto, ON · M5V 1A1</p>
                      <p className="mt-1 text-xs text-brand-600">Mon–Fri 9am–6pm · Sat 10am–4pm</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Billing address */}
              <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-500">
                  <MapPin size={14} /> Billing Address
                </h2>

                {method === "delivery" && (
                  <label className="mb-4 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={sameAsBilling}
                      onChange={(e) => setSameAsBilling(e.target.checked)}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 accent-brand-600"
                    />
                    <span className="text-sm text-ink-700">Same as shipping address</span>
                  </label>
                )}

                {(!sameAsBilling || method === "pickup") && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Full name</label>
                      <input name="billFullName" defaultValue={user?.fullName} className={fieldClass} placeholder="Jane Doe" />
                    </div>
                    <div>
                      <label className={labelClass}>Address line 1</label>
                      <input required={!sameAsBilling || method === "pickup"} name="billAddress1" className={fieldClass} placeholder="123 Main St" />
                    </div>
                    <div>
                      <label className={labelClass}>Address line 2 (optional)</label>
                      <input name="billAddress2" className={fieldClass} placeholder="Apt, suite, unit…" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>City</label>
                        <input required={!sameAsBilling || method === "pickup"} name="billCity" className={fieldClass} placeholder="Toronto" />
                      </div>
                      <div>
                        <Select
                          label="Province"
                          value={billProvince}
                          onChange={setBillProvince}
                          options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Postal code</label>
                        <input required={!sameAsBilling || method === "pickup"} name="billPostalCode" className={fieldClass} placeholder="M5V 3A8" maxLength={7} />
                      </div>
                    </div>
                  </div>
                )}

                {sameAsBilling && method === "delivery" && (
                  <p className="text-sm text-ink-500">Using your shipping address as the billing address.</p>
                )}
              </section>

              {/* Order notes */}
              <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-500">
                  <FileText size={14} /> Order Notes (optional)
                </h2>
                <textarea
                  name="notes"
                  rows={3}
                  className={`${fieldClass} resize-none`}
                  placeholder="Any special instructions for your order…"
                />
              </section>
            </div>

            {/* ── Order summary ── */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-display text-base font-bold text-ink-900">Order Summary</h2>

                <div className="space-y-2 divide-y divide-ink-50">
                  {cart.items.map((item) => (
                    <div key={String(item.productId)} className="flex justify-between py-2 text-sm">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate font-medium text-ink-800">{item.name}</p>
                        <p className="text-xs text-ink-400">Qty {item.quantity}</p>
                      </div>
                      <p className="shrink-0 font-semibold text-ink-900">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
                  <div className="flex justify-between text-ink-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatPrice(cart.subtotal)}</span>
                  </div>
                  {cart.discountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>Discount ({cart.couponCode})</span>
                      <span>−{formatPrice(cart.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-ink-500 text-xs">
                    <span>Shipping</span>
                    <span>{method === "pickup" ? "Free (Pickup)" : "Calculated post-order"}</span>
                  </div>
                  <div className="flex justify-between border-t border-ink-100 pt-3 font-bold text-ink-900">
                    <span>Total</span>
                    <span className="text-lg">{formatPrice(cart.total)}</span>
                  </div>
                </div>

                {error && (
                  <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? "Placing order…" : "Place Order"}
                </button>

                <p className="mt-3 text-center text-xs text-ink-400">
                  Payment collected at pickup / on delivery · No card required online
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

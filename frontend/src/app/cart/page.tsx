"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2, Plus, Minus, Tag, X, ArrowLeft, ArrowRight } from "lucide-react";
import { useCart, useUpdateCartItem, useRemoveCartItem, useApplyCoupon, useRemoveCoupon } from "@/hooks/useCart";
import { formatPrice } from "@/api/cart.api";

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const updateItem  = useUpdateCartItem();
  const removeItem  = useRemoveCartItem();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");

  const isEmpty = !cart || cart.items.length === 0;

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponError("");
    try {
      await applyCoupon.mutateAsync(couponInput.trim().toUpperCase());
      setCouponInput("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCouponError(msg ?? "Invalid coupon code");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100" />
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
          <ShoppingCart size={36} className="text-brand-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Your cart is empty</h1>
          <p className="mt-1 text-ink-500">Add products from our shop to get started.</p>
        </div>
        <Link
          href="/shop"
          className="flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Browse Products <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/shop" className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-brand-700">
            <ArrowLeft size={15} /> Shop
          </Link>
          <span className="text-ink-300">/</span>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            Your Cart <span className="text-ink-400 font-normal text-lg">({cart.items.length} {cart.items.length === 1 ? "item" : "items"})</span>
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          {/* ── Items ── */}
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div
                key={String(item.productId)}
                className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"
              >
                {/* Product image */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 to-brand-100">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-brand-300">
                      {item.name.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-400">SKU: {item.sku}</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-700">
                    {formatPrice(item.price)}
                  </p>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1 rounded-xl border border-ink-200">
                  <button
                    onClick={() => updateItem.mutate({ productId: String(item.productId), quantity: item.quantity - 1 })}
                    disabled={item.quantity <= 1 || updateItem.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-l-xl text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-ink-800">{item.quantity}</span>
                  <button
                    onClick={() => updateItem.mutate({ productId: String(item.productId), quantity: item.quantity + 1 })}
                    disabled={updateItem.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-r-xl text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {/* Line total */}
                <p className="w-20 text-right text-sm font-bold text-ink-900 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </p>

                {/* Remove */}
                <button
                  onClick={() => removeItem.mutate(String(item.productId))}
                  disabled={removeItem.isPending}
                  className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Order summary ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-display text-base font-bold text-ink-900">Order Summary</h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-ink-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-ink-900">{formatPrice(cart.subtotal)}</span>
                </div>

                {cart.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Coupon ({cart.couponCode})</span>
                    <span className="font-semibold">−{formatPrice(cart.discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-ink-500 text-xs">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>

                <div className="flex justify-between border-t border-ink-100 pt-3 font-bold text-ink-900">
                  <span>Total</span>
                  <span className="text-lg">{formatPrice(cart.total)}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Proceed to Checkout <ArrowRight size={15} />
              </Link>

              <Link
                href="/shop"
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 py-2.5 text-sm font-medium text-ink-600 hover:border-ink-300 hover:text-ink-800"
              >
                <ArrowLeft size={13} /> Continue Shopping
              </Link>
            </div>

            {/* Coupon */}
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-800">
                <Tag size={14} /> Coupon Code
              </h3>

              {cart.couponCode ? (
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-green-800">{cart.couponCode}</p>
                    <p className="text-xs text-green-600">−{formatPrice(cart.discountAmount)} saved</p>
                  </div>
                  <button
                    onClick={() => removeCoupon.mutate()}
                    disabled={removeCoupon.isPending}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                    placeholder="Enter code"
                    className="flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={applyCoupon.isPending || !couponInput.trim()}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && (
                <p className="mt-1.5 text-xs text-red-600">{couponError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

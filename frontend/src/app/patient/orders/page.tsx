"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ordersApi } from "@/api/orders.api";
import StatusBadge from "@/components/StatusBadge";
import { useAuthStore } from "@/stores/authStore";

function fmtCAD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function PatientOrdersPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["orders", "my"],
    queryFn: () => ordersApi.list(1, 50),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">My Orders</h1>
        <p className="mt-1 text-sm text-slate-600">Track and view your order history.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">Order History</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center px-6 py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : !data?.docs?.length ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No orders yet.</p>
            <Link
              href="/shop"
              className="mt-1 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.docs.map((order) => (
              <Link
                key={order._id}
                href={`/patient/orders/${order._id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-ink-900">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {fmtDate(order.createdAt)}
                    {" · "}
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    {" · "}
                    <span className="capitalize">{order.paymentMethod}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400 truncate">
                    {order.items.map((i) => i.name).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-ink-900">{fmtCAD(order.total)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

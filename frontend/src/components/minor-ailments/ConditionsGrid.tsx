"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Stethoscope, Loader2 } from "lucide-react";
import { minorAilmentsApi } from "@/api/minor-ailments.api";

export default function ConditionsGrid() {
  const { data: conditions = [], isLoading } = useQuery({
    queryKey: ["ailments-catalog-public"],
    queryFn:  minorAilmentsApi.listCatalog,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (conditions.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 py-10">
        Our condition list is being updated. Please check back soon.
      </p>
    );
  }

  return (
    <>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {conditions.map((c) => (
          <div
            key={c._id}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              <Stethoscope size={21} />
            </div>
            <h3 className="font-display text-base font-semibold text-ink-900">{c.name}</h3>
            {c.description && (
              <p className="text-xs leading-relaxed text-slate-500 flex-1">{c.description}</p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Not sure if your condition qualifies?{" "}
        <Link href="/contact" className="font-semibold text-brand-600 hover:underline">
          Ask our pharmacists →
        </Link>
      </p>
    </>
  );
}

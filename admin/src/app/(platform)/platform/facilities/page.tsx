"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search, Building2, ChevronRight } from "lucide-react";
import { platformApi } from "@/api/platform.api";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function FacilitiesPage() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState("");
  const [q,      setQ]      = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-facilities", page, q],
    queryFn:  () => platformApi.listFacilities({ page, limit: 25, search: q || undefined }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(search);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Facilities" description="All pharmacies and clinics on the platform" />
        <Button asChild>
          <Link href="/platform/facilities/new"><Plus size={15} className="mr-1.5" />New Facility</Link>
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <Input
          placeholder="Search by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={14} />}
        />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {isLoading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}
      {isError   && <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">Could not load facilities.</p>}

      {data && (
        <>
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] overflow-hidden">
            {data.data.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Building2 size={32} className="text-[var(--color-text-muted)]" />
                <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">No facilities yet</p>
                <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">Create the first facility to get started</p>
                <Button asChild size="sm">
                  <Link href="/platform/facilities/new"><Plus size={14} className="mr-1" />Create facility</Link>
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    {["Facility", "Slug", "Plan", "Users", "Status", "Created", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[var(--font-size-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">{f.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[var(--font-size-xs)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded">{f.slug}</code>
                      </td>
                      <td className="px-4 py-3 text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{f.planName}</td>
                      <td className="px-4 py-3 text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">{f.userCount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="px-4 py-3 text-[var(--font-size-xs)] text-[var(--color-text-muted)] whitespace-nowrap">
                        {new Date(f.createdAt).toLocaleDateString("en-CA")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/platform/facilities/${f.id}`}
                          className="flex items-center gap-1 text-[var(--font-size-xs)] text-[var(--color-primary)] hover:underline"
                        >
                          Manage <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                {data.pagination.total} facilities total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

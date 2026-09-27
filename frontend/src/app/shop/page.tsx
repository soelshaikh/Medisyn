"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search, SlidersHorizontal, X, ShoppingCart, FileText,
  ChevronLeft, ChevronRight, Tag, Building2,
} from "lucide-react";
import {
  productsApi, categoriesPublicApi, brandsPublicApi,
  formatPrice, primaryImage, type Product,
} from "@/api/products.api";
import { Select } from "@/components/ui/Select";

/* ─── Product card ─── */
function ProductCard({ product }: { product: Product }) {
  const image   = primaryImage(product.images);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;
  const brand = product.brandId && typeof product.brandId === "object" ? product.brandId : null;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="font-display text-4xl font-bold text-brand-300">{product.name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {hasDiscount && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">-{discountPct}%</span>
          )}
          {product.requiresPrescription && (
            <span className="flex items-center gap-1 rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">
              <FileText size={10} /> Rx
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {typeof product.categoryId === "object" && (
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            {product.categoryId.name}
          </p>
        )}
        <h3 className="font-display text-sm font-semibold leading-snug text-ink-900 group-hover:text-brand-700 line-clamp-2">
          {product.name}
        </h3>
        {brand && (
          <p className="text-xs text-ink-400">{brand.name}</p>
        )}
        {product.shortDescription && (
          <p className="line-clamp-2 text-xs text-ink-500 flex-1">{product.shortDescription}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="text-base font-bold text-ink-900">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <span className="ml-1.5 text-xs text-ink-400 line-through">{formatPrice(product.compareAtPrice!)}</span>
            )}
          </div>
          <span className="flex items-center gap-1 rounded-lg bg-brand-600 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ShoppingCart size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Shop page ─── */
export default function ShopPage() {
  const [search,     setSearch]     = useState("");
  const [searchVal,  setSearchVal]  = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId,    setBrandId]    = useState("");
  const [sortBy,     setSortBy]     = useState("featured");
  const [rxFilter,   setRxFilter]   = useState<"all" | "rx" | "otc">("all");
  const [page,       setPage]       = useState(1);

  const LIMIT = 12;

  const { data: categories } = useQuery({ queryKey: ["public-categories"], queryFn: categoriesPublicApi.list, staleTime: 60_000 });
  const { data: brands }     = useQuery({ queryKey: ["public-brands"],     queryFn: brandsPublicApi.list,     staleTime: 60_000 });

  const filters = {
    search:               searchVal || undefined,
    categoryId:           categoryId || undefined,
    brandId:              brandId || undefined,
    requiresPrescription: rxFilter === "rx" ? true : rxFilter === "otc" ? false : undefined,
    page,
    limit: LIMIT,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["shop-products", filters],
    queryFn:  () => productsApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const products   = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearch = useCallback(() => { setSearchVal(search); setPage(1); }, [search]);
  const clearAll = () => {
    setSearch(""); setSearchVal(""); setCategoryId(""); setBrandId("");
    setRxFilter("all"); setPage(1);
  };

  const sorted = [...products].sort((a, b) => {
    if (sortBy === "price-asc")  return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    if (sortBy === "name-az")    return a.name.localeCompare(b.name);
    if (sortBy === "name-za")    return b.name.localeCompare(a.name);
    return 0;
  });

  const hasFilters = searchVal || categoryId || brandId || rxFilter !== "all";

  return (
    <div className="min-h-screen bg-ink-50">
      {/* ── Hero banner ── */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">MediSyn Pharmacy</p>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Shop Our Products</h1>
          <p className="mt-2 text-brand-100">Compounded medications, vitamins, and health essentials — delivered across Canada.</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex gap-7">

          {/* ── Filter sidebar ── */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-[73px] space-y-5">

              {/* Categories */}
              {(categories ?? []).length > 0 && (
                <div>
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ink-500">
                    <Tag size={11} /> Categories
                  </p>
                  <ul className="space-y-0.5">
                    <li>
                      <button
                        onClick={() => { setCategoryId(""); setPage(1); }}
                        className={["w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors", !categoryId ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-100"].join(" ")}
                      >
                        All Categories
                      </button>
                    </li>
                    {(categories ?? []).map((c) => (
                      <li key={c._id}>
                        <button
                          onClick={() => { setCategoryId(c._id); setPage(1); }}
                          className={["w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors", categoryId === c._id ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-100"].join(" ")}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Divider */}
              {(categories ?? []).length > 0 && (brands ?? []).length > 0 && (
                <div className="border-t border-ink-100" />
              )}

              {/* Brands */}
              {(brands ?? []).length > 0 && (
                <div>
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-ink-500">
                    <Building2 size={11} /> Brands
                  </p>
                  <ul className="space-y-0.5">
                    <li>
                      <button
                        onClick={() => { setBrandId(""); setPage(1); }}
                        className={["w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors", !brandId ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-100"].join(" ")}
                      >
                        All Brands
                      </button>
                    </li>
                    {(brands ?? []).map((b) => (
                      <li key={b._id}>
                        <button
                          onClick={() => { setBrandId(b._id); setPage(1); }}
                          className={["w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors", brandId === b._id ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-100"].join(" ")}
                        >
                          {b.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasFilters && (
                <button onClick={clearAll} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 py-1.5 text-xs text-ink-500 hover:border-ink-300 hover:text-ink-700 transition-colors">
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">

            {/* Top filter bar */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-52">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text" value={search} placeholder="Search products…"
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-9 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setSearchVal(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Mobile category + brand selects */}
              {(categories ?? []).length > 0 && (
                <Select
                  className="lg:hidden"
                  value={categoryId}
                  onChange={(v) => { setCategoryId(v); setPage(1); }}
                  placeholder="All Categories"
                  options={[
                    { value: "", label: "All Categories" },
                    ...(categories ?? []).map((c) => ({ value: c._id, label: c.name })),
                  ]}
                />
              )}

              {(brands ?? []).length > 0 && (
                <Select
                  className="lg:hidden"
                  value={brandId}
                  onChange={(v) => { setBrandId(v); setPage(1); }}
                  placeholder="All Brands"
                  options={[
                    { value: "", label: "All Brands" },
                    ...(brands ?? []).map((b) => ({ value: b._id, label: b.name })),
                  ]}
                />
              )}

              {/* Rx filter pills */}
              <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
                {(["all", "otc", "rx"] as const).map((f) => (
                  <button key={f} onClick={() => { setRxFilter(f); setPage(1); }}
                    className={["rounded-lg px-3 py-1.5 text-xs font-semibold transition", rxFilter === f ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"].join(" ")}>
                    {f === "all" ? "All" : f === "otc" ? "OTC Only" : "Rx Required"}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-ink-400 shrink-0" />
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  className="w-44"
                  options={[
                    { value: "featured",   label: "Featured" },
                    { value: "price-asc",  label: "Price: Low → High" },
                    { value: "price-desc", label: "Price: High → Low" },
                    { value: "name-az",    label: "Name: A → Z" },
                    { value: "name-za",    label: "Name: Z → A" },
                  ]}
                />
              </div>

              {meta && <p className="ml-auto text-sm text-ink-500">{meta.total} {meta.total === 1 ? "product" : "products"}</p>}
            </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="mb-4 flex flex-wrap gap-2">
                {categoryId && categories?.find((c) => c._id === categoryId) && (
                  <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                    <Tag size={10} /> {categories!.find((c) => c._id === categoryId)!.name}
                    <button onClick={() => { setCategoryId(""); setPage(1); }} className="ml-0.5 text-brand-500 hover:text-brand-700"><X size={11} /></button>
                  </span>
                )}
                {brandId && brands?.find((b) => b._id === brandId) && (
                  <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                    <Building2 size={10} /> {brands!.find((b) => b._id === brandId)!.name}
                    <button onClick={() => { setBrandId(""); setPage(1); }} className="ml-0.5 text-brand-500 hover:text-brand-700"><X size={11} /></button>
                  </span>
                )}
                {searchVal && (
                  <span className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-600">
                    "{searchVal}"
                    <button onClick={() => { setSearch(""); setSearchVal(""); setPage(1); }} className="ml-0.5 text-ink-400 hover:text-ink-700"><X size={11} /></button>
                  </span>
                )}
              </div>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: LIMIT }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-2xl bg-ink-100" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                  <ShoppingCart size={28} className="text-brand-400" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-ink-800">No products found</p>
                  <p className="mt-1 text-sm text-ink-500">{hasFilters ? "Try adjusting your filters." : "Check back soon — more products are coming."}</p>
                </div>
                {hasFilters && (
                  <button onClick={clearAll} className="rounded-full border border-brand-200 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {sorted.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span key={`e-${p}`} className="px-1 text-ink-400">…</span>}
                      <button key={p} onClick={() => setPage(p)}
                        className={["flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition", p === page ? "bg-brand-600 text-white" : "border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700"].join(" ")}>
                        {p}
                      </button>
                    </>
                  ))}
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

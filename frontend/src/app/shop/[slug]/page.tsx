"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, ShoppingCart, FileText, Shield,
  Truck, RefreshCcw, Star, ChevronRight, Check,
  Tag, ArrowRight, PlayCircle, CheckCircle2,
  MessageCircle, HelpCircle, User, ThumbsUp,
} from "lucide-react";

const TABS = ["Description", "Features", "Reviews", "Q & A"] as const;
type Tab = typeof TABS[number];
import { productsApi, formatPrice, primaryImage, type Product } from "@/api/products.api";
import { useAddToCart } from "@/hooks/useCart";

/* ─── Video URL → embeddable iframe src ─── */
function toEmbedUrl(url: string): string | null {
  // YouTube: watch?v=ID  or  youtu.be/ID  or  youtube.com/shorts/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;

  // Vimeo: vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null; // unknown provider — skip
}

/* ─── Recommended product card ─── */
function RecommendedCard({ product }: { product: Product }) {
  const addToCart = useAddToCart();
  const image = primaryImage(product.images);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;
  const category = typeof product.categoryId === "object" ? product.categoryId : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Image */}
      <Link href={`/shop/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-ink-50">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="font-display text-4xl font-bold text-brand-200">
              {product.name.charAt(0)}
            </span>
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
            -{discountPct}%
          </span>
        )}
        {product.requiresPrescription && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
            <FileText size={9} /> Rx
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {category && (
          <span className="flex w-fit items-center gap-1 text-xs font-medium text-brand-600">
            <Tag size={10} /> {category.name}
          </span>
        )}

        <Link
          href={`/shop/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 hover:text-brand-700 transition-colors"
        >
          {product.name}
        </Link>

        {/* Price row */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-base font-bold text-ink-900">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-ink-400 line-through">
                {formatPrice(product.compareAtPrice!)}
              </span>
            )}
          </div>

          {product.requiresPrescription ? (
            <Link
              href="/get-started"
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
            >
              <FileText size={11} /> Get Rx
            </Link>
          ) : (
            <button
              onClick={() => addToCart.mutate({ productId: product._id, quantity: 1 })}
              disabled={addToCart.isPending}
              className={[
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                addToCart.isSuccess
                  ? "bg-green-600 text-white"
                  : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60",
              ].join(" ")}
            >
              {addToCart.isSuccess ? <Check size={11} /> : <ShoppingCart size={11} />}
              {addToCart.isSuccess ? "Added" : "Add"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug }        = use(params);
  const [activeImg, setActiveImg] = useState(0);
  const [qty,       setQty]       = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>("Description");
  const addToCart = useAddToCart();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", slug],
    queryFn:  () => productsApi.getBySlug(slug),
  });

  const categoryId = product
    ? (typeof product.categoryId === "object" ? product.categoryId._id : product.categoryId)
    : undefined;

  const { data: relatedData } = useQuery({
    queryKey: ["products-related", categoryId],
    queryFn:  () => productsApi.list({ categoryId, limit: 5, page: 1 }),
    enabled:  !!categoryId,
    staleTime: 60_000,
  });

  const recommended = relatedData?.data.filter((p) => p._id !== product?._id).slice(0, 4) ?? [];

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl bg-ink-100" />
          <div className="space-y-4">
            <div className="h-6 w-32 animate-pulse rounded-lg bg-ink-100" />
            <div className="h-10 w-3/4 animate-pulse rounded-lg bg-ink-100" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-ink-100" />
            <div className="h-32 animate-pulse rounded-xl bg-ink-100" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <p className="font-display text-xl font-semibold text-ink-800">Product not found</p>
        <Link
          href="/shop"
          className="flex items-center gap-2 rounded-full border border-brand-200 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          <ArrowLeft size={15} /> Back to Shop
        </Link>
      </div>
    );
  }

  const images     = product.images;
  const image      = images[activeImg]?.url ?? primaryImage(images);
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;
  const category = typeof product.categoryId === "object" ? product.categoryId : null;

  const brand = product.brandId && typeof product.brandId === "object" ? product.brandId : null;

  function handleAddToCart() {
    if (!product) return;
    addToCart.mutate({ productId: product._id, quantity: qty });
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Breadcrumb ── */}
      <div className="border-b border-ink-100 bg-ink-50">
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-3 text-xs text-ink-500 sm:px-6">
          <Link href="/" className="hover:text-brand-700">Home</Link>
          <ChevronRight size={12} className="text-ink-300" />
          <Link href="/shop" className="hover:text-brand-700">Shop</Link>
          {category && (
            <>
              <ChevronRight size={12} className="text-ink-300" />
              <Link href={`/shop?category=${category._id}`} className="hover:text-brand-700">{category.name}</Link>
            </>
          )}
          <ChevronRight size={12} className="text-ink-300" />
          <span className="font-medium text-ink-800 truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">

          {/* ── Image gallery ── */}
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-ink-50">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt={images[activeImg]?.alt || product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                  <span className="font-display text-7xl font-bold text-brand-200">
                    {product.name.charAt(0)}
                  </span>
                </div>
              )}
              {hasDiscount && (
                <span className="absolute right-4 top-4 rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
                  -{discountPct}%
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={[
                      "h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition",
                      activeImg === i ? "border-brand-600" : "border-ink-200 hover:border-brand-300",
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product info ── */}
          <div className="flex flex-col gap-5">
            {/* Category + badges */}
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {category.name}
                </span>
              )}
              {product.requiresPrescription && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  <FileText size={11} /> Prescription Required
                </span>
              )}
              {product.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs text-ink-600">
                  {tag}
                </span>
              ))}
            </div>

            {/* Name */}
            <h1 className="font-display text-2xl font-bold leading-tight text-ink-900 sm:text-3xl">
              {product.name}
            </h1>

            {/* Rating placeholder */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={14} className="fill-amber-400 text-amber-400" />
              ))}
              <span className="text-xs text-ink-500">(Pharmacist curated)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-ink-900">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-ink-400 line-through">
                    {formatPrice(product.compareAtPrice!)}
                  </span>
                  <span className="rounded-lg bg-red-50 px-2 py-0.5 text-sm font-bold text-red-600">
                    Save {discountPct}%
                  </span>
                </>
              )}
            </div>

            {/* Short description */}
            {product.shortDescription && (
              <p className="text-base leading-relaxed text-ink-600">{product.shortDescription}</p>
            )}

            {/* Rx notice */}
            {product.requiresPrescription && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Shield size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  This product requires a valid prescription.{" "}
                  <Link href="/get-started" className="font-semibold underline hover:text-amber-700">
                    Submit your Rx →
                  </Link>
                </p>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl border border-ink-200">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center rounded-l-xl text-ink-600 hover:bg-ink-50 active:bg-ink-100"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold text-ink-800">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-r-xl text-ink-600 hover:bg-ink-50 active:bg-ink-100"
                >
                  +
                </button>
              </div>

              {product.requiresPrescription ? (
                <Link
                  href="/get-started"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  <FileText size={15} /> Submit Prescription
                </Link>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={addToCart.isPending}
                  className={[
                    "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm transition",
                    addToCart.isSuccess
                      ? "bg-green-600 text-white"
                      : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-70",
                  ].join(" ")}
                >
                  {addToCart.isSuccess ? <Check size={15} /> : <ShoppingCart size={15} />}
                  {addToCart.isPending ? "Adding…" : addToCart.isSuccess ? "Added to cart!" : "Add to Cart"}
                </button>
              )}
            </div>

            {/* Shipping perks */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-ink-100 bg-ink-50 p-4">
              <div className="flex items-center gap-2 text-xs text-ink-600">
                <Truck size={14} className="text-brand-600 shrink-0" />
                Free shipping over $49
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-600">
                <RefreshCcw size={14} className="text-brand-600 shrink-0" />
                30-day returns
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-600">
                <Shield size={14} className="text-brand-600 shrink-0" />
                Licensed pharmacists
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-600">
                <FileText size={14} className="text-brand-600 shrink-0" />
                Health Canada approved
              </div>
            </div>

            {/* Product meta */}
            <div className="space-y-1.5 border-t border-ink-100 pt-3">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <span className="w-14 shrink-0 font-medium text-ink-700">SKU</span>
                <span className="font-mono">{product.sku}</span>
              </div>
              {product.din && (
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="w-14 shrink-0 font-medium text-ink-700">DIN</span>
                  <span className="font-mono">{product.din}</span>
                </div>
              )}
              {product.upc && (
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <span className="w-14 shrink-0 font-medium text-ink-700">UPC</span>
                  <span className="font-mono">{product.upc}</span>
                </div>
              )}
              {category && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 font-medium text-ink-700">Category</span>
                  <Link href={`/shop?category=${category._id}`} className="text-brand-600 hover:underline">
                    {category.name}
                  </Link>
                </div>
              )}
              {brand && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 font-medium text-ink-700">Brand</span>
                  <Link href={`/shop?brand=${brand._id}`} className="text-brand-600 hover:underline">
                    {brand.name}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabbed info section ── */}
        <div className="mt-12 border-t border-ink-100">

          {/* Tab bar — sticky so it stays visible while scrolling */}
          <div className="sticky top-[65px] z-20 -mx-4 bg-white px-4 sm:-mx-6 sm:px-6">
            <div className="flex border-b border-ink-100">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "relative px-5 py-3.5 text-sm font-semibold transition-colors whitespace-nowrap",
                    activeTab === tab
                      ? "text-brand-700"
                      : "text-ink-500 hover:text-ink-800",
                  ].join(" ")}
                >
                  {tab === "Reviews" ? "Reviews (0)" : tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Description tab ── */}
          {activeTab === "Description" && (
            <div className="py-10">
              {product.description ? (
                <div
                  className="prose prose-base max-w-none text-ink-700
                    prose-headings:font-display prose-headings:font-bold prose-headings:text-ink-900
                    prose-h2:text-2xl prose-h3:text-xl
                    prose-p:leading-relaxed prose-p:text-ink-600
                    prose-a:text-brand-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-ink-800
                    prose-ul:text-ink-600 prose-li:marker:text-brand-500"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              ) : (
                <p className="text-ink-400 italic">No description available for this product.</p>
              )}

              {/* Videos — inside description tab */}
              {(product.videoUrls ?? []).length > 0 && (
                <div className="mt-10 border-t border-ink-100 pt-8">
                  <h3 className="mb-5 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
                    <PlayCircle size={18} className="text-brand-600" /> Product Videos
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(product.videoUrls ?? []).map((url) => {
                      const embedUrl = toEmbedUrl(url);
                      if (!embedUrl) return null;
                      return (
                        <div
                          key={url}
                          className="overflow-hidden rounded-2xl border border-ink-100 shadow-sm"
                          style={{ aspectRatio: "16/9" }}
                        >
                          <iframe
                            src={embedUrl}
                            title="Product video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Features tab ── */}
          {activeTab === "Features" && (
            <div className="py-10">
              <div className="grid gap-10 md:grid-cols-2">
                {/* Product highlights */}
                <div>
                  <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Product Highlights</h3>
                  {product.tags.length > 0 ? (
                    <ul className="space-y-2.5">
                      {product.tags.map((tag) => (
                        <li key={tag} className="flex items-start gap-2.5">
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
                          <span className="text-sm capitalize text-ink-700">{tag.replace(/-/g, " ")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-400 italic">No feature tags added yet.</p>
                  )}
                </div>

                {/* Pharmacy guarantees */}
                <div>
                  <h3 className="mb-4 font-display text-lg font-bold text-ink-900">Our Guarantees</h3>
                  <ul className="space-y-2.5">
                    {[
                      { icon: Shield, text: "Dispensed by a licensed Canadian pharmacist" },
                      { icon: CheckCircle2, text: "Health Canada approved products only" },
                      { icon: Truck, text: "Free shipping on Ontario orders over $49" },
                      { icon: RefreshCcw, text: "30-day hassle-free return policy" },
                    ].map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-start gap-2.5">
                        <Icon size={16} className="mt-0.5 shrink-0 text-brand-600" />
                        <span className="text-sm text-ink-700">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Product specs table */}
              <div className="mt-8 overflow-hidden rounded-2xl border border-ink-100">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["SKU",      product.sku],
                      product.din  ? ["DIN",      product.din]  : null,
                      product.upc  ? ["UPC",      product.upc]  : null,
                      ["Category", category?.name ?? "—"],
                      brand        ? ["Brand",    brand.name]   : null,
                      product.requiresPrescription ? ["Prescription", "Required"] : null,
                      product.ageRestriction ? ["Age Restriction", `${product.ageRestriction}+`] : null,
                      product.weight ? ["Weight", `${product.weight} g`] : null,
                    ].filter(Boolean).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-ink-50" : "bg-white"}>
                        <td className="w-1/3 px-4 py-2.5 font-medium text-ink-700">{row![0]}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-600">{row![1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Reviews tab ── */}
          {activeTab === "Reviews" && (
            <div className="py-16 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mb-4 flex justify-center gap-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={28} className="text-ink-200" />
                  ))}
                </div>
                <p className="mb-1 font-display text-lg font-bold text-ink-800">No reviews yet</p>
                <p className="mb-6 text-sm text-ink-500">
                  Be the first to share your experience with this product.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-ink-50 px-4 py-2 text-sm text-ink-500">
                  <ThumbsUp size={14} /> Reviews coming soon
                </div>
                <p className="mt-6 border-t border-ink-100 pt-6 text-xs text-ink-400">
                  Have a question about this product?{" "}
                  <button onClick={() => setActiveTab("Q & A")} className="font-semibold text-brand-600 hover:underline">
                    Ask our pharmacist
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ── Q&A tab ── */}
          {activeTab === "Q & A" && (
            <div className="py-16 text-center">
              <div className="mx-auto max-w-sm">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
                    <HelpCircle size={28} className="text-brand-600" />
                  </div>
                </div>
                <p className="mb-1 font-display text-lg font-bold text-ink-800">Have a question?</p>
                <p className="mb-6 text-sm text-ink-500">
                  Our pharmacists answer product questions Monday–Friday, 9 am–6 pm EST.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                >
                  <MessageCircle size={15} /> Ask a Pharmacist
                </Link>
                <div className="mt-8 flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 text-left">
                  <User size={16} className="mt-0.5 shrink-0 text-ink-400" />
                  <div>
                    <p className="text-sm font-semibold text-ink-700">No questions yet</p>
                    <p className="text-xs text-ink-500">Questions and answers will appear here once submitted.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Recommended products ── */}
        {recommended.length > 0 && (
          <div className="mt-16 border-t border-ink-100 pt-12">
            <div className="mb-7 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-600">
                  From the same category
                </p>
                <h2 className="font-display text-2xl font-bold text-ink-900">You May Also Like</h2>
              </div>
              {category && (
                <Link
                  href={`/shop?category=${category._id}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                >
                  See all <ArrowRight size={14} />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {recommended.map((p) => (
                <RecommendedCard key={p._id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom nav ── */}
        <div className="mt-12 flex items-center justify-between border-t border-ink-100 pt-8">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Shop
          </Link>
          {category && (
            <Link
              href={`/shop?category=${category._id}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-700 transition-colors"
            >
              Browse {category.name} <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

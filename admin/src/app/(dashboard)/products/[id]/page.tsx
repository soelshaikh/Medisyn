"use client";

import { use, useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// useMutation retained for saveMut, archiveMut, removeImgMut, setPrimaryMut, reorderMut
import { useRouter } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { productsApi, categoriesApi, brandsApi } from "@/api/products.api";
import { InventoryCard } from "./InventoryCard";
import { StatusBadge }  from "@/components/common/StatusBadge";
import { Button }       from "@/components/ui/Button";
import { Input }        from "@/components/ui/Input";
import { Select }       from "@/components/ui/Select";
import { Modal }        from "@/components/ui/Modal";
import { Spinner }      from "@/components/ui/Spinner";
import { Tooltip }      from "@/components/ui/Tooltip";
import {
  Upload, Trash2, Star, GripVertical, Plus, X,
  Play, Link2, ImageIcon, Save, Archive, AlertTriangle, Info,
  ArrowLeft, CheckCircle2, ChevronRight,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format";

/* ── Sortable image card ── */
interface SortableImageProps {
  img:            { url: string; alt: string; isPrimary: boolean };
  index:          number;
  productName:    string;
  onRemove:       (url: string) => void;
  removePending:  boolean;
}

function SortableImageCard({ img, index, productName, onRemove, removePending }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: img.url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group relative overflow-hidden rounded-[var(--radius-lg)] border-2 bg-white select-none",
        img.isPrimary ? "border-[var(--color-primary)]" : "border-[var(--color-border)]",
        isDragging ? "shadow-xl" : "",
      ].join(" ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.alt || productName} className="aspect-square w-full object-cover" />

      {/* Primary badge */}
      {img.isPrimary && (
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[9px] font-bold text-white">
          <Star size={8} fill="white" /> Primary
        </span>
      )}

      {/* Position number */}
      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-white">
        {index + 1}
      </span>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)] active:cursor-grabbing"
        >
          <GripVertical size={12} /> Drag to reorder
        </div>
        <button
          onClick={() => onRemove(img.url)}
          disabled={removePending}
          className="flex items-center gap-1 rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600 transition"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}

function fmtCAD(cents: number)  { return (cents / 100).toFixed(2); }
function toCAD(str: string)     { return Math.round(parseFloat(str) * 100); }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <h2 className="text-[var(--font-size-sm)] font-semibold text-[var(--color-text-primary)]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">{label}</label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <button type="button" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors outline-none rounded-full">
              <Info size={12} />
            </button>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--font-size-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition-colors";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const router  = useRouter();

  const { data: product, isLoading } = useQuery({
    queryKey: ["admin-product", id],
    queryFn:  () => productsApi.getById(id),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories-admin"],
    queryFn:  categoriesApi.listAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const { data: brands } = useQuery({
    queryKey: ["brands-admin"],
    queryFn:  brandsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  /* ── form state ── */
  const [name,           setName]           = useState("");
  const [shortDesc,      setShortDesc]      = useState("");
  const [description,    setDescription]    = useState("");
  const [priceStr,       setPriceStr]       = useState("");
  const [compareStr,     setCompareStr]     = useState("");
  const [status,         setStatus]         = useState("draft");
  const [categoryId,     setCategoryId]     = useState("");
  const [brandId,        setBrandId]        = useState("");
  const [din,            setDin]            = useState("");
  const [upc,            setUpc]            = useState("");
  const [requiresRx,     setRequiresRx]     = useState(false);
  const [ageStr,         setAgeStr]         = useState("");
  const [weightStr,      setWeightStr]      = useState("");
  const [tagsStr,        setTagsStr]        = useState("");
  const [metaTitle,      setMetaTitle]      = useState("");
  const [metaDesc,       setMetaDesc]       = useState("");
  const [videoUrls,      setVideoUrls]      = useState<string[]>([]);
  const [newVideoUrl,    setNewVideoUrl]    = useState("");
  const [initialized,    setInitialized]    = useState(false);

  /* ── ui state ── */
  const [archiveModal,   setArchiveModal]   = useState(false);
  const [uploadingImg,   setUploadingImg]   = useState(false);
  const [imgError,       setImgError]       = useState("");
  const [saveError,      setSaveError]      = useState("");
  const [savedOk,        setSavedOk]        = useState(false);
  const fileRef        = useRef<HTMLInputElement>(null);
  const lastImagesKey  = useRef("");
  const [localImages, setLocalImages] = useState<Array<{ url: string; alt: string; isPrimary: boolean }>>([]);

  /* seed form once */
  if (product && !initialized) {
    setName(product.name);
    setShortDesc(product.shortDescription ?? "");
    setDescription(product.description ?? "");
    setPriceStr(fmtCAD(product.price));
    setCompareStr(product.compareAtPrice ? fmtCAD(product.compareAtPrice) : "");
    setStatus(product.status);
    setCategoryId(typeof product.categoryId === "object" ? product.categoryId._id : (product.categoryId ?? ""));
    setBrandId(product.brandId && typeof product.brandId === "object" ? product.brandId._id : (product.brandId ?? ""));
    setDin(product.din ?? "");
    setUpc(product.upc ?? "");
    setRequiresRx(product.requiresPrescription);
    setAgeStr(product.ageRestriction != null ? String(product.ageRestriction) : "");
    setWeightStr(product.weight != null ? String(product.weight) : "");
    setTagsStr((product.tags ?? []).join(", "));
    setMetaTitle(product.metaTitle ?? "");
    setMetaDesc(product.metaDescription ?? "");
    setVideoUrls(product.videoUrls ?? []);
    setInitialized(true);
  }

  /* Sync localImages whenever product.images changes (upload / delete / reorder confirmed) */
  if (product) {
    const imagesKey = (product.images ?? []).map((i: { url: string }) => i.url).join(",");
    if (imagesKey !== lastImagesKey.current) {
      lastImagesKey.current = imagesKey;
      setLocalImages(product.images ?? []);
    }
  }

  /* ── save ── */
  const saveMut = useMutation({
    mutationFn: () => {
      const price = toCAD(priceStr);
      if (isNaN(price)) throw new Error("Invalid price");
      return productsApi.update(id, {
        name:                 name.trim(),
        shortDescription:     shortDesc.trim(),
        description:          description.trim(),
        price,
        compareAtPrice:       compareStr ? toCAD(compareStr) : null,
        status,
        categoryId:           categoryId || undefined,
        brandId:              brandId || null,
        din:                  din.trim(),
        upc:                  upc.trim(),
        requiresPrescription: requiresRx,
        ageRestriction:       ageStr ? parseInt(ageStr) : null,
        weight:               weightStr ? parseFloat(weightStr) : null,
        tags:                 tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
        videoUrls,
        metaTitle:            metaTitle.trim(),
        metaDescription:      metaDesc.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setSaveError(""); setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    },
    onError: (e: Error) => { setSaveError(e.message ?? "Save failed."); setSavedOk(false); },
  });

  /* ── image upload ── */
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setImgError(""); setUploadingImg(true);
    try {
      for (const file of Array.from(files)) {
        await productsApi.uploadImage(id, file);
      }
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
    } catch {
      setImgError("Upload failed — max 5 MB, JPEG/PNG/WebP only.");
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const removeImgMut = useMutation({
    mutationFn: (url: string) => productsApi.removeImage(id, url),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["admin-product", id] }),
  });

  const setPrimaryMut = useMutation({
    mutationFn: (url: string) => productsApi.setPrimaryImage(id, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", id] }),
  });

  const reorderMut = useMutation({
    mutationFn: (urls: string[]) => productsApi.reorderImages(id, urls),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["admin-product", id] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = localImages.findIndex((i) => i.url === active.id);
    const newIdx = localImages.findIndex((i) => i.url === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(localImages, oldIdx, newIdx).map((img, idx) => ({ ...img, isPrimary: idx === 0 }));
    setLocalImages(next);
    reorderMut.mutate(next.map((i) => i.url));
  }, [localImages, reorderMut]);

  /* ── archive ── */
  const archiveMut = useMutation({
    mutationFn: () => productsApi.archive(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); setArchiveModal(false); },
  });

  /* ── video helpers ── */
  function addVideo() {
    const url = newVideoUrl.trim();
    if (!url) return;
    setVideoUrls((v) => [...v, url]);
    setNewVideoUrl("");
  }
  function ytThumb(url: string) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
  }
  function videoLabel(url: string) {
    if (url.includes("youtube") || url.includes("youtu.be")) return "YouTube";
    if (url.includes("vimeo")) return "Vimeo";
    return "Video";
  }

  if (isLoading || !product) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>;
  }

  const images = product.images ?? [];

  return (
    <div className="space-y-4">

      {/* ── Product header card ── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] px-5 py-4 flex items-center justify-between gap-6">

        {/* Left: breadcrumb + title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="shrink-0 flex items-center gap-1.5 text-[var(--font-size-xs)] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Products</span>
          </button>

          <ChevronRight size={13} className="shrink-0 text-[var(--color-border-strong)]" />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[var(--font-size-lg)] font-bold text-[var(--color-text-primary)] truncate leading-tight">
                {product.name}
              </h1>
              <StatusBadge status={product.status} />
            </div>
            <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2">
              <span className="font-mono">SKU: {product.sku}</span>
              {typeof product.categoryId === "object" && product.categoryId?.name && (
                <>
                  <span className="text-[var(--color-border-strong)]">·</span>
                  <span>{product.categoryId.name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: save status + actions */}
        <div className="flex items-center gap-3 shrink-0">
          {saveError && (
            <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-error)]">
              <AlertTriangle size={12} /> {saveError}
            </span>
          )}
          {savedOk && (
            <span className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-success-dark)] font-medium">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          <div className="w-px h-5 bg-[var(--color-border)] shrink-0" />
          <Button variant="outline" size="sm" onClick={() => setArchiveModal(true)}>
            <Archive size={13} className="mr-1.5" /> Archive
          </Button>
          <Button size="sm" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
            <Save size={13} className="mr-1.5" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* ── LEFT (main) ── */}
        <div className="space-y-4 lg:col-span-2">

          {/* Product info */}
          <Card title="Product Details">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product Name">
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="SKU" tooltip="SKU cannot be changed after the product is created">
                  <input value={product.sku} disabled className={`${inputCls} cursor-not-allowed bg-[var(--color-surface)] font-mono text-[var(--color-text-muted)]`} />
                </Field>
              </div>
              <Field label="Short Description" tooltip="Shown on product cards — keep it under 150 characters">
                <textarea value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} rows={2} maxLength={150} className={`${inputCls} resize-none`} />
              </Field>
              <Field label="Full Description" tooltip="Supports basic HTML tags for formatting">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className={`${inputCls} resize-y`} />
              </Field>
              <Field label="Tags" tooltip="Comma-separated keywords used for search and filtering — e.g. vitamin, supplement, oral">
                <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="e.g. vitamin, supplement" className={inputCls} />
              </Field>
            </div>
          </Card>

          {/* ── Images ── */}
          <Card title="Product Images">
            <div className="space-y-3">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-6 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
              >
                {uploadingImg ? <Spinner size="md" /> : (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[var(--shadow-sm)]">
                      <Upload size={15} className="text-[var(--color-primary)]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)]">
                        Drop images here or <span className="text-[var(--color-primary)]">click to browse</span>
                      </p>
                      <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">JPEG, PNG, WebP · Max 5 MB</p>
                    </div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

              {imgError && (
                <p className="flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-error)]">
                  <AlertTriangle size={12} /> {imgError}
                </p>
              )}

              {localImages.length > 0 ? (
                <>
                  <p className="text-[var(--font-size-xs)] text-[var(--color-text-muted)]">
                    Drag cards to reorder — first image is the primary / cover image.
                  </p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localImages.map((i) => i.url)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {localImages.map((img, idx) => (
                          <SortableImageCard
                            key={img.url}
                            img={img}
                            index={idx}
                            productName={product.name}
                            onRemove={(url) => removeImgMut.mutate(url)}
                            removePending={removeImgMut.isPending}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-3 text-center">
                  <ImageIcon size={24} className="text-[var(--color-border)]" />
                  <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No images yet — upload above</p>
                </div>
              )}
            </div>
          </Card>

          {/* ── Videos ── */}
          <Card title="Product Videos">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addVideo()}
                    placeholder="YouTube or Vimeo URL…"
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <Button size="sm" onClick={addVideo} disabled={!newVideoUrl.trim()}>
                  <Plus size={14} className="mr-1" /> Add
                </Button>
              </div>

              {videoUrls.length > 0 ? (
                <div className="space-y-2">
                  {videoUrls.map((url, i) => {
                    const thumb = ytThumb(url);
                    return (
                      <div key={i} className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                        <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-border)]">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="thumb" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Play size={16} className="text-[var(--color-text-muted)]" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play size={12} fill="white" className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{videoLabel(url)}</p>
                          <p className="truncate text-[var(--font-size-xs)] text-[var(--color-text-secondary)]">{url}</p>
                        </div>
                        <button onClick={() => setVideoUrls((v) => v.filter((_, j) => j !== i))}
                          className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 transition">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-3 text-center">
                  <Play size={22} className="text-[var(--color-border)]" />
                  <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)]">No videos added yet</p>
                </div>
              )}
            </div>
          </Card>

          {/* ── SEO ── */}
          <Card title="SEO (Optional)">
            <div className="space-y-3">
              <Field label="Meta Title" tooltip="Defaults to product name if blank — max 160 characters">
                <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={160} className={inputCls} />
              </Field>
              <Field label="Meta Description" tooltip="Shown as the description in Google search results — max 320 characters">
                <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={2} maxLength={320} className={`${inputCls} resize-none`} />
              </Field>
            </div>
          </Card>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="space-y-4">

          <Card title="Status & Visibility">
            <div className="space-y-3">
              <Select
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "draft",    label: "Draft — hidden" },
                  { value: "active",   label: "Active — live"  },
                  { value: "archived", label: "Archived"       },
                ]}
              />
              <Select
                label="Category"
                value={categoryId || "_none"}
                onChange={(v) => setCategoryId(v === "_none" ? "" : v)}
                options={[
                  { value: "_none", label: "No category" },
                  ...(categories ?? []).map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
              <Select
                label="Brand"
                value={brandId || "_none"}
                onChange={(v) => setBrandId(v === "_none" ? "" : v)}
                options={[
                  { value: "_none", label: "No brand" },
                  ...(brands ?? []).filter((b) => b.isActive).map((b) => ({ value: b._id, label: b.name })),
                ]}
              />
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={requiresRx} onChange={(e) => setRequiresRx(e.target.checked)} className="h-4 w-4 rounded accent-[var(--color-primary)]" />
                <span className="text-[var(--font-size-sm)] text-[var(--color-text-primary)]">Requires Prescription (Rx)</span>
              </label>
            </div>
          </Card>

          <Card title="Pricing">
            <div className="space-y-2.5">
              <Input
                label="Price (CAD) *"
                type="text"
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value.replace(/[^0-9.]/g, ""))}
                tooltip="Enter the selling price in Canadian dollars — e.g. 19.99"
              />
              <Input
                label="Compare-at Price"
                type="text"
                inputMode="decimal"
                value={compareStr}
                onChange={(e) => setCompareStr(e.target.value.replace(/[^0-9.]/g, ""))}
                tooltip="Optional — the original price before a sale. Shown crossed out to customers."
              />
            </div>
          </Card>

          <InventoryCard
            productId={id}
            productName={product.name}
            inventory={product.inventory}
          />

          <Card title="Drug Identifiers">
            <div className="space-y-2.5">
              <Input
                label="DIN"
                type="text"
                value={din}
                onChange={(e) => setDin(e.target.value)}
                placeholder="e.g. 02241895"
                tooltip="Health Canada Drug Identification Number — 8 digits"
              />
              <Input
                label="UPC"
                type="text"
                value={upc}
                onChange={(e) => setUpc(e.target.value)}
                placeholder="e.g. 771313249744"
                tooltip="Universal Product Code / barcode"
              />
            </div>
          </Card>

          <Card title="Physical">
            <div className="space-y-2.5">
              <Input
                label="Weight (grams)"
                type="text"
                inputMode="decimal"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 50"
                tooltip="Product weight in grams — used for shipping rate calculations"
              />
              <Input
                label="Age Restriction"
                type="text"
                inputMode="numeric"
                value={ageStr}
                onChange={(e) => setAgeStr(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 18"
                tooltip="Minimum age required to purchase. Leave blank for no restriction."
              />
            </div>
          </Card>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-1.5">
            {([
              ["ID",      product._id.slice(-8)],
              ["Slug",    `/${product.slug}`],
              ["Created", fmtDateTime(product.createdAt)],
              ["Updated", fmtDateTime(product.updatedAt)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[var(--font-size-xs)]">
                <span className="text-[var(--color-text-muted)]">{k}</span>
                <span className="font-mono text-[var(--color-text-secondary)]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Archive modal */}
      <Modal open={archiveModal} onClose={() => setArchiveModal(false)} title="Archive Product">
        <div className="space-y-4">
          <p className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
            This hides the product from the shop. You can restore it anytime by setting the status back to Active.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setArchiveModal(false)}>Cancel</Button>
            <Button variant="danger" loading={archiveMut.isPending} onClick={() => archiveMut.mutate()}>
              Archive Product
            </Button>
          </div>
        </div>
      </Modal>


    </div>
  );
}

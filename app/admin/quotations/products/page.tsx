"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Image as ImageIcon, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { useAuth, isAdminLevel } from "@/lib/auth";
import { fmtInr } from "@/lib/quotation-schema";
import {
  absoluteUrl,
  createProduct,
  deleteProduct,
  fetchCatalogue,
  reorderProducts,
  updateProduct,
  type CatalogueProduct,
  type CatalogueProductInput,
} from "@/lib/quotations-api";

const ROW_STYLES = ["Detailed", "Compact"] as const;

type Draft = {
  name: string;
  brand: string;
  brand_sub_label: string;
  model: string;
  headline: string;
  spec_lines: string;
  warranty_label: string;
  default_unit_price: string;
  default_row_style: (typeof ROW_STYLES)[number];
};

const empty: Draft = {
  name: "", brand: "", brand_sub_label: "", model: "", headline: "", spec_lines: "",
  warranty_label: "", default_unit_price: "", default_row_style: "Detailed",
};

function toDraft(p: CatalogueProduct): Draft {
  return {
    name: p.name, brand: p.brand ?? "", brand_sub_label: p.brand_sub_label ?? "", model: p.model ?? "",
    headline: p.headline, spec_lines: p.spec_lines ?? "", warranty_label: p.warranty_label ?? "",
    default_unit_price: p.default_unit_price ? p.default_unit_price.replace(/\.?0+$/, "") : "",
    default_row_style: p.default_row_style === "COMPACT" ? "Compact" : "Detailed",
  };
}

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = "Name is required";
  if (!d.headline.trim()) e.headline = "Product name & description is required";
  if (d.default_unit_price.trim() && !/^\d{1,9}(\.\d{1,2})?$/.test(d.default_unit_price.trim()))
    e.default_unit_price = "Enter an amount like 38000 or 38000.50";
  return e;
}

export default function CataloguePage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();
  const [rows, setRows] = useState<CatalogueProduct[]>([]);
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogueProduct | "new" | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isAdminLevel(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  const load = useCallback(async () => {
    try {
      setRows(await fetchCatalogue(authFetch, "", "all"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the catalogue");
    }
  }, [authFetch]);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  if (!ready || !user || !isAdminLevel(user.role)) return null;

  const visible = rows.filter((r) => showRetired || r.active);
  const activeIds = rows.filter((r) => r.active).map((r) => r.id);

  const move = async (id: number, dir: -1 | 1) => {
    const order = [...activeIds];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    try {
      const retiredIds = rows.filter((r) => !r.active).map((r) => r.id);
      setRows(await reorderProducts(authFetch, [...order, ...retiredIds]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reorder");
    }
  };

  const retire = async (p: CatalogueProduct) => {
    try {
      await deleteProduct(authFetch, p.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retire the product");
    }
  };

  const restore = async (p: CatalogueProduct) => {
    try {
      await updateProduct(authFetch, p.id, { active: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore the product");
    }
  };

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <Link href="/admin/quotations" className="text-[13px] text-ink-muted transition-colors hover:text-ink">← Quotations</Link>
          <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Quotations</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">Product catalogue</h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Upload a product once — brand, model, description, spec lines, warranty label, price and photo — and add it to any quotation in one click.
            Editing here never changes quotations already issued.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-xl2 border border-accent-danger/30 bg-white p-4 text-[14px] text-accent-danger">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-[14px] text-ink-muted">
            <input type="checkbox" className="accent-black" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
            Show retired products
          </label>
          <Button type="button" onClick={() => setEditing("new")}>
            <Plus size={16} /> Add product
          </Button>
        </div>

        {editing && (
          <ProductEditor
            product={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={async () => { setEditing(null); await load(); }}
            onError={setError}
          />
        )}

        <div className="mt-6 overflow-x-auto rounded-xl2 border border-line bg-white">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-raised text-left text-[12px] uppercase tracking-[0.12em] text-ink-subtle">
              <tr>
                <th className="px-4 py-3 w-20">Photo</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Brand / model</th>
                <th className="px-4 py-3 text-right">Default price</th>
                <th className="px-4 py-3">Style</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const thumb = absoluteUrl(p.image_url);
                const pos = activeIds.indexOf(p.id);
                return (
                  <tr key={p.id} className={`border-t border-line ${p.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-12 w-12 rounded-lg border border-line bg-white object-contain" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-line text-ink-subtle"><ImageIcon size={16} /></div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{p.name}</div>
                      <div className="mt-0.5 max-w-md truncate text-[12.5px] text-ink-muted">{p.headline.replace(/\[\[|\]\]/g, "")}</div>
                      {!p.active && <span className="mt-1 inline-block rounded-md bg-surface-sunken px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-ink-subtle">Retired</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {p.brand ?? "—"}
                      {p.model ? <span className="block text-[12.5px]">{p.model.replace("\n", " ")}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{p.default_unit_price ? `₹ ${fmtInr(p.default_unit_price)}` : "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{p.default_row_style === "COMPACT" ? "Compact" : "Detailed"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.active && (
                          <>
                            <button type="button" aria-label="Move up" disabled={pos <= 0} onClick={() => move(p.id, -1)} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-ink disabled:opacity-30"><ArrowUp size={16} /></button>
                            <button type="button" aria-label="Move down" disabled={pos < 0 || pos >= activeIds.length - 1} onClick={() => move(p.id, 1)} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-ink disabled:opacity-30"><ArrowDown size={16} /></button>
                          </>
                        )}
                        <button type="button" aria-label="Edit" onClick={() => setEditing(p)} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-ink"><Pencil size={16} /></button>
                        {p.active ? (
                          <button type="button" aria-label="Retire" onClick={() => retire(p)} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-accent-danger"><Trash2 size={16} /></button>
                        ) : (
                          <button type="button" aria-label="Restore" onClick={() => restore(p)} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-ink"><RotateCcw size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-muted">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function ProductEditor({
  product,
  onClose,
  onSaved,
  onError,
}: {
  product: CatalogueProduct | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { authFetch } = useAuth();
  const [d, setD] = useState<Draft>(product ? toDraft(product) : empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(absoluteUrl(product?.image_url));
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value }));

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setRemoveImage(false);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    const errs = validate(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const blank = (v: string) => (v.trim() ? v.trim() : null);
    const payload: CatalogueProductInput = {
      name: d.name.trim(),
      brand: blank(d.brand),
      brand_sub_label: blank(d.brand_sub_label),
      model: d.model.trim() ? d.model.replace(/\r/g, "").trim() : null,
      headline: d.headline.trim(),
      spec_lines: d.spec_lines.trim() ? d.spec_lines.replace(/\r/g, "").trim() : null,
      warranty_label: blank(d.warranty_label),
      default_unit_price: blank(d.default_unit_price),
      default_row_style: d.default_row_style === "Compact" ? "COMPACT" : "DETAILED",
      ...(product && removeImage ? { remove_image: true } : {}),
    };
    setSaving(true);
    try {
      if (product) await updateProduct(authFetch, product.id, payload, file);
      else await createProduct(authFetch, payload, file);
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save the product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl2 border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium tracking-tight text-ink">{product ? `Edit ${product.name}` : "New product"}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-ink-subtle hover:text-ink"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <FieldGroup className="md:col-span-3">
          <Label required>Catalogue name</Label>
          <Input value={d.name} onChange={set("name")} placeholder="SK-POS M95 Touch POS System" />
          <FieldError message={errors.name} />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label>Default row style</Label>
          <Select options={ROW_STYLES} value={d.default_row_style} onChange={set("default_row_style")} />
        </FieldGroup>
        <FieldGroup>
          <Label>Default price (₹)</Label>
          <Input inputMode="decimal" value={d.default_unit_price} onChange={set("default_unit_price")} placeholder="38000" />
          <FieldError message={errors.default_unit_price} />
        </FieldGroup>

        <FieldGroup className="md:col-span-2">
          <Label>Brand</Label>
          <Input value={d.brand} onChange={set("brand")} placeholder="SK-POS®" />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label hint="Small line under the brand">Brand sub-label</Label>
          <Input value={d.brand_sub_label} onChange={set("brand_sub_label")} placeholder="by SK-POS®" />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label hint="A second line prints larger">Model</Label>
          <Textarea rows={2} className="min-h-[56px] py-3" value={d.model} onChange={set("model")} placeholder={"Mighty Series\nM95"} />
        </FieldGroup>

        <FieldGroup className="md:col-span-6">
          <Label required hint="[[…]] prints red">Product name &amp; description</Label>
          <Textarea rows={2} className="min-h-[56px] py-3" value={d.headline} onChange={set("headline")} />
          <FieldError message={errors.headline} />
        </FieldGroup>
        <FieldGroup className="md:col-span-4">
          <Label hint="One line per row; [[…]] prints red">Specification lines</Label>
          <Textarea rows={6} className="font-mono text-[13px]" value={d.spec_lines} onChange={set("spec_lines")} />
        </FieldGroup>
        <div className="md:col-span-2 space-y-4">
          <FieldGroup>
            <Label>Warranty label</Label>
            <Input value={d.warranty_label} onChange={set("warranty_label")} placeholder="3 Years Onsite Warranty" />
          </FieldGroup>
          <FieldGroup>
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {preview && !removeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-16 w-16 rounded-lg border border-line bg-white object-contain" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-line text-ink-subtle"><ImageIcon size={18} /></div>
              )}
              <div className="text-[12.5px] text-ink-muted">
                <label className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline">
                  {preview && !removeImage ? "Replace photo" : "Upload a photo"}
                  <input type="file" accept="image/*" className="sr-only" onChange={pick} />
                </label>
                {product && preview && !removeImage && (
                  <button type="button" className="ml-3 text-ink-subtle hover:text-accent-danger" onClick={() => { setRemoveImage(true); setFile(null); }}>
                    Remove
                  </button>
                )}
                <span className="block">PNG or JPEG, up to 5 MB. Resized to 800 px.</span>
              </div>
            </div>
          </FieldGroup>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={save} loading={saving}>{product ? "Save changes" : "Add product"}</Button>
      </div>
    </div>
  );
}

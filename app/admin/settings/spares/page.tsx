"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { Input, Label, Select } from "@/components/ui/Field";
import { useAuth, API_BASE_URL, isAdminLevel } from "@/lib/auth";
import { PRODUCT_CATEGORIES } from "@/lib/options";

type CatalogRow = {
  id: number;
  product_category: string;
  name: string;
  default_price_inr: number;
  active: boolean;
};

// Accessories are offered on every product's spare picker; "Other" has no
// catalog of its own.
const CATALOG_PRODUCTS = [
  ...PRODUCT_CATEGORIES.filter((p) => p !== "Other"),
  "Accessories",
] as const;

type RowDraft = { name: string; price: string };

async function errorDetail(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail.map((d: { msg?: string }) => d.msg ?? "Invalid input").join("; ");
    }
  } catch {}
  return `Server ${res.status}`;
}

export default function SpareCatalogPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<string>("Printer");
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isAdminLevel(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/spare-catalog?include_inactive=true`);
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setRows((await res.json()) as CatalogRow[]);
      setDrafts({});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load spare parts");
    } finally {
      setLoading(false);
    }
  }, [authFetch, router]);

  useEffect(() => {
    if (isAdminLevel(user?.role)) fetchCatalog();
  }, [user, fetchCatalog]);

  // Active parts first, then retired ones, each alphabetical (the API sorts by name).
  const visible = useMemo(
    () =>
      rows
        .filter((r) => r.product_category === product)
        .sort((a, b) => Number(b.active) - Number(a.active)),
    [rows, product]
  );

  const draftFor = (r: CatalogRow): RowDraft =>
    drafts[r.id] ?? { name: r.name, price: String(r.default_price_inr) };

  const setDraft = (r: CatalogRow, patch: Partial<RowDraft>) =>
    setDrafts((prev) => ({ ...prev, [r.id]: { ...draftFor(r), ...patch } }));

  const patchRow = async (r: CatalogRow, body: Record<string, unknown>) => {
    setBusyId(r.id);
    setRowError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/spare-catalog/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await errorDetail(res));
      const updated = (await res.json()) as CatalogRow;
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[r.id];
        return next;
      });
    } catch (e) {
      setRowError(e instanceof Error ? `${r.name}: ${e.message}` : "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  const saveRow = (r: CatalogRow) => {
    const d = draftFor(r);
    const body: Record<string, unknown> = {};
    const name = d.name.trim();
    const price = Math.max(0, parseInt(d.price || "0", 10) || 0);
    if (name && name !== r.name) body.name = name;
    if (price !== r.default_price_inr) body.default_price_inr = price;
    if (Object.keys(body).length > 0) patchRow(r, body);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFlash(null);
    if (!newName.trim()) {
      setFormError("Enter the part name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/spare-catalog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_category: product,
          name: newName.trim(),
          default_price_inr: Math.max(0, parseInt(newPrice || "0", 10) || 0),
        }),
      });
      if (!res.ok) throw new Error(await errorDetail(res));
      const body = (await res.json()) as CatalogRow;
      setFlash(`Added ${body.name} to ${body.product_category}.`);
      setNewName("");
      setNewPrice("");
      setRows((prev) => [...prev, body]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add part");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || !user || !isAdminLevel(user.role)) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Settings · Spare parts
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            Spare parts &amp; prices
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            The parts engineers pick from while resolving a ticket. Prices are in
            rupees <strong>including GST</strong>. Changing a price only affects
            parts added from now on — tickets keep the price they were billed at.
            Accessories are offered on every product.
          </p>
        </div>

        <div className="mt-8 max-w-xs">
          <Label htmlFor="sc_product">Product</Label>
          <Select
            id="sc_product"
            options={CATALOG_PRODUCTS}
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setFlash(null);
              setFormError(null);
              setRowError(null);
            }}
          />
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl2 border border-line shadow-soft">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="bg-surface-raised">
              <tr className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                <Th>Part</Th>
                <Th>Price (₹, incl. GST)</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-subtle">Loading…</td></tr>
              ) : error ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-red-600">{error}</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-subtle">No parts for {product} yet.</td></tr>
              ) : (
                visible.map((r) => {
                  const d = draftFor(r);
                  const price = Math.max(0, parseInt(d.price || "0", 10) || 0);
                  const dirty = d.name.trim() !== r.name || price !== r.default_price_inr;
                  return (
                    <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                      <Td>
                        <Input
                          aria-label="Part name"
                          value={d.name}
                          maxLength={160}
                          disabled={!r.active}
                          onChange={(e) => setDraft(r, { name: e.target.value })}
                        />
                      </Td>
                      <Td>
                        <Input
                          aria-label={`Price for ${r.name}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={d.price}
                          disabled={!r.active}
                          onChange={(e) => setDraft(r, { price: e.target.value })}
                          className="max-w-[140px]"
                        />
                        {r.active && r.default_price_inr === 0 && !dirty && (
                          <p className="mt-1 text-[11.5px] text-amber-700">Price not set</p>
                        )}
                      </Td>
                      <Td>
                        {r.active ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] text-neutral-600">
                            Retired
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {r.active && (
                            <button
                              type="button"
                              disabled={!dirty || busyId === r.id}
                              onClick={() => saveRow(r)}
                              className="rounded-md bg-ink px-2.5 py-1 text-[12px] text-white transition-colors hover:bg-ink/90 disabled:opacity-40"
                            >
                              Save
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => patchRow(r, { active: !r.active })}
                            className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-ink transition-colors hover:border-ink hover:bg-surface-raised disabled:opacity-50"
                          >
                            {r.active ? "Retire" : "Restore"}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {rowError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
            {rowError}
          </div>
        )}

        <div className="mt-10 rounded-xl2 border border-line bg-white p-6 shadow-soft">
          <h2 className="text-[15px] font-medium text-ink">Add a part to {product}</h2>
          <form onSubmit={handleAdd} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="sc_name" required>Part name</Label>
              <Input
                id="sc_name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={160}
                autoComplete="off"
                placeholder="e.g. Paper sensor"
              />
            </div>
            <div>
              <Label htmlFor="sc_price">Price (₹, incl. GST)</Label>
              <Input
                id="sc_price"
                type="number"
                min={0}
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0"
              />
            </div>

            {formError && (
              <div className="md:col-span-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
                {formError}
              </div>
            )}
            {flash && (
              <div className="md:col-span-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
                {flash}
              </div>
            )}

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl2 bg-ink px-6 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add part"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-top">{children}</td>;
}

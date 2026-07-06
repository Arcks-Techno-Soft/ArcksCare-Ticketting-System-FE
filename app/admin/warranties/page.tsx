"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import { fmtIstDate } from "@/lib/format-date";
import {
  WARRANTY_PRODUCTS,
  WARRANTY_DURATIONS_MONTHS,
} from "@/lib/warranty-options";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type WarrantyOut = {
  id: number;
  product_name: string;
  serial_number: string;
  invoice_number: string | null;
  sale_date: string; // ISO yyyy-mm-dd (the invoice date)
  warranty_months: number;
  expiry_date: string; // ISO yyyy-mm-dd
  is_active: boolean;
  notes: string | null;
  created_by: { name?: string; username?: string } | null;
  created_at: string;
};

const DURATION_OTHER = "Other (type months)";
const DURATION_OPTIONS = [
  ...WARRANTY_DURATIONS_MONTHS.map((m) => `${m} months`),
  DURATION_OTHER,
];
const DEFAULT_DURATION = `${WARRANTY_DURATIONS_MONTHS[1]} months`; // 12 months

/** One product line in the form. Invoice number/date/notes are shared across
 *  all rows; each product carries its own name, serial and duration. */
type ProductRow = {
  productName: string;
  serial: string;
  durationChoice: string;
  customMonths: string;
  dupWarning: string | null;
};

function emptyProductRow(): ProductRow {
  return {
    productName: "",
    serial: "",
    durationChoice: DEFAULT_DURATION,
    customMonths: "",
    dupWarning: null,
  };
}

/** Resolve a row's chosen duration to a number of months (or null if invalid). */
function rowMonths(row: ProductRow): number | null {
  if (row.durationChoice === DURATION_OTHER) {
    const n = Number(row.customMonths);
    return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
  }
  const n = parseInt(row.durationChoice, 10);
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/* Date helpers — the form captures sale date as DD-MM-YYYY                    */
/* -------------------------------------------------------------------------- */

/** Parse "DD-MM-YYYY" (also tolerates "/" or "." separators). Returns a Date at
 *  local midnight, or null if the string isn't a valid calendar date. */
function parseDMY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Reject rollovers like 31-02-2025 → 03 Mar.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day)
    return null;
  return d;
}

/** Date → "YYYY-MM-DD" for the API payload. */
function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Add whole months, clamping the day to the last day of the target month.
 *  Mirrors the backend `_add_months` so the live preview matches the stored
 *  expiry exactly. */
function addMonths(start: Date, months: number): Date {
  const zb = start.getMonth() + months;
  const year = start.getFullYear() + Math.floor(zb / 12);
  const month = ((zb % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(start.getDate(), lastDay));
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function WarrantyManagementPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  // Form fields — invoice number/date/notes are shared; products is the
  // repeatable list registered together under that one invoice.
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saleDate, setSaleDate] = useState(""); // Invoice date, DD-MM-YYYY
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([emptyProductRow()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Registry
  const [rows, setRows] = useState<WarrantyOut[]>([]);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  // Live duplicate warning (serial already registered) — one abort controller
  // reused across per-row serial lookups (blurs happen one at a time).
  const dupAbort = useRef<AbortController | null>(null);

  // Only Admin / Manager may use this section.
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/admin/login");
    } else if (!allowed) {
      router.replace("/admin/tickets");
    }
  }, [ready, user, allowed, router]);

  /* ---- shared sale date, parsed once ---- */
  const saleDateObj = useMemo(() => parseDMY(saleDate), [saleDate]);

  /* ---- per-row expiry preview (shared invoice date + the row's duration) ---- */
  const rowPreview = useCallback(
    (row: ProductRow) => {
      const m = rowMonths(row);
      if (!saleDateObj || m == null) return null;
      const expiry = addMonths(new Date(saleDateObj), m);
      const left = daysBetween(new Date(), new Date(expiry));
      return { expiry, left };
    },
    [saleDateObj]
  );

  /* ---- product row mutators ---- */
  const updateRow = useCallback(
    (i: number, patch: Partial<ProductRow>) =>
      setProducts((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))),
    []
  );
  const addRow = () => setProducts((prev) => [...prev, emptyProductRow()]);
  const removeRow = (i: number) =>
    setProducts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  /* ---- load registry ---- */
  const loadList = useCallback(
    async (q = "") => {
      if (!user) return;
      setLoadingList(true);
      try {
        const url = new URL(`${API_BASE_URL}/api/v1/admin/warranties`);
        if (q.trim()) url.searchParams.set("q", q.trim());
        const res = await authFetch(url.toString());
        if (res.ok) setRows(await res.json());
      } catch {
        /* non-fatal */
      } finally {
        setLoadingList(false);
      }
    },
    [user, authFetch]
  );

  useEffect(() => {
    if (user && allowed) loadList();
  }, [user, allowed, loadList]);

  /* ---- debounced registry search ---- */
  useEffect(() => {
    if (!user || !allowed) return;
    const t = setTimeout(() => loadList(search), 300);
    return () => clearTimeout(t);
  }, [search, user, allowed, loadList]);

  /* ---- check a row's serial on blur ---- */
  const checkSerial = useCallback(
    async (i: number, serialValue: string) => {
      const s = serialValue.trim();
      updateRow(i, { dupWarning: null });
      if (!s) return;
      dupAbort.current?.abort();
      const ac = new AbortController();
      dupAbort.current = ac;
      try {
        const url = new URL(`${API_BASE_URL}/api/v1/admin/warranties/lookup`);
        url.searchParams.set("serial", s);
        const res = await authFetch(url.toString(), { signal: ac.signal });
        if (res.ok) {
          const data = (await res.json()) as { found: boolean; warranty?: WarrantyOut };
          if (data.found && data.warranty) {
            updateRow(i, {
              dupWarning:
                `Already registered — serial ${data.warranty.serial_number} ` +
                `(${data.warranty.product_name}), expires ${fmtIstDate(data.warranty.expiry_date)}.`,
            });
          }
        }
      } catch {
        /* ignore — the create call still enforces uniqueness */
      }
    },
    [authFetch, updateRow]
  );

  const resetForm = () => {
    setInvoiceNumber("");
    setSaleDate("");
    setNotes("");
    setProducts([emptyProductRow()]);
  };

  /* ---- submit — registers every product under the shared invoice atomically ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (invoiceNumber.trim().length < 1) return setError("Enter the invoice number.");
    const d = parseDMY(saleDate);
    if (!d) return setError("Enter the invoice date as DD-MM-YYYY.");
    if (d.getTime() > Date.now()) return setError("Invoice date cannot be in the future.");

    // Validate every product row.
    const items: { product_name: string; serial_number: string; warranty_months: number }[] = [];
    const seenSerials = new Set<string>();
    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const n = products.length > 1 ? ` for product ${i + 1}` : "";
      if (row.productName.trim().length < 1) return setError(`Select or type a product name${n}.`);
      if (row.serial.trim().length < 1) return setError(`Enter the serial number${n}.`);
      const m = rowMonths(row);
      if (m == null) return setError(`Choose a warranty duration${n} (or type a custom number of months).`);
      const key = row.serial.trim().replace(/\s+/g, " ").toUpperCase();
      if (seenSerials.has(key)) return setError(`Serial "${row.serial.trim()}" is entered more than once.`);
      seenSerials.add(key);
      items.push({
        product_name: row.productName.trim(),
        serial_number: row.serial.trim(),
        warranty_months: m,
      });
    }

    const payload = {
      invoice_number: invoiceNumber.trim(),
      sale_date: toISODate(d),
      notes: notes.trim() || null,
      products: items,
    };

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/warranties/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = `Server ${res.status}`;
        try {
          const j = JSON.parse(text);
          msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {
          msg = text.slice(0, 200);
        }
        // 409 = one or more serials already registered (nothing was saved).
        if (res.status === 409) alert("Already added warranty for one of these products");
        setError(msg);
        return;
      }

      const created = (await res.json()) as WarrantyOut[];
      setSuccess(
        created.length === 1
          ? `Warranty registered for ${created[0].product_name} (serial ${created[0].serial_number}). ` +
              `Covered until ${fmtIstDate(created[0].expiry_date)}.`
          : `${created.length} warranties registered under invoice ${invoiceNumber.trim()}.`
      );
      setRows((prev) => [...created, ...prev]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this warranty record?")) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/warranties/${id}`, {
        method: "DELETE",
      });
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* non-fatal */
    }
  };

  if (!ready || !user || !allowed) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-4xl font-medium tracking-tightest text-ink">
          Warranty Management
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Register a sold unit by its serial number. While a unit is under warranty,
          service charge and spare parts are waived on any ticket raised against it.
        </p>

        {/* ---------------- Registration form ---------------- */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-xl2 border border-line bg-white p-6"
        >
          {/* Shared invoice fields — one invoice covers every product below. */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="invoice_number" required>Invoice number</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2025-00123"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="sale_date" required>Invoice date</Label>
              <Input
                id="sale_date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                placeholder="DD-MM-YYYY"
                inputMode="numeric"
              />
              <p className="mt-1 text-[12px] text-ink-subtle">Format: DD-MM-YYYY</p>
            </div>
          </div>

          {/* Shared product datalist, used by every product row's autocomplete. */}
          <datalist id="warranty-products">
            {WARRANTY_PRODUCTS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          {/* Products — one row per unit sold on this invoice. */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
              <span className="text-[12px] text-ink-subtle">
                {products.length} product{products.length === 1 ? "" : "s"} on this invoice
              </span>
            </div>

            {products.map((row, i) => {
              const preview = rowPreview(row);
              return (
                <div
                  key={i}
                  className="relative space-y-4 rounded-xl2 border border-line p-4"
                >
                  {products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="absolute right-3 top-3 rounded-md px-2 py-0.5 text-[12px] text-ink-subtle hover:text-accent-danger"
                      aria-label={`Remove product ${i + 1}`}
                    >
                      ✕ Remove
                    </button>
                  )}

                  <div>
                    <Label htmlFor={`product-${i}`} required>Product name</Label>
                    <Input
                      id={`product-${i}`}
                      list="warranty-products"
                      value={row.productName}
                      onChange={(e) => updateRow(i, { productName: e.target.value })}
                      placeholder="Start typing or pick from the list…"
                      autoComplete="off"
                    />
                    {i === 0 && (
                      <p className="mt-1 text-[12px] text-ink-subtle">
                        {WARRANTY_PRODUCTS.length} products from your sales records — or type your own.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div>
                      <Label htmlFor={`serial-${i}`} required>Serial number</Label>
                      <Input
                        id={`serial-${i}`}
                        value={row.serial}
                        onChange={(e) => updateRow(i, { serial: e.target.value, dupWarning: null })}
                        onBlur={(e) => checkSerial(i, e.target.value)}
                        placeholder="e.g. S2407050022"
                        autoComplete="off"
                      />
                      {row.dupWarning && (
                        <p className="mt-1.5 text-[12.5px] text-accent-danger">{row.dupWarning}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor={`duration-${i}`} required>Warranty duration</Label>
                      <Select
                        id={`duration-${i}`}
                        options={DURATION_OPTIONS}
                        placeholder="Select duration"
                        value={row.durationChoice}
                        onChange={(e) => updateRow(i, { durationChoice: e.target.value })}
                      />
                      {row.durationChoice === DURATION_OTHER && (
                        <Input
                          className="mt-2"
                          value={row.customMonths}
                          onChange={(e) =>
                            updateRow(i, { customMonths: e.target.value.replace(/[^\d]/g, "") })
                          }
                          placeholder="Months (e.g. 9)"
                          inputMode="numeric"
                          aria-label="Custom warranty months"
                        />
                      )}
                    </div>

                    <div>
                      <Label>Warranty expires</Label>
                      <div className="mt-1 flex h-[52px] items-center rounded-xl2 border border-line bg-surface-raised px-4 text-[14px]">
                        {preview ? (
                          <span className="text-ink">
                            {fmtIstDate(preview.expiry)}
                            <span
                              className={`ml-2 text-[12.5px] ${
                                preview.left >= 0 ? "text-emerald-600" : "text-accent-danger"
                              }`}
                            >
                              {preview.left >= 0
                                ? `· ${preview.left} day${preview.left === 1 ? "" : "s"} left`
                                : "· expired"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-ink-subtle">Fill invoice date + duration</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-xl2 border border-dashed border-line py-2.5 text-[13px] text-ink-muted transition-colors hover:border-ink-soft hover:text-ink"
            >
              + Add product
            </button>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional, applies to the whole invoice)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Customer, remarks, or any other detail…"
            />
          </div>

          <FieldError message={error ?? undefined} />
          {success && (
            <p className="text-[13px] text-emerald-600">{success}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="md" onClick={resetForm}>
              Clear
            </Button>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              {products.length > 1 ? `Register ${products.length} warranties` : "Register warranty"}
            </Button>
          </div>
        </form>

        {/* ---------------- Registry ---------------- */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-medium tracking-tight text-ink">
              Registered warranties
            </h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial, product, or invoice…"
              className="w-64 rounded-xl2 border border-line bg-white px-3.5 py-2 text-[13.5px] text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl2 border border-line">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-raised text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Serial</th>
                  <th className="px-4 py-3 font-medium">Invoice no.</th>
                  <th className="px-4 py-3 font-medium">Invoice date</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-ink-subtle">
                      {loadingList ? "Loading…" : "No warranties registered yet."}
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">{r.product_name}</td>
                    <td className="px-4 py-3 font-mono text-[12.5px] text-ink">{r.serial_number}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{fmtIstDate(r.sale_date)}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.warranty_months} mo</td>
                    <td className="px-4 py-3 text-ink-muted">{fmtIstDate(r.expiry_date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          r.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-accent-danger"
                        }`}
                      >
                        {r.is_active ? "Under warranty" : "Expired"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="text-[12.5px] text-ink-subtle underline-offset-2 hover:text-accent-danger hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

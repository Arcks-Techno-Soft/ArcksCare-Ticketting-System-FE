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

  // Form fields
  const [productName, setProductName] = useState("");
  const [serial, setSerial] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saleDate, setSaleDate] = useState(""); // Invoice date, DD-MM-YYYY
  const [durationChoice, setDurationChoice] = useState(`${WARRANTY_DURATIONS_MONTHS[1]} months`); // default 12
  const [customMonths, setCustomMonths] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Registry
  const [rows, setRows] = useState<WarrantyOut[]>([]);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  // Live duplicate warning (serial already registered)
  const [dupWarning, setDupWarning] = useState<string | null>(null);
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

  /* ---- resolve the chosen duration to a number of months ---- */
  const months: number | null = useMemo(() => {
    if (durationChoice === DURATION_OTHER) {
      const n = Number(customMonths);
      return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
    }
    const n = parseInt(durationChoice, 10);
    return Number.isFinite(n) ? n : null;
  }, [durationChoice, customMonths]);

  /* ---- live expiry preview ---- */
  const preview = useMemo(() => {
    const d = parseDMY(saleDate);
    if (!d || months == null) return null;
    const expiry = addMonths(new Date(d), months);
    const left = daysBetween(new Date(), new Date(expiry));
    return { expiry, left };
  }, [saleDate, months]);

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

  /* ---- check serial on blur ---- */
  const checkSerial = useCallback(async () => {
    const s = serial.trim();
    setDupWarning(null);
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
          setDupWarning(
            `Already added warranty for this product — serial ${data.warranty.serial_number} ` +
              `(${data.warranty.product_name}), expires ${fmtIstDate(data.warranty.expiry_date)}.`
          );
        }
      }
    } catch {
      /* ignore — the create call still enforces uniqueness */
    }
  }, [serial, authFetch]);

  const resetForm = () => {
    setProductName("");
    setSerial("");
    setInvoiceNumber("");
    setSaleDate("");
    setDurationChoice(`${WARRANTY_DURATIONS_MONTHS[1]} months`);
    setCustomMonths("");
    setNotes("");
    setDupWarning(null);
  };

  /* ---- submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (productName.trim().length < 1) return setError("Select or type a product name.");
    if (serial.trim().length < 1) return setError("Enter the product serial number.");
    if (invoiceNumber.trim().length < 1) return setError("Enter the invoice number.");
    const d = parseDMY(saleDate);
    if (!d) return setError("Enter the invoice date as DD-MM-YYYY.");
    if (d.getTime() > Date.now()) return setError("Invoice date cannot be in the future.");
    if (months == null) return setError("Choose a warranty duration (or type a custom number of months).");

    const payload = {
      product_name: productName.trim(),
      serial_number: serial.trim(),
      invoice_number: invoiceNumber.trim(),
      sale_date: toISODate(d),
      warranty_months: months,
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/warranties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        // Duplicate serial — surface the exact alert the team asked for.
        alert("Already added warranty for this product");
        setError("This serial number already has a registered warranty.");
        setDupWarning("Already added warranty for this product.");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = `Server ${res.status}`;
        try {
          const j = JSON.parse(text);
          msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
        } catch {
          msg = text.slice(0, 200);
        }
        throw new Error(msg);
      }

      const created = (await res.json()) as WarrantyOut;
      setSuccess(
        `Warranty registered for ${created.product_name} (serial ${created.serial_number}). ` +
          `Covered until ${fmtIstDate(created.expiry_date)}.`
      );
      setRows((prev) => [created, ...prev]);
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
          <div>
            <Label htmlFor="product" required>Product name</Label>
            <Input
              id="product"
              list="warranty-products"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Start typing or pick from the list…"
              autoComplete="off"
            />
            <datalist id="warranty-products">
              {WARRANTY_PRODUCTS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="mt-1 text-[12px] text-ink-subtle">
              {WARRANTY_PRODUCTS.length} products from your sales records — or type your own.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="serial" required>Serial number</Label>
              <Input
                id="serial"
                value={serial}
                onChange={(e) => {
                  setSerial(e.target.value);
                  setDupWarning(null);
                }}
                onBlur={checkSerial}
                placeholder="e.g. S2407050022"
                autoComplete="off"
              />
              {dupWarning && (
                <p className="mt-1.5 text-[12.5px] text-accent-danger">{dupWarning}</p>
              )}
            </div>

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
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="sale_date" required>Invoice Date</Label>
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

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="duration" required>Warranty duration</Label>
              <Select
                id="duration"
                options={DURATION_OPTIONS}
                placeholder="Select duration"
                value={durationChoice}
                onChange={(e) => setDurationChoice(e.target.value)}
              />
              {durationChoice === DURATION_OTHER && (
                <Input
                  className="mt-2"
                  value={customMonths}
                  onChange={(e) => setCustomMonths(e.target.value.replace(/[^\d]/g, ""))}
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

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
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
              Register warranty
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

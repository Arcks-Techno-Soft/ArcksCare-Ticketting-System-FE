"use client";

/**
 * Ship Parts dialog — Owner / Manager / assigned engineer use this to
 * record a courier shipment of spare parts to the worksite.
 *
 * Fields:
 *   - Courier name              (required)
 *   - Departed date             (required, defaults to today)
 *   - Tracking ID               (optional)
 *   - Parts list                (each = catalog item OR free text, + quantity)
 *
 * The dialog is a self-contained modal that the parent opens with `open` and
 * closes via `onClose`. On successful submit we call `onCreated()` so the
 * parent can refresh its shipment list.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";

export type SpareCatalogItem = {
  id: number;
  product_category: string;
  name: string;
  default_price_inr: number;
};

type Draft = {
  // Identifies the row in the UI. Stable across re-renders.
  rowId: string;
  catalog_id: number | null;
  name: string;
  quantity: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Catalog used to populate the searchable picker. */
  catalog: SpareCatalogItem[];
  /**
   * Submit handler — returns null on success or an error message string.
   * Parent owns the actual fetch so it can wire authFetch + base URL.
   */
  onSubmit: (input: {
    courier_name: string;
    tracking_id: string | null;
    departed_at: string; // ISO
    items: { catalog_id: number | null; name: string; quantity: number }[];
  }) => Promise<string | null>;
};

function todayIso(): string {
  // YYYY-MM-DD for the <input type="date">; the API converts to UTC.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let rowSeq = 0;
function newRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

export function ShipPartsDialog({ open, onClose, catalog, onSubmit }: Props) {
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [departedDate, setDepartedDate] = useState(todayIso());
  const [items, setItems] = useState<Draft[]>([
    { rowId: newRowId(), catalog_id: null, name: "", quantity: 1 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset state every time the dialog is reopened — we don't want stale
  // input from a previous shipment leaking into the next one.
  useEffect(() => {
    if (!open) return;
    setCourier("");
    setTracking("");
    setDepartedDate(todayIso());
    setItems([{ rowId: newRowId(), catalog_id: null, name: "", quantity: 1 }]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setRow = (rowId: string, patch: Partial<Draft>) => {
    setItems((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };
  const addRow = () =>
    setItems((rows) => [...rows, { rowId: newRowId(), catalog_id: null, name: "", quantity: 1 }]);
  const removeRow = (rowId: string) =>
    setItems((rows) => (rows.length === 1 ? rows : rows.filter((r) => r.rowId !== rowId)));

  const handleSubmit = async () => {
    setError(null);
    if (courier.trim().length < 2) {
      setError("Courier name is required.");
      return;
    }
    if (!departedDate) {
      setError("Departed date is required.");
      return;
    }
    // Strip empty rows; require at least one valid item.
    const cleaned = items
      .map((r) => ({
        catalog_id: r.catalog_id,
        name: r.name.trim(),
        quantity: r.quantity,
      }))
      .filter((r) => r.catalog_id !== null || r.name.length > 0);
    if (cleaned.length === 0) {
      setError("Add at least one part.");
      return;
    }
    setSubmitting(true);
    // Convert YYYY-MM-DD to UTC midnight ISO so the timezone-naive form
    // input becomes a sortable timestamp.
    const departed_at = new Date(`${departedDate}T00:00:00Z`).toISOString();
    const msg = await onSubmit({
      courier_name: courier.trim(),
      tracking_id: tracking.trim() ? tracking.trim() : null,
      departed_at,
      items: cleaned,
    });
    setSubmitting(false);
    if (msg) setError(msg);
    else onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-10 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl border border-line bg-white shadow-lift"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ship-parts-title"
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
                Logistics
              </p>
              <h2
                id="ship-parts-title"
                className="font-display text-2xl font-medium tracking-tight text-ink"
              >
                Ship parts
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="courier" required>Courier / transport</Label>
                <Input
                  id="courier"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="e.g. Delhivery, Bluedart, Own vehicle"
                />
              </div>
              <div>
                <Label htmlFor="departed" required>Departed date</Label>
                <Input
                  id="departed"
                  type="date"
                  value={departedDate}
                  onChange={(e) => setDepartedDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tracking">Tracking ID (optional)</Label>
                <Input
                  id="tracking"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="e.g. DLV789X-2026"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Parts sent</Label>
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
                >
                  + Add part
                </button>
              </div>
              <ul className="space-y-2">
                {items.map((row) => (
                  <PartRow
                    key={row.rowId}
                    row={row}
                    catalog={catalog}
                    onChange={(patch) => setRow(row.rowId, patch)}
                    onRemove={items.length === 1 ? undefined : () => removeRow(row.rowId)}
                  />
                ))}
              </ul>
            </div>

            <FieldError message={error ?? undefined} />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={submitting}
              onClick={handleSubmit}
            >
              Record shipment
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- searchable part picker ---------------- */

function PartRow({
  row,
  catalog,
  onChange,
  onRemove,
}: {
  row: Draft;
  catalog: SpareCatalogItem[];
  onChange: (patch: Partial<Draft>) => void;
  onRemove?: () => void;
}) {
  return (
    <li className="grid grid-cols-[1fr_90px_auto] items-start gap-2">
      <SearchablePartPicker
        catalog={catalog}
        catalogId={row.catalog_id}
        name={row.name}
        onPick={(picked) => {
          if (picked === null) {
            onChange({ catalog_id: null });
          } else if ("catalog_id" in picked) {
            onChange({ catalog_id: picked.catalog_id, name: picked.name });
          } else {
            onChange({ catalog_id: null, name: picked.name });
          }
        }}
      />
      <input
        type="number"
        min={1}
        max={999}
        value={row.quantity}
        onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })}
        className="h-[44px] rounded-xl2 border border-line bg-white px-3 text-[14px] text-ink hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!onRemove}
        className="h-[44px] rounded-md px-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Remove row"
        title={onRemove ? "Remove row" : "Keep at least one row"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

/* ---------- the search combobox ---------------- */

function SearchablePartPicker({
  catalog,
  catalogId,
  name,
  onPick,
}: {
  catalog: SpareCatalogItem[];
  catalogId: number | null;
  name: string;
  onPick: (
    picked: null | { catalog_id: number; name: string } | { name: string }
  ) => void;
}) {
  // Displayed text in the input. When a catalog item is picked we show its
  // name; otherwise we show whatever the user is typing.
  const selected = catalog.find((c) => c.id === catalogId) ?? null;
  const [query, setQuery] = useState<string>(selected?.name ?? name ?? "");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep input text in sync if parent flips us to a freshly-picked catalog.
  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return catalog.slice(0, 50);
    return catalog
      .filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.product_category.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [catalog, q]);

  const showAdHocOption =
    q.length > 0 &&
    !matches.some((m) => m.name.toLowerCase() === q);

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder="Search parts or type a custom name…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Typing while a catalog item is selected breaks the link to it —
          // user is now editing an ad-hoc name.
          if (catalogId !== null) onPick({ name: e.target.value });
        }}
        onFocus={() => setOpen(true)}
        className="h-[44px] w-full rounded-xl2 border border-line bg-white px-3 text-[14px] text-ink hover:border-line-strong focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
      />
      <AnimatePresence>
        {open && (matches.length > 0 || showAdHocOption) && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl2 border border-line bg-white shadow-lift"
          >
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick({ catalog_id: c.id, name: c.name });
                    setQuery(c.name);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13.5px] text-ink hover:bg-surface-raised"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[11.5px] uppercase tracking-[0.1em] text-ink-subtle">
                    {c.product_category}
                  </span>
                </button>
              </li>
            ))}
            {showAdHocOption && (
              <li className="border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    onPick({ name: query.trim() });
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] text-ink hover:bg-surface-raised"
                >
                  <span className="text-ink-subtle">Use as custom part:</span>
                  <span className="font-medium">{query.trim()}</span>
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

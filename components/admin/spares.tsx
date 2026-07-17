"use client";

/**
 * Spares — engineer-facing list of parts used to resolve a ticket plus the
 * service-fee + running total. Catalog comes from the seeded spare catalog
 * filtered by the ticket's product category. For warranty tickets, spares
 * are recorded but billed at zero.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldError, Input, Label } from "@/components/ui/Field";

export type SpareCatalogItem = {
  id: number;
  product_category: string;
  name: string;
  default_price_inr: number;
};

export type ChargeLineItem = {
  id: number;
  catalog_id: number | null;
  name: string;
  unit_price_inr: number;
  quantity: number;
  line_total_inr: number;
  billable: boolean;
};

export type ChargesSummary = {
  warranty_status: string;
  is_warranty: boolean;
  service_fee_inr: number;
  service_fee_billable_inr: number;
  // Minimum service fee for this ticket (0 = no floor).
  service_fee_min_inr: number;
  spares_list_price_total_inr: number;
  spares_billable_total_inr: number;
  grand_total_inr: number;
  items: ChargeLineItem[];
};

type Props = {
  charges: ChargesSummary | null;
  catalog: SpareCatalogItem[];
  canManage: boolean;
  // Gates the service-fee input specifically. A Super Admin may edit the
  // charge at any status (including CLOSED); everyone else is held to the
  // RESOLVING window, same as the spares. Defaults to `canManage` when omitted.
  canEditFee?: boolean;
  // When true (Super Admin) the service fee may be set below the minimum.
  canWaiveBelowMin?: boolean;
  // Remote-support tickets carry no spare parts — only the service fee shows.
  remote?: boolean;
  busy: boolean;
  error: string | null;
  onAdd: (input: { catalog_id?: number; name?: string; unit_price_inr?: number; quantity: number }) => Promise<void> | void;
  onUpdate: (id: number, input: { unit_price_inr?: number; quantity?: number }) => Promise<void> | void;
  onRemove: (id: number) => Promise<void> | void;
  onServiceFee: (amount: number) => Promise<void> | void;
};

export function Spares({
  charges,
  catalog,
  canManage,
  canEditFee,
  canWaiveBelowMin = false,
  remote = false,
  busy,
  error,
  onAdd,
  onUpdate,
  onRemove,
  onServiceFee,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [feeDraft, setFeeDraft] = useState<string>(
    charges ? String(charges.service_fee_inr) : "0"
  );

  // Keep the fee draft in sync if the parent reloads with a new value.
  useEffect(() => {
    if (charges) setFeeDraft(String(charges.service_fee_inr));
  }, [charges?.service_fee_inr]);

  const pickedCatalog = useMemo(
    () => catalog.find((c) => String(c.id) === pickedId) ?? null,
    [pickedId, catalog]
  );

  const resetAddForm = () => {
    setPickedId("");
    setQuantity("1");
  };

  const submitAdd = async () => {
    if (!pickedCatalog) return;
    const qty = Math.max(1, parseInt(quantity || "1", 10));
    await onAdd({ catalog_id: pickedCatalog.id, quantity: qty });
    setOpen(false);
    resetAddForm();
  };

  if (!charges) {
    return (
      <div className="rounded-xl2 border border-line bg-white shadow-soft">
        <div className="border-b border-line bg-surface-raised px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Spare parts &amp; charges
        </div>
        <div className="px-5 py-4 text-[13px] text-ink-subtle">Loading…</div>
      </div>
    );
  }

  const isWarranty = charges.is_warranty;
  // Service fee has its own gate (Super Admins can edit past RESOLVED); the
  // rest of the card (spares) stays on `canManage`.
  const feeEditable = canEditFee ?? canManage;

  return (
    <div className="rounded-xl2 border border-line bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-surface-raised px-5 py-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          {remote ? "Service charge" : "Spare parts & charges"}
        </span>
        {!remote && isWarranty && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-emerald-700">
            {charges.warranty_status === "AMC" ? "AMC" : "Under warranty"} · spares &amp; service free
          </span>
        )}
      </div>

      {!remote && (
        <ul className="divide-y divide-line/60">
          {charges.items.length === 0 ? (
            <li className="px-5 py-4 text-[13px] text-ink-subtle">
              No spare parts recorded yet.
            </li>
          ) : (
            charges.items.map((it) => (
              <SpareRow
                key={it.id}
                item={it}
                isWarranty={isWarranty}
                canManage={canManage}
                busy={busy}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ))
          )}
        </ul>
      )}

      {!remote && canManage && (
        <div className="border-t border-line">
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-5">
                  <FieldGroup>
                    <Label htmlFor="sp_pick" required>Spare part</Label>
                    <select
                      id="sp_pick"
                      value={pickedId}
                      onChange={(e) => setPickedId(e.target.value)}
                      className="w-full rounded-xl2 border border-line bg-white px-3 py-2.5 text-[14px] text-ink
                                 transition-all hover:border-line-strong focus:border-ink focus:outline-none
                                 focus:ring-2 focus:ring-ink/10"
                    >
                      <option value="">
                        {catalog.length === 0
                          ? "No catalog parts for this product"
                          : "Select a part…"}
                      </option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {" — ₹"}
                          {c.default_price_inr.toLocaleString("en-IN")}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup>
                    <Label htmlFor="sp_qty" required>Quantity</Label>
                    <Input
                      id="sp_qty"
                      type="number"
                      min={1}
                      max={999}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </FieldGroup>

                  {pickedCatalog && (
                    <p className="text-[12.5px] text-ink-subtle">
                      Default price:{" "}
                      <strong>₹{pickedCatalog.default_price_inr.toLocaleString("en-IN")}</strong>
                      {" "}— editable after adding.
                    </p>
                  )}

                  <FieldError message={error ?? undefined} />

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => { setOpen(false); resetAddForm(); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      loading={busy}
                      disabled={!pickedCatalog}
                      onClick={submitAdd}
                    >
                      Add part
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="trigger"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="block w-full px-5 py-3.5 text-left text-[13.5px] text-ink hover:bg-surface-raised transition-colors"
                >
                  + Add a spare part
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ----------------------- charge summary ----------------------- */}
      <div className="border-t border-line bg-surface-raised/40 px-5 py-4">
        {!remote && (
          <SummaryRow
            label="Spares subtotal"
            value={
              isWarranty
                ? (
                    <span>
                      <span className="text-ink-subtle line-through">
                        ₹{charges.spares_list_price_total_inr.toLocaleString("en-IN")}
                      </span>
                      <span className="ml-2 text-emerald-700">Free (warranty)</span>
                    </span>
                  )
                : `₹${charges.spares_billable_total_inr.toLocaleString("en-IN")}`
            }
          />
        )}

        {/* Service fee — always shown and editable while RESOLVING. Out-of-
            warranty tickets carry a minimum (Remote ₹600, Site visit ₹800);
            only an Admin may set below it. */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-muted">Service fee</span>
          {feeEditable ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-ink-subtle">₹</span>
                <input
                  type="number"
                  min={canWaiveBelowMin ? 0 : charges.service_fee_min_inr}
                  value={feeDraft}
                  onChange={(e) => setFeeDraft(e.target.value)}
                  onBlur={() => {
                    const floor = canWaiveBelowMin ? 0 : charges.service_fee_min_inr;
                    // Non-Admins are held at the minimum; an Admin can go lower.
                    const next = Math.max(floor, parseInt(feeDraft || "0", 10));
                    if (next !== charges.service_fee_inr) onServiceFee(next);
                    else setFeeDraft(String(charges.service_fee_inr));
                  }}
                  className="w-24 rounded-md border border-line bg-white px-2 py-1 text-right text-[13.5px] text-ink
                             focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                />
              </div>
              {charges.service_fee_min_inr > 0 && (
                <span className="text-[11.5px] text-ink-subtle">
                  Minimum ₹{charges.service_fee_min_inr.toLocaleString("en-IN")}
                  {canWaiveBelowMin && " · Admin can set lower"}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[13.5px] text-ink">
              ₹{charges.service_fee_inr.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-[13px] font-medium text-ink">Total</span>
          <span className="font-display text-[18px] font-medium text-ink">
            ₹{charges.grand_total_inr.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-[13.5px] text-ink">{value}</span>
    </div>
  );
}

function SpareRow({
  item,
  isWarranty,
  canManage,
  busy,
  onUpdate,
  onRemove,
}: {
  item: ChargeLineItem;
  isWarranty: boolean;
  canManage: boolean;
  busy: boolean;
  onUpdate: (id: number, input: { unit_price_inr?: number; quantity?: number }) => Promise<void> | void;
  onRemove: (id: number) => Promise<void> | void;
}) {
  const [priceDraft, setPriceDraft] = useState(String(item.unit_price_inr));
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity));

  // Sync drafts when parent re-renders with fresh data.
  useEffect(() => { setPriceDraft(String(item.unit_price_inr)); }, [item.unit_price_inr]);
  useEffect(() => { setQtyDraft(String(item.quantity)); }, [item.quantity]);

  const commitPrice = () => {
    const next = Math.max(0, parseInt(priceDraft || "0", 10));
    if (next !== item.unit_price_inr) onUpdate(item.id, { unit_price_inr: next });
    else setPriceDraft(String(item.unit_price_inr));
  };
  const commitQty = () => {
    const next = Math.max(1, parseInt(qtyDraft || "1", 10));
    if (next !== item.quantity) onUpdate(item.id, { quantity: next });
    else setQtyDraft(String(item.quantity));
  };

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">{item.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-muted">
            <div className="flex items-center gap-1.5">
              <span>Qty</span>
              {canManage ? (
                <input
                  type="number"
                  min={1}
                  value={qtyDraft}
                  onChange={(e) => setQtyDraft(e.target.value)}
                  onBlur={commitQty}
                  className="w-14 rounded-md border border-line bg-white px-2 py-0.5 text-right text-[13px] text-ink
                             focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                  disabled={busy}
                />
              ) : (
                <span className="text-ink">{item.quantity}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span>Unit</span>
              <span className="text-ink-subtle">₹</span>
              {canManage ? (
                <input
                  type="number"
                  min={0}
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  onBlur={commitPrice}
                  className="w-24 rounded-md border border-line bg-white px-2 py-0.5 text-right text-[13px] text-ink
                             focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
                  disabled={busy}
                />
              ) : (
                <span className="text-ink">
                  {item.unit_price_inr.toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[13.5px] font-medium text-ink">
            {isWarranty ? (
              <>
                <span className="text-ink-subtle line-through">
                  ₹{item.line_total_inr.toLocaleString("en-IN")}
                </span>
                <span className="ml-1.5 text-emerald-700">Free</span>
              </>
            ) : (
              <>₹{item.line_total_inr.toLocaleString("en-IN")}</>
            )}
          </span>
          {canManage && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(item.id)}
              className="rounded-md px-2 py-0.5 text-[11.5px] text-ink-subtle hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

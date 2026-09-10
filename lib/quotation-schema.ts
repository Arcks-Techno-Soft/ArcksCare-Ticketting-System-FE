import { z } from "zod";

import type { QuotationDraft, QuotationItemDraft } from "./quotations-api";

/**
 * Client-side mirror of backend/app/schemas/quotation.py:QuotationDraft.
 *
 * Numbers are kept as strings in the form (what the inputs hold) and sent as
 * numeric strings — the backend parses them as Decimals and is the only
 * place totals are computed. Multi-line fields (address, model, spec lines)
 * are single textarea strings here and split on submit.
 */

export const ROW_STYLE_LABELS = ["Detailed", "Compact"] as const;
export type RowStyleLabel = (typeof ROW_STYLE_LABELS)[number];
const ROW_STYLE_VALUE: Record<RowStyleLabel, "DETAILED" | "COMPACT"> = {
  Detailed: "DETAILED",
  Compact: "COMPACT",
};

export const TOTALS_LABEL_SETS = ["BASIC", "SIMPLE"] as const;
export const NOTE_STYLES = ["GREEN_ON_BLACK", "RED_TEXT"] as const;
export const NOTE_STYLE_LABELS: Record<(typeof NOTE_STYLES)[number], string> = {
  GREEN_ON_BLACK: "Green on black band (POS)",
  RED_TEXT: "Red text in a box (CCTV)",
};
export const TERMS_PRESETS = ["POS", "CCTV"] as const;
export const SL_NO_OPTIONS = ["Auto", "Show", "Hide"] as const;

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters`).optional().or(z.literal(""));

const money = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter an amount like 38000 or 38000.50");

const quantity = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a quantity like 1 or 2.5")
  .refine((v) => Number(v) > 0, "Quantity must be more than 0");

export const quotationItemSchema = z.object({
  row_style: z.enum(ROW_STYLE_LABELS),
  brand: optionalText(80),
  brand_sub_label: optionalText(80),
  model: optionalText(120),
  headline: z.string().trim().min(1, "Product name / description is required").max(1000),
  spec_lines: optionalText(4000),
  warranty_label: optionalText(80),
  unit_price: money,
  quantity,
  include_image: z.boolean(),
  image_asset: z.string().optional().or(z.literal("")),
  image_storage_key: z.string().optional().or(z.literal("")),
  product_id: z.number().int().nullable().optional(),
});

export const quotationSchema = z.object({
  quotation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  // Empty = let the server assign the next number.
  reference: optionalText(40),
  customer_name: z.string().trim().min(1, "Customer name is required").max(200),
  address_lines: z
    .string()
    .refine((v) => v.split("\n").filter((l) => l.trim()).length <= 6, "At most 6 address lines")
    .refine(
      (v) => v.split("\n").every((l) => l.trim().length <= 120),
      "Each address line must be 120 characters or fewer",
    ),
  customer_gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GSTIN_RE.test(v), "Enter a valid 15-character GSTIN"),
  customer_pan: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || PAN_RE.test(v), "Enter a valid 10-character PAN"),
  contact_name: optionalText(120),
  contact_phone: optionalText(20),
  contact_email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  subject_line: optionalText(200),
  signatory_id: z.coerce.number().int().min(1, "Pick who prepares this quotation"),
  validity_days: z.coerce.number().int().min(1, "At least 1 day").max(365, "At most 365 days"),
  gst_rate: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter a GST rate like 18")
    .refine((v) => Number(v) <= 28, "GST rate cannot exceed 28%"),
  totals_label_set: z.enum(TOTALS_LABEL_SETS),
  note_text: optionalText(300),
  note_style: z.enum(NOTE_STYLES),
  terms_preset: z.enum(TERMS_PRESETS),
  terms: z
    .array(z.object({ text: z.string().trim().max(400, "Keep each term under 400 characters") }))
    .max(12, "At most 12 terms"),
  show_sl_no: z.enum(SL_NO_OPTIONS),
  items: z.array(quotationItemSchema).min(1, "Add at least one item").max(50, "At most 50 items"),
});

export type QuotationFormValues = z.infer<typeof quotationSchema>;
export type QuotationItemFormValues = z.infer<typeof quotationItemSchema>;

const blank = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);

export function emptyItem(rowStyle: RowStyleLabel = "Detailed"): QuotationItemFormValues {
  return {
    row_style: rowStyle,
    brand: "",
    brand_sub_label: "",
    model: "",
    headline: "",
    spec_lines: "",
    warranty_label: "",
    unit_price: "",
    quantity: "1",
    include_image: false,
    image_asset: "",
    image_storage_key: "",
    product_id: null,
  };
}

/** Convert validated form values into the API payload. */
export function toDraft(v: QuotationFormValues): QuotationDraft {
  const items: QuotationItemDraft[] = v.items.map((i) => ({
    row_style: ROW_STYLE_VALUE[i.row_style],
    product_id: i.product_id ?? null,
    brand: blank(i.brand),
    brand_sub_label: blank(i.brand_sub_label),
    // The model textarea keeps its line breaks (second line prints larger).
    model: i.model && i.model.trim() ? i.model.replace(/\r/g, "").trim() : null,
    headline: i.headline.trim(),
    spec_lines: i.spec_lines && i.spec_lines.trim() ? i.spec_lines.replace(/\r/g, "").trim() : null,
    warranty_label: blank(i.warranty_label),
    unit_price: i.unit_price.trim(),
    quantity: i.quantity.trim(),
    include_image: i.include_image,
    image_asset: blank(i.image_asset),
    image_storage_key: blank(i.image_storage_key),
  }));
  return {
    quotation_date: v.quotation_date,
    reference: blank(v.reference),
    customer_name: v.customer_name.trim(),
    address_lines: v.address_lines.split("\n").map((l) => l.trim()).filter(Boolean),
    customer_gstin: blank(v.customer_gstin),
    customer_pan: blank(v.customer_pan),
    contact_name: blank(v.contact_name),
    contact_phone: blank(v.contact_phone),
    contact_email: blank(v.contact_email),
    subject_line: blank(v.subject_line),
    signatory_id: v.signatory_id,
    validity_days: v.validity_days,
    gst_rate: v.gst_rate.trim(),
    totals_label_set: v.totals_label_set,
    note_text: blank(v.note_text),
    note_style: v.note_style,
    terms_preset: v.terms_preset,
    terms: v.terms.map((t) => t.text.trim()).filter(Boolean),
    show_sl_no: v.show_sl_no === "Auto" ? null : v.show_sl_no === "Show",
    items,
  };
}

/* ----------------------- display-only money helpers ---------------------- */

/** Half-up rounding to paise, as the server does (display only). */
function toPaise(v: string | number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100 + Number.EPSILON);
}

export function computeDisplayTotals(items: { unit_price: string; quantity: string }[], gstRate: string) {
  const lines = items.map((i) => {
    const price = toPaise(i.unit_price);
    const qty = Number(i.quantity);
    if (!Number.isFinite(qty)) return 0;
    return Math.round(price * qty + Number.EPSILON);
  });
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const rate = Number(gstRate);
  const gst = Number.isFinite(rate) ? Math.round((subtotal * rate) / 100 + Number.EPSILON) : 0;
  return { lines, subtotal, gst, grandTotal: subtotal + gst };
}

/** Indian digit grouping from paise: 11094000 → "1,10,940.00". */
export function fmtInrPaise(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, "0");
  let grouped = whole;
  if (whole.length > 3) {
    const last3 = whole.slice(-3);
    let head = whole.slice(0, -3);
    const parts: string[] = [];
    while (head.length > 2) {
      parts.unshift(head.slice(-2));
      head = head.slice(0, -2);
    }
    parts.unshift(head);
    grouped = `${parts.join(",")},${last3}`;
  }
  return `${sign}${grouped}.${frac}`;
}

/** "38000.00" (API decimal string) → "38,000.00". */
export function fmtInr(decimal: string | number): string {
  return fmtInrPaise(toPaise(decimal));
}

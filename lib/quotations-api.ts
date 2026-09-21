/**
 * Typed fetchers for /api/v1/admin/quotations. Every call takes the authed
 * fetcher from useAuth() so the staff JWT rides along.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ROOT = `${BASE}/api/v1/admin/quotations`;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/* --------------------------------- types --------------------------------- */

export type RowStyle = "DETAILED" | "COMPACT";
export type TotalsLabelSet = "BASIC" | "SIMPLE";
export type NoteStyle = "GREEN_ON_BLACK" | "RED_TEXT";
export type TermsPreset = "POS" | "CCTV";

export type QuotationItemDraft = {
  row_style: RowStyle;
  product_id: number | null;
  brand: string | null;
  brand_sub_label: string | null;
  model: string | null;
  headline: string;
  spec_lines: string | null;
  warranty_label: string | null;
  unit_price: string;
  quantity: string;
  include_image: boolean;
  image_asset: string | null;
  image_storage_key: string | null;
};

export type QuotationDraft = {
  quotation_date: string;
  reference: string | null;
  customer_name: string;
  address_lines: string[];
  customer_gstin: string | null;
  customer_pan: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  subject_line: string | null;
  signatory_id: number;
  validity_days: number;
  gst_rate: string;
  totals_label_set: TotalsLabelSet;
  note_text: string | null;
  note_style: NoteStyle;
  terms_preset: TermsPreset;
  terms: string[];
  show_sl_no: boolean | null;
  items: QuotationItemDraft[];
  /** Set by POST /{id}/duplicate; recorded on the issued row. */
  duplicated_from_id?: number | null;
};

export type Signatory = {
  id: number;
  name: string;
  designation: string;
  phones: string;
  email: string;
  initials: string;
};

export type NextReference = { reference: string; fy: string; next_number: number; date: string };

export type Presets = {
  terms: Record<TermsPreset, string[]>;
  red_term_index: number;
  notes: Record<TermsPreset, { style: NoteStyle; text: string }>;
  totals_labels: Record<TotalsLabelSet, { subtotal: string; gst: string; grand_total: string }>;
  default_validity_days: number;
  default_gst_rate: string;
};

export type CatalogueProduct = {
  id: number;
  brand: string | null;
  brand_sub_label: string | null;
  model: string | null;
  name: string;
  headline: string;
  spec_lines: string | null;
  warranty_label: string | null;
  default_unit_price: string | null;
  default_row_style: RowStyle;
  image_asset: string | null;
  image_storage_key: string | null;
  /** Absolute (S3) or API-relative (/uploads, /static) — use absoluteUrl(). */
  image_url: string | null;
  active: boolean;
  sort_order: number;
};

export type CatalogueProductInput = {
  name: string;
  brand?: string | null;
  brand_sub_label?: string | null;
  model?: string | null;
  headline: string;
  spec_lines?: string | null;
  warranty_label?: string | null;
  default_unit_price?: string | null;
  default_row_style?: RowStyle;
  sort_order?: number | null;
  active?: boolean;
  remove_image?: boolean;
};

/** API-relative URLs (local uploads, bundled assets) need the API origin. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${BASE}${url}` : url;
}

export type QuotationItemOut = {
  id: number;
  position: number;
  row_style: RowStyle;
  brand: string | null;
  brand_sub_label: string | null;
  model: string | null;
  headline: string;
  spec_lines: string | null;
  warranty_label: string | null;
  unit_price: string;
  quantity: string;
  line_total: string;
  include_image: boolean;
  image_asset: string | null;
};

export type QuotationSummary = {
  id: number;
  reference: string;
  status: string;
  quotation_date: string;
  customer_name: string;
  subject_line: string | null;
  grand_total: string;
  created_by: { id: number; name: string | null; username: string | null } | null;
  created_at: string | null;
  // Set once the quotation has been corrected in place.
  updated_by?: { id: number; name: string | null; username: string | null } | null;
  updated_at?: string | null;
};

export type QuotationOut = QuotationSummary & {
  address_lines: string[];
  customer_gstin: string | null;
  customer_pan: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  validity_days: number;
  gst_rate: string;
  totals_label_set: TotalsLabelSet;
  note_text: string | null;
  note_style: NoteStyle;
  terms: string[];
  signatory_name: string;
  signatory_designation: string | null;
  signatory_phones: string | null;
  subtotal: string;
  gst_amount: string;
  pdf_url: string | null;
  issued_at: string | null;
  duplicated_from_id: number | null;
  items: QuotationItemOut[];
};

export type QuotationList = { items: QuotationSummary[]; total: number; limit: number; offset: number };

/* -------------------------------- helpers -------------------------------- */

/** Turn a FastAPI error body into one readable line. */
export async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: (string | number)[]; msg?: string }) => {
          const loc = (d.loc ?? []).filter((x) => x !== "body").join(".");
          return loc ? `${loc}: ${d.msg}` : d.msg ?? "Invalid input";
        })
        .join("; ");
    }
  } catch {
    /* not JSON */
  }
  return `Request failed (${res.status})`;
}

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

/* -------------------------------- fetchers ------------------------------- */

export function fetchSignatories(fetcher: Fetcher) {
  return getJson<Signatory[]>(fetcher, `${ROOT}/signatories`);
}

export function fetchPresets(fetcher: Fetcher) {
  return getJson<Presets>(fetcher, `${ROOT}/presets`);
}

export function fetchCatalogue(fetcher: Fetcher, q = "", active: "true" | "false" | "all" = "true") {
  const qs = new URLSearchParams({ active });
  if (q) qs.set("q", q);
  return getJson<CatalogueProduct[]>(fetcher, `${ROOT}/products?${qs}`);
}

function productForm(payload: CatalogueProductInput, image?: File | null): FormData {
  const fd = new FormData();
  fd.append("payload", JSON.stringify(payload));
  if (image) fd.append("image", image, image.name);
  return fd;
}

export async function createProduct(fetcher: Fetcher, payload: CatalogueProductInput, image?: File | null) {
  const res = await fetcher(`${ROOT}/products`, { method: "POST", body: productForm(payload, image) });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as CatalogueProduct;
}

export async function updateProduct(fetcher: Fetcher, id: number, payload: CatalogueProductInput | Partial<CatalogueProductInput>, image?: File | null) {
  const res = await fetcher(`${ROOT}/products/${id}`, { method: "PATCH", body: productForm(payload as CatalogueProductInput, image) });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as CatalogueProduct;
}

export async function deleteProduct(fetcher: Fetcher, id: number) {
  const res = await fetcher(`${ROOT}/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorMessage(res));
}

export async function reorderProducts(fetcher: Fetcher, ids: number[]) {
  const res = await fetcher(`${ROOT}/products/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as CatalogueProduct[];
}

/** One-off picture for a custom quotation row. */
export async function uploadItemImage(fetcher: Fetcher, image: File): Promise<{ storage_key: string; url: string }> {
  const fd = new FormData();
  fd.append("image", image, image.name);
  const res = await fetcher(`${ROOT}/item-images`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as { storage_key: string; url: string };
}

export function fetchNextReference(fetcher: Fetcher, date: string, signatoryId: number) {
  const qs = new URLSearchParams({ date, signatory_id: String(signatoryId) });
  return getJson<NextReference>(fetcher, `${ROOT}/next-reference?${qs}`);
}

export type PreviewResult =
  | { ok: true; blob: Blob; subtotal: string; gst: string; grandTotal: string }
  | { ok: false; status: number; message: string };

export async function previewQuotation(
  fetcher: Fetcher,
  draft: QuotationDraft,
  format: "pdf" | "png" = "pdf",
): Promise<PreviewResult> {
  try {
    const res = await fetcher(`${ROOT}/preview?format=${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) return { ok: false, status: res.status, message: await errorMessage(res) };
    return {
      ok: true,
      blob: await res.blob(),
      subtotal: res.headers.get("X-Subtotal") ?? "",
      gst: res.headers.get("X-Gst") ?? "",
      grandTotal: res.headers.get("X-Grand-Total") ?? "",
    };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "Network error" };
  }
}

export type CreateResult =
  | { kind: "created"; quotation: QuotationOut }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export async function createQuotation(fetcher: Fetcher, draft: QuotationDraft): Promise<CreateResult> {
  try {
    const res = await fetcher(ROOT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.status === 201) return { kind: "created", quotation: (await res.json()) as QuotationOut };
    if (res.status === 409) return { kind: "conflict", message: await errorMessage(res) };
    return { kind: "error", message: await errorMessage(res) };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Network error" };
  }
}

export async function updateQuotation(
  fetcher: Fetcher,
  id: number | string,
  draft: QuotationDraft
): Promise<CreateResult> {
  try {
    const res = await fetcher(`${ROOT}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) return { kind: "created", quotation: (await res.json()) as QuotationOut };
    if (res.status === 409) return { kind: "conflict", message: await errorMessage(res) };
    return { kind: "error", message: await errorMessage(res) };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Network error" };
  }
}

/** The quotation as an editable draft — reference and date kept, unlike duplicate. */
export async function fetchQuotationDraft(
  fetcher: Fetcher,
  id: number | string
): Promise<QuotationDraft> {
  const res = await fetcher(`${ROOT}/${id}/draft`);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as QuotationDraft;
}

export function fetchQuotation(fetcher: Fetcher, id: number | string) {
  return getJson<QuotationOut>(fetcher, `${ROOT}/${id}`);
}

export function fetchQuotations(
  fetcher: Fetcher,
  params: { q?: string; from?: string; to?: string; limit?: number; offset?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  return getJson<QuotationList>(fetcher, `${ROOT}?${qs}`);
}

/* ------------------------------ downloads -------------------------------- */

export type FileFormat = "pdf" | "docx" | "png" | "jpeg";
export const FILE_FORMATS: FileFormat[] = ["pdf", "docx", "png", "jpeg"];
export const FILE_FORMAT_LABELS: Record<FileFormat, string> = {
  pdf: "PDF",
  docx: "Word (editable copy)",
  png: "PNG",
  jpeg: "JPEG",
};
const FILE_EXT: Record<FileFormat, string> = { pdf: "pdf", docx: "docx", png: "png", jpeg: "jpg" };

/** Fetch a stored quotation in the given format through the API (JWT) and
 *  hand it to the browser as a download. Returns an error message or null. */
export async function downloadQuotationFile(
  fetcher: Fetcher,
  id: number,
  reference: string,
  format: FileFormat = "pdf",
): Promise<string | null> {
  const res = await fetcher(`${ROOT}/${id}/file?format=${format}`);
  if (!res.ok) return await errorMessage(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reference.replace(/\//g, "-")}.${FILE_EXT[format]}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return null;
}

/** Back-compat alias. */
export const downloadQuotationPdf = (fetcher: Fetcher, id: number, reference: string) =>
  downloadQuotationFile(fetcher, id, reference, "pdf");

/** A draft copy of an issued quotation (reference cleared, date = today). */
export async function duplicateQuotation(fetcher: Fetcher, id: number | string): Promise<QuotationDraft> {
  const res = await fetcher(`${ROOT}/${id}/duplicate`, { method: "POST" });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as QuotationDraft;
}

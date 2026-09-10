"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Highlighter, Image as ImageIcon, Plus, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { fetchBusinessNameSuggestions } from "@/lib/api";
import {
  computeDisplayTotals,
  emptyItem,
  fmtInrPaise,
  fromDraft,
  NOTE_STYLE_LABELS,
  NOTE_STYLES,
  quotationSchema,
  ROW_STYLE_LABELS,
  SL_NO_OPTIONS,
  TERMS_PRESETS,
  toDraft,
  type QuotationFormValues,
  type QuotationItemFormValues,
} from "@/lib/quotation-schema";
import {
  absoluteUrl,
  createQuotation,
  duplicateQuotation,
  fetchCatalogue,
  fetchQuotation,
  uploadItemImage,
  fetchNextReference,
  fetchPresets,
  fetchSignatories,
  previewQuotation,
  type CatalogueProduct,
  type Presets,
  type Signatory,
} from "@/lib/quotations-api";

import { Button } from "@/components/ui/Button";
import { FieldError, FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { SuggestionList, useAutocomplete } from "@/components/ui/autocomplete";

type Step = "editing" | "generating" | "previewing" | "submitting";

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Wrap the current selection of a textarea/input in [[ ]] (prints red). */
function wrapSelection(el: HTMLTextAreaElement | HTMLInputElement | null, value: string): string {
  if (!el) return value;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) return value;
  return `${value.slice(0, start)}[[${value.slice(start, end)}]]${value.slice(end)}`;
}

function fillTerms(preset: Presets | null, key: "POS" | "CCTV", days: number) {
  const lines = preset?.terms[key] ?? [];
  return lines.map((l) => ({ text: l.replace("{days}", String(days)) }));
}

export function QuotationForm({ fromId }: { fromId?: string | null } = {}) {
  const router = useRouter();
  const { authFetch } = useAuth();

  const [step, setStep] = useState<Step>("editing");
  const [serverError, setServerError] = useState<string | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueProduct[]>([]);
  const [autoRef, setAutoRef] = useState<string | null>(null);
  const [editRef, setEditRef] = useState(false);
  const [preview, setPreview] = useState<{ url: string; kind: "pdf" | "png"; subtotal: string; gst: string; grandTotal: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    mode: "onBlur",
    defaultValues: {
      quotation_date: todayIso(),
      reference: "",
      customer_name: "",
      address_lines: "",
      customer_gstin: "",
      customer_pan: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      subject_line: "",
      signatory_id: 1,
      validity_days: 15,
      gst_rate: "18",
      totals_label_set: "BASIC",
      note_text: "",
      note_style: "GREEN_ON_BLACK",
      terms_preset: "POS",
      terms: [],
      show_sl_no: "Auto",
      items: [],
      duplicated_from_id: null,
    },
  });
  const { register, control, handleSubmit, setValue, getValues, watch, setError, reset, formState } = form;
  const { errors, isDirty } = formState;

  const items = useFieldArray({ control, name: "items" });
  const terms = useFieldArray({ control, name: "terms" });

  /* ---------------------------- reference data --------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sigs, pre, cat] = await Promise.all([
          fetchSignatories(authFetch),
          fetchPresets(authFetch),
          fetchCatalogue(authFetch),
        ]);
        if (cancelled) return;
        setSignatories(sigs);
        setPresets(pre);
        setCatalogue(cat);
        if (sigs[0]) setValue("signatory_id", sigs[0].id);
        // Prefill the POS preset (terms + note) so a typical quotation needs no typing here.
        if (getValues("terms").length === 0) {
          setValue("terms", fillTerms(pre, "POS", getValues("validity_days")));
        }
        if (!getValues("note_text")) {
          setValue("note_text", pre.notes.POS.text);
          setValue("note_style", pre.notes.POS.style);
        }
        if (fromId) {
          // Duplicate flow: replace everything with the server's draft copy.
          const [draft, source] = await Promise.all([
            duplicateQuotation(authFetch, fromId),
            fetchQuotation(authFetch, fromId).catch(() => null),
          ]);
          if (cancelled) return;
          reset(fromDraft(draft), { keepDefaultValues: true });
          setCopiedFrom(source?.reference ?? `#${fromId}`);
        }
      } catch (e) {
        if (!cancelled) setServerError(e instanceof Error ? e.message : "Could not load form data");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, setValue, getValues, reset, fromId]);

  const quotationDate = watch("quotation_date");
  const signatoryId = watch("signatory_id");
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quotationDate ?? "")) return;
    let cancelled = false;
    fetchNextReference(authFetch, quotationDate, Number(signatoryId) || 1)
      .then((r) => !cancelled && setAutoRef(r.reference))
      .catch(() => !cancelled && setAutoRef(null));
    return () => {
      cancelled = true;
    };
  }, [authFetch, quotationDate, signatoryId]);

  /* -------------------------- unsaved-changes guard ---------------------- */
  useEffect(() => {
    if (!isDirty || submitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, submitted]);

  /* ------------------------------ autocomplete --------------------------- */
  const customerField = register("customer_name");
  const customerAc = useAutocomplete(
    watch("customer_name") ?? "",
    (q) => fetchBusinessNameSuggestions(q, authFetch),
    (s) => setValue("customer_name", s.business_name, { shouldDirty: true, shouldValidate: true }),
  );

  /* ---------------------------- catalogue add ---------------------------- */
  const addFromCatalogue = (p: CatalogueProduct) => {
    items.append({
      row_style: p.default_row_style === "COMPACT" ? "Compact" : "Detailed",
      brand: p.brand ?? "",
      brand_sub_label: p.brand_sub_label ?? "",
      model: p.model ?? "",
      headline: p.headline,
      spec_lines: p.spec_lines ?? "",
      warranty_label: p.warranty_label ?? "",
      unit_price: p.default_unit_price ?? "",
      quantity: "1",
      include_image: !!(p.image_asset || p.image_storage_key),
      image_asset: p.image_asset ?? "",
      image_storage_key: p.image_storage_key ?? "",
      product_id: p.id,
      image_url: p.image_url,
    });
  };

  /* ------------------------------- totals -------------------------------- */
  const watchedItems = watch("items");
  const gstRate = watch("gst_rate");
  const totalsLabelSet = watch("totals_label_set");
  // Not memoised on purpose: react-hook-form hands back the same array
  // reference for a field array on every render, so a useMemo keyed on it
  // would never recompute. The arithmetic is trivial.
  const display = computeDisplayTotals(watchedItems ?? [], gstRate ?? "0");
  const labels = presets?.totals_labels[totalsLabelSet] ?? {
    subtotal: "TOTAL BASIC PRICE",
    gst: "GST @ {rate}%",
    grand_total: "TOTAL AMOUNT",
  };

  /* --------------------------- generate / submit ------------------------- */
  const revokePreview = useCallback(() => {
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p.url);
      return null;
    });
  }, []);

  const generate = async (values: QuotationFormValues) => {
    setServerError(null);
    setStep("generating");
    const draft = toDraft(values);
    if (!editRef) draft.reference = autoRef; // show the number that WILL be assigned
    const kind: "pdf" | "png" = window.matchMedia("(max-width: 767px)").matches ? "png" : "pdf";
    const res = await previewQuotation(authFetch, draft, kind);
    if (!res.ok) {
      setServerError(res.message);
      setStep("editing");
      return;
    }
    revokePreview();
    setPreview({ url: URL.createObjectURL(res.blob), kind, subtotal: res.subtotal, gst: res.gst, grandTotal: res.grandTotal });
    setStep("previewing");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setServerError(null);
    setStep("submitting");
    const draft = toDraft(getValues());
    if (!editRef) draft.reference = null; // let the server allocate atomically
    const res = await createQuotation(authFetch, draft);
    if (res.kind === "created") {
      setSubmitted(true);
      router.push(`/admin/quotations/${res.quotation.id}?saved=1`);
      return;
    }
    if (res.kind === "conflict") {
      setEditRef(true);
      setError("reference", { message: res.message });
      setServerError(res.message);
      revokePreview();
      setStep("editing");
      return;
    }
    setServerError(res.message);
    setStep("editing");
  };

  /* -------------------------------- render ------------------------------- */
  if (step === "previewing" || step === "submitting") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Preview</p>
            <p className="mt-1 text-[14px] text-ink-muted">
              This is the exact document that will be issued. Reference{" "}
              <span className="font-medium text-ink">{editRef ? getValues("reference") || "—" : autoRef ?? "(assigned on submit)"}</span>
              {" · "}Total <span className="font-medium text-ink">₹ {fmtInrPaise(Math.round(Number(preview?.grandTotal ?? 0) * 100))}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => { setStep("editing"); }} disabled={step === "submitting"}>
              Back to edit
            </Button>
            <Button type="button" onClick={submit} loading={step === "submitting"}>
              {step === "submitting" ? "Submitting…" : "Submit quotation"}
            </Button>
          </div>
        </div>
        {serverError && (
          <div className="rounded-xl2 border border-accent-danger/30 bg-white p-4 text-[14px] text-accent-danger">{serverError}</div>
        )}
        {preview?.kind === "pdf" ? (
          <iframe
            title="Quotation preview"
            src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`}
            className="w-full rounded-xl2 border border-line bg-surface-sunken"
            style={{ aspectRatio: "1 / 1.35", minHeight: 640 }}
          />
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Quotation preview" className="w-full rounded-xl2 border border-line" />
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(generate)} className="space-y-12" noValidate>
      {copiedFrom && (
        <div className="rounded-xl2 border border-line bg-surface-raised p-4 text-[14px] text-ink-muted">
          Pre-filled from quotation <span className="font-medium text-ink">{copiedFrom}</span>. The date is today and a new
          reference will be assigned on submit.
        </div>
      )}
      {/* ------------------------------ Bill To --------------------------- */}
      <Section index="01" title="Bill to" caption="Who the quotation is addressed to. Past customers autocomplete.">
        <Grid>
          <FieldGroup className="md:col-span-2">
            <Label htmlFor="customer_name" required>Business / customer name</Label>
            <div className="relative">
              <Input
                id="customer_name"
                placeholder="e.g. NAVAPAKAM KITCHENS LLP"
                autoComplete="off"
                {...customerField}
                onBlur={(e) => { customerField.onBlur(e); customerAc.setOpen(false); }}
                onFocus={() => customerAc.setOpen(true)}
                onKeyDown={customerAc.onKeyDown}
              />
              <SuggestionList suggestions={customerAc.suggestions} visible={customerAc.visible} activeIndex={customerAc.activeIndex} onPick={customerAc.pick} />
            </div>
            <FieldError message={errors.customer_name?.message} />
          </FieldGroup>

          <FieldGroup className="md:col-span-2">
            <Label htmlFor="address_lines" hint="One line per row, up to 6">Address</Label>
            <Textarea id="address_lines" rows={3} className="min-h-[96px]" placeholder={"No.5, 3rd Main, Rama Mandira Road\nKamakshipalya, Magadi Road\nKaveripura, Bengaluru - 560079"} {...register("address_lines")} />
            <FieldError message={errors.address_lines?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="customer_gstin" hint="Printed under the address">Customer GSTIN</Label>
            <Input id="customer_gstin" placeholder="29AAUFN8185B1ZN" autoCapitalize="characters" {...register("customer_gstin")} />
            <FieldError message={errors.customer_gstin?.message} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="customer_pan" hint="Printed when there is no GSTIN">Customer PAN</Label>
            <Input id="customer_pan" placeholder="ABHFP7560N" autoCapitalize="characters" {...register("customer_pan")} />
            <FieldError message={errors.customer_pan?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="contact_name" hint="Not printed">Contact person</Label>
            <Input id="contact_name" {...register("contact_name")} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="contact_phone" hint="Not printed">Contact phone</Label>
            <Input id="contact_phone" inputMode="tel" {...register("contact_phone")} />
          </FieldGroup>
          <FieldGroup className="md:col-span-2">
            <Label htmlFor="contact_email" hint="Not printed">Contact email</Label>
            <Input id="contact_email" type="email" {...register("contact_email")} />
            <FieldError message={errors.contact_email?.message} />
          </FieldGroup>
        </Grid>
      </Section>

      {/* ----------------------------- Quotation -------------------------- */}
      <Section index="02" title="Quotation" caption="Reference, date and who prepares it. The reference is assigned automatically when you submit.">
        <Grid>
          <FieldGroup>
            <Label htmlFor="quotation_date" required>Date</Label>
            <Input id="quotation_date" type="date" {...register("quotation_date")} />
            <FieldError message={errors.quotation_date?.message} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="reference" hint={editRef ? "Typed by you" : "Auto"}>Reference No</Label>
            {editRef ? (
              <Input id="reference" placeholder="e.g. 1409SW049/2026-27" {...register("reference")} />
            ) : (
              <div className="flex items-center justify-between rounded-xl2 border border-dashed border-line bg-surface-raised px-4 py-3.5 text-[15px]">
                <span className="text-ink">{autoRef ?? "…"}</span>
                <button type="button" className="text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setEditRef(true)}>
                  Edit
                </button>
              </div>
            )}
            {editRef && (
              <button type="button" className="mt-1.5 text-[12.5px] text-ink-muted hover:text-ink" onClick={() => { setEditRef(false); setValue("reference", ""); }}>
                Use the automatic number instead
              </button>
            )}
            <FieldError message={errors.reference?.message} />
          </FieldGroup>

          <FieldGroup className="md:col-span-2">
            <Label htmlFor="subject_line" hint="Optional, printed mid-header">Subject line</Label>
            <Input id="subject_line" placeholder="For Sarjapur Road outlet" {...register("subject_line")} />
            <FieldError message={errors.subject_line?.message} />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="signatory_id" required>Prepared by</Label>
            <Select
              id="signatory_id"
              options={signatories.map((s) => s.name)}
              placeholder="Select signatory"
              value={signatories.find((s) => s.id === Number(signatoryId))?.name ?? ""}
              onChange={(e) => {
                const s = signatories.find((x) => x.name === e.target.value);
                if (s) setValue("signatory_id", s.id, { shouldDirty: true });
              }}
            />
            <FieldError message={errors.signatory_id?.message} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="validity_days" required hint="Fills T&C line 1">Validity (days)</Label>
            <Input
              id="validity_days"
              type="number"
              min={1}
              max={365}
              {...register("validity_days", {
                onChange: (e) => {
                  const days = Number(e.target.value);
                  const cur = getValues("terms");
                  if (cur[0] && /^Quotation validity for \d+ Days$/.test(cur[0].text) && days > 0) {
                    setValue("terms.0.text", `Quotation validity for ${days} Days`);
                  }
                },
              })}
            />
            <FieldError message={errors.validity_days?.message} />
          </FieldGroup>
        </Grid>
      </Section>

      {/* ------------------------------- Items ---------------------------- */}
      <Section index="03" title="Items" caption="Add products from the catalogue or type a custom line. Text inside [[ ]] prints red.">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Select
                aria-label="Add from catalogue"
                options={catalogue.map((p) => p.name)}
                placeholder="Add from catalogue…"
                value=""
                onChange={(e) => {
                  const p = catalogue.find((x) => x.name === e.target.value);
                  if (p) addFromCatalogue(p);
                }}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => items.append(emptyItem("Compact"))}>
              <Plus size={16} /> Add custom item
            </Button>
          </div>
          {errors.items?.root?.message || (typeof errors.items?.message === "string" && errors.items.message) ? (
            <FieldError message={errors.items?.root?.message ?? (errors.items?.message as string)} />
          ) : null}

          {items.fields.map((field, idx) => (
            <ItemCard
              key={field.id}
              index={idx}
              count={items.fields.length}
              form={form}
              lineTotalPaise={display.lines[idx] ?? 0}
              onMoveUp={() => items.move(idx, idx - 1)}
              onMoveDown={() => items.move(idx, idx + 1)}
              onRemove={() => items.remove(idx)}
            />
          ))}
          {items.fields.length === 0 && (
            <p className="rounded-xl2 border border-dashed border-line p-6 text-center text-[14px] text-ink-muted">
              No items yet — pick a product above or add a custom line.
            </p>
          )}
        </div>
      </Section>

      {/* --------------------------- Totals & note ------------------------ */}
      <Section index="04" title="Totals & note" caption="GST and the note under the table. Totals here are indicative; the server computes the printed ones.">
        <Grid>
          <FieldGroup>
            <Label htmlFor="gst_rate" required>GST rate %</Label>
            <Input id="gst_rate" inputMode="decimal" {...register("gst_rate")} />
            <FieldError message={errors.gst_rate?.message} />
          </FieldGroup>
          <FieldGroup>
            <Label>Totals labels</Label>
            <div className="flex gap-3">
              {(["BASIC", "SIMPLE"] as const).map((v) => (
                <label key={v} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl2 border px-4 py-3 text-[14px] ${totalsLabelSet === v ? "border-ink bg-surface-raised" : "border-line"}`}>
                  <input type="radio" value={v} {...register("totals_label_set")} className="accent-black" />
                  {v === "BASIC" ? "POS (Total basic price)" : "CCTV (Total / Grand total)"}
                </label>
              ))}
            </div>
          </FieldGroup>
          <FieldGroup className="md:col-span-2">
            <Label htmlFor="note_text">Note</Label>
            <Input id="note_text" placeholder="Note : 24/7 x 365 Onsite Service Support" {...register("note_text")} />
            <FieldError message={errors.note_text?.message} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="note_style">Note style</Label>
            <Select
              id="note_style"
              options={NOTE_STYLES.map((s) => NOTE_STYLE_LABELS[s])}
              value={NOTE_STYLE_LABELS[watch("note_style")]}
              onChange={(e) => {
                const key = NOTE_STYLES.find((s) => NOTE_STYLE_LABELS[s] === e.target.value);
                if (key) setValue("note_style", key, { shouldDirty: true });
              }}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="show_sl_no" hint="Auto = only when every row is compact">Sl No. column</Label>
            <Select id="show_sl_no" options={SL_NO_OPTIONS} {...register("show_sl_no")} />
          </FieldGroup>

          <div className="md:col-span-2 rounded-xl2 border border-line bg-surface-raised p-5">
            <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[14px]">
              <dt className="text-ink-muted">{labels.subtotal}</dt>
              <dd className="text-right tabular-nums text-ink">₹ {fmtInrPaise(display.subtotal)}</dd>
              <dt className="text-ink-muted">{labels.gst.replace("{rate}", gstRate || "0")}</dt>
              <dd className="text-right tabular-nums text-ink">₹ {fmtInrPaise(display.gst)}</dd>
              <dt className="font-medium text-ink">{labels.grand_total}</dt>
              <dd className="text-right font-medium tabular-nums text-ink">₹ {fmtInrPaise(display.grandTotal)}</dd>
            </dl>
          </div>
        </Grid>
      </Section>

      {/* ---------------------------- Terms ------------------------------- */}
      <Section index="05" title="Terms & conditions" caption="Start from a preset and edit any line. Line 2 (taxes) prints red.">
        <div className="space-y-4">
          <FieldGroup>
            <Label htmlFor="terms_preset">Preset</Label>
            <Select
              id="terms_preset"
              options={TERMS_PRESETS}
              {...register("terms_preset", {
                onChange: (e) => {
                  const key = e.target.value as "POS" | "CCTV";
                  setValue("terms", fillTerms(presets, key, Number(getValues("validity_days")) || 15), { shouldDirty: true });
                  if (presets) {
                    setValue("note_text", presets.notes[key].text, { shouldDirty: true });
                    setValue("note_style", presets.notes[key].style, { shouldDirty: true });
                    setValue("totals_label_set", key === "POS" ? "BASIC" : "SIMPLE", { shouldDirty: true });
                  }
                },
              })}
            />
          </FieldGroup>
          <ol className="space-y-2">
            {terms.fields.map((f, i) => (
              <li key={f.id} className="flex items-start gap-2">
                <span className="mt-3.5 w-6 shrink-0 text-right text-[13px] text-ink-subtle">{i + 1}</span>
                <div className="flex-1">
                  <Textarea rows={1} className={`min-h-[48px] py-3 ${i === (presets?.red_term_index ?? 1) ? "text-accent-danger" : ""}`} {...register(`terms.${i}.text` as const)} />
                  <FieldError message={errors.terms?.[i]?.text?.message} />
                </div>
                <button type="button" aria-label="Remove term" className="mt-3 text-ink-subtle hover:text-accent-danger" onClick={() => terms.remove(i)}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ol>
          {terms.fields.length < 12 && (
            <Button type="button" variant="ghost" onClick={() => terms.append({ text: "" })}>
              <Plus size={16} /> Add a line
            </Button>
          )}
          <FieldError message={errors.terms?.root?.message ?? (errors.terms?.message as string | undefined)} />
        </div>
      </Section>

      {/* ------------------------------ Actions --------------------------- */}
      {serverError && (
        <div className="rounded-xl2 border border-accent-danger/30 bg-white p-5 text-[14px] text-accent-danger">{serverError}</div>
      )}
      <div className="flex flex-col gap-4 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
        <p className="text-[13px] text-ink-subtle">Generate to see the exact PDF before anything is saved.</p>
        <Button type="submit" size="lg" loading={step === "generating"}>
          {step === "generating" ? "Rendering…" : "Generate quotation"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------- item card ------------------------------- */

function ItemCard({
  index,
  count,
  form,
  lineTotalPaise,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  count: number;
  form: UseFormReturn<QuotationFormValues>;
  lineTotalPaise: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { register, watch, setValue, getValues, formState: { errors } } = form;
  const err = errors.items?.[index];
  const rowStyle = watch(`items.${index}.row_style`);
  const { authFetch } = useAuth();
  const imageAsset = watch(`items.${index}.image_asset`);
  const imageKey = watch(`items.${index}.image_storage_key`);
  const imageUrl = watch(`items.${index}.image_url`);
  const includeImage = watch(`items.${index}.include_image`);
  const hasImage = !!(imageAsset || imageKey);
  const thumb = absoluteUrl(imageUrl) ?? (imageAsset ? absoluteUrl(`/static/quotation-products/${imageAsset}`) : null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadItemImage(authFetch, file);
      setValue(`items.${index}.image_storage_key`, res.storage_key, { shouldDirty: true });
      setValue(`items.${index}.image_asset`, "", { shouldDirty: true });
      setValue(`items.${index}.image_url`, res.url, { shouldDirty: true });
      setValue(`items.${index}.include_image`, true, { shouldDirty: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const headlineRef = useRef<HTMLTextAreaElement | null>(null);
  const specRef = useRef<HTMLTextAreaElement | null>(null);
  const headlineReg = register(`items.${index}.headline` as const);
  const specReg = register(`items.${index}.spec_lines` as const);

  const highlight = (field: "headline" | "spec_lines", el: HTMLTextAreaElement | null) => {
    const name = `items.${index}.${field}` as const;
    const next = wrapSelection(el, getValues(name) ?? "");
    setValue(name, next, { shouldDirty: true });
  };

  const f = (name: keyof QuotationItemFormValues) => `items.${index}.${name}` as const;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl2 border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] uppercase tracking-[0.16em] text-ink-subtle">Item {index + 1}</div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Move up" disabled={index === 0} onClick={onMoveUp} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-ink disabled:opacity-30"><ArrowUp size={16} /></button>
          <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={onMoveDown} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-ink disabled:opacity-30"><ArrowDown size={16} /></button>
          <button type="button" aria-label="Remove item" onClick={onRemove} className="rounded-lg p-2 text-ink-subtle hover:bg-surface-sunken hover:text-accent-danger"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <FieldGroup className="md:col-span-2">
          <Label>Row style</Label>
          <Select options={ROW_STYLE_LABELS} {...register(f("row_style"))} />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label>Brand</Label>
          <Input placeholder="SK-POS®" {...register(f("brand"))} />
          <FieldError message={err?.brand?.message} />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label hint="Small line under the brand">Brand sub-label</Label>
          <Input placeholder="by SK-POS®" {...register(f("brand_sub_label"))} />
        </FieldGroup>

        <FieldGroup className="md:col-span-2">
          <Label hint="A second line prints larger">Model</Label>
          <Textarea rows={2} className="min-h-[56px] py-3" placeholder={"Mighty Series\nM95"} {...register(f("model"))} />
          <FieldError message={err?.model?.message} />
        </FieldGroup>
        <FieldGroup className="md:col-span-4">
          <div className="mb-2 flex items-baseline justify-between">
            <Label required>Product name &amp; description</Label>
            <HighlightButton onClick={() => highlight("headline", headlineRef.current)} />
          </div>
          <Textarea
            rows={2}
            className="min-h-[56px] py-3"
            placeholder="Touch POS System with [[N95 Processor]] …"
            {...headlineReg}
            ref={(el) => { headlineReg.ref(el); headlineRef.current = el; }}
          />
          <FieldError message={err?.headline?.message} />
        </FieldGroup>

        {rowStyle === "Detailed" && (
          <>
            <FieldGroup className="md:col-span-4">
              <div className="mb-2 flex items-baseline justify-between">
                <Label hint="One line per row">Specification lines</Label>
                <HighlightButton onClick={() => highlight("spec_lines", specRef.current)} />
              </div>
              <Textarea
                rows={6}
                className="font-mono text-[13px]"
                placeholder={"BUILT IN C P U , [[Intel® N95]]\nINTERFACE PORTS\n…"}
                {...specReg}
                ref={(el) => { specReg.ref(el); specRef.current = el; }}
              />
              <FieldError message={err?.spec_lines?.message} />
            </FieldGroup>
            <div className="md:col-span-2 space-y-4">
              <FieldGroup>
                <Label hint="Boxed label on the left">Warranty label</Label>
                <Input placeholder="3 Years Onsite Warranty" {...register(f("warranty_label"))} />
              </FieldGroup>
              <FieldGroup>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl2 border border-line p-3.5 text-[14px]">
                  <input type="checkbox" className="mt-0.5 accent-black" {...register(f("include_image"))} />
                  <span>
                    <span className="block text-ink">Include product image</span>
                    <span className="block text-[12.5px] text-ink-subtle">
                      {hasImage ? "Photo attached" : "Tick to attach a photo for this row"}
                    </span>
                  </span>
                </label>
                {includeImage && (
                  <div className="mt-2 flex items-center gap-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-14 w-14 rounded-lg border border-line object-contain bg-white" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-line text-ink-subtle">
                        <ImageIcon size={18} />
                      </div>
                    )}
                    <div className="text-[12.5px] text-ink-muted">
                      <label className="cursor-pointer font-medium text-ink underline-offset-2 hover:underline">
                        {uploading ? "Uploading…" : hasImage ? "Replace photo" : "Upload a photo"}
                        <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={onPickFile} />
                      </label>
                      <span className="block">PNG or JPEG, up to 5 MB. Resized to 800 px.</span>
                      {uploadError && <span className="block text-accent-danger">{uploadError}</span>}
                    </div>
                  </div>
                )}
              </FieldGroup>
            </div>
          </>
        )}

        <FieldGroup className="md:col-span-2">
          <Label required>Unit price (₹)</Label>
          <Input inputMode="decimal" placeholder="38000" {...register(f("unit_price"))} />
          <FieldError message={err?.unit_price?.message} />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label required>Quantity</Label>
          <Input inputMode="decimal" {...register(f("quantity"))} />
          <FieldError message={err?.quantity?.message} />
        </FieldGroup>
        <FieldGroup className="md:col-span-2">
          <Label>Line total</Label>
          <div className="rounded-xl2 border border-line bg-surface-raised px-4 py-3.5 text-right text-[15px] tabular-nums text-ink">
            ₹ {fmtInrPaise(lineTotalPaise)}
          </div>
        </FieldGroup>
      </div>
    </motion.div>
  );
}

function HighlightButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      // onMouseDown so the textarea keeps its selection when the button is pressed.
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="inline-flex items-center gap-1 text-[12px] text-accent-danger hover:underline"
      title="Wrap the selected text in [[ ]] — it prints red"
    >
      <Highlighter size={13} /> Highlight red
    </button>
  );
}

/* --------------------------- layout helpers ------------------------------ */

function Section({ index, title, caption, children }: { index: string; title: string; caption: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="grid gap-8 border-t border-line pt-10 md:grid-cols-[260px_1fr]"
    >
      <div>
        <div className="text-[12px] tracking-[0.18em] text-ink-subtle">{index}</div>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">{title}</h2>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-ink-muted">{caption}</p>
      </div>
      <div>{children}</div>
    </motion.section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>;
}

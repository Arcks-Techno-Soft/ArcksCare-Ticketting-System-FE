"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { DownloadMenu } from "@/components/admin/download-menu";
import { useAuth, isManagerLevel } from "@/lib/auth";
import { fmtIstDate } from "@/lib/format-date";
import { fmtInr } from "@/lib/quotation-schema";
import { fetchQuotation, type QuotationOut } from "@/lib/quotations-api";

export default function QuotationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { ready, user, authFetch } = useAuth();
  const [q, setQ] = useState<QuotationOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const justSaved = search.get("saved") === "1";

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isManagerLevel(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user || !params?.id) return;
    fetchQuotation(authFetch, params.id).then(setQ).catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [ready, user, params?.id, authFetch]);

  if (!ready || !user || !isManagerLevel(user.role)) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <Link href="/admin/quotations/list" className="text-[13px] text-ink-muted transition-colors hover:text-ink">
            ← All quotations
          </Link>
          <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Quotation</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">{q?.reference ?? "…"}</h1>
          {q && (
            <p className="mt-1 text-[13.5px] text-ink-muted">
              {q.customer_name}
              {q.subject_line ? ` · ${q.subject_line}` : ""} · {fmtIstDate(q.quotation_date)}
            </p>
          )}
        </div>

        {justSaved && q && (
          <div className="mt-6 rounded-xl2 border border-accent-success/30 bg-white p-4 text-[14px] text-accent-success">
            Quotation {q.reference} saved.
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-xl2 border border-accent-danger/30 bg-white p-4 text-[14px] text-accent-danger">{error}</div>
        )}

        {q && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
            <div>
              {q.pdf_url ? (
                <iframe
                  title={`Quotation ${q.reference}`}
                  src={`${q.pdf_url}#toolbar=0&navpanes=0&view=FitH`}
                  className="w-full rounded-xl2 border border-line bg-surface-sunken"
                  style={{ aspectRatio: "1 / 1.35", minHeight: 640 }}
                />
              ) : (
                <p className="text-[14px] text-ink-muted">No PDF stored.</p>
              )}
            </div>
            <aside className="space-y-4">
              <div className="rounded-xl2 border border-line bg-white p-5 shadow-soft">
                <dl className="space-y-3 text-[14px]">
                  <Row k="Customer" v={q.customer_name} />
                  {q.customer_gstin && <Row k="GSTIN" v={q.customer_gstin} />}
                  {q.customer_pan && <Row k="PAN" v={q.customer_pan} />}
                  <Row k="Date" v={fmtIstDate(q.quotation_date)} />
                  <Row k="Prepared by" v={q.signatory_name} />
                  <Row k="Items" v={String(q.items.length)} />
                  <Row k="Subtotal" v={`₹ ${fmtInr(q.subtotal)}`} />
                  <Row k={`GST @ ${q.gst_rate.replace(/\.0+$/, "")}%`} v={`₹ ${fmtInr(q.gst_amount)}`} />
                  <Row k="Total" v={`₹ ${fmtInr(q.grand_total)}`} strong />
                  {q.created_by?.name && <Row k="Issued by" v={q.created_by.name} />}
                  {q.duplicated_from_id && (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-muted">Copied from</dt>
                      <dd className="text-right">
                        <Link href={`/admin/quotations/${q.duplicated_from_id}`} className="text-ink underline-offset-2 hover:underline">
                          quotation #{q.duplicated_from_id}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="flex flex-col gap-2">
                <DownloadMenu id={q.id} reference={q.reference} onError={setError} />
                <Link
                  href={`/admin/quotations/new?from=${q.id}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl2 border border-line bg-white px-5 text-[14px] font-medium text-ink hover:border-ink hover:bg-surface-raised"
                >
                  <Copy size={16} /> Duplicate as new
                </Link>
                {q.pdf_url && (
                  <a href={q.pdf_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl2 border border-line bg-white px-5 text-[14px] font-medium text-ink hover:border-ink hover:bg-surface-raised">
                    <ExternalLink size={16} /> Open in a new tab
                  </a>
                )}
                <Link href="/admin/quotations/new" className="inline-flex h-10 items-center justify-center rounded-xl2 px-5 text-[14px] font-medium text-ink hover:bg-surface-sunken">
                  Create another
                </Link>
              </div>
            </aside>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{k}</dt>
      <dd className={`text-right ${strong ? "font-medium text-ink" : "text-ink"}`}>{v}</dd>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { DownloadMenu } from "@/components/admin/download-menu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useAuth, canUseQuotations } from "@/lib/auth";
import { fmtIstDate } from "@/lib/format-date";
import { fmtInr } from "@/lib/quotation-schema";
import { fetchQuotations, type QuotationList } from "@/lib/quotations-api";

const PAGE = 25;

export default function QuotationsListPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<QuotationList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!canUseQuotations(user.role)) router.replace("/admin/tickets");
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user) return;
    fetchQuotations(authFetch, { q: applied, limit: PAGE, offset })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"));
  }, [ready, user, authFetch, applied, offset]);

  if (!ready || !user || !canUseQuotations(user.role)) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <Link href="/admin/quotations" className="text-[13px] text-ink-muted transition-colors hover:text-ink">← Quotations</Link>
          <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Quotations</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">Issued quotations</h1>
        </div>

        <form
          className="mt-6 flex gap-3"
          onSubmit={(e) => { e.preventDefault(); setOffset(0); setApplied(q.trim()); }}
        >
          <Input placeholder="Search reference, customer or subject" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline">Search</Button>
        </form>

        {error && <div className="mt-6 rounded-xl2 border border-accent-danger/30 bg-white p-4 text-[14px] text-accent-danger">{error}</div>}

        <div className="mt-6 overflow-x-auto rounded-xl2 border border-line bg-white">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-raised text-left text-[12px] uppercase tracking-[0.12em] text-ink-subtle">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Issued by</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-surface-raised">
                  <td className="px-4 py-3"><Link href={`/admin/quotations/${r.id}`} className="font-medium text-ink underline-offset-2 hover:underline">{r.reference}</Link></td>
                  <td className="px-4 py-3 text-ink-muted">{fmtIstDate(r.quotation_date)}</td>
                  <td className="px-4 py-3 text-ink">{r.customer_name}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.subject_line ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">₹ {fmtInr(r.grand_total)}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.created_by?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <DownloadMenu id={r.id} reference={r.reference} compact onError={setError} />
                      <Link
                        href={`/admin/quotations/new?from=${r.id}`}
                        className="inline-flex h-8 items-center rounded-xl2 px-3 text-[13px] font-medium text-ink hover:bg-surface-sunken"
                      >
                        Duplicate
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">No quotations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > PAGE && (
          <div className="mt-4 flex items-center justify-between text-[13px] text-ink-muted">
            <span>{offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
              <Button type="button" variant="outline" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

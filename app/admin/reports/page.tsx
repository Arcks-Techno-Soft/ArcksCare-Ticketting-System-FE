"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Download } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth, API_BASE_URL } from "@/lib/auth";
import { fmtIst } from "@/lib/format-date";

type Breach = {
  stage: number;
  label: string;
  threshold_min: number;
  elapsed_min: number;
  overage_min: number;
  pending: boolean;
  responsible_name: string | null;
  responsible_role: string | null;
};

type ReportRow = {
  reference: string;
  status: string;
  service_type: string;
  business_name: string;
  contact_name: string;
  phone: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
  product_category: string;
  serial_number: string;
  issue_category: string;
  severity: string;
  warranty_status: string;
  assigned_engineer: string | null;
  created_at: string | null;
  acknowledged_at: string | null;
  assigned_at: string | null;
  accepted_at: string | null;
  resolving_started_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_hours: number | null;
  resolution_summary: string | null;
  escalated: boolean;
  earliest_breach_stage: number | null;
  primary_overage_min: number | null;
  breaches: Breach[];
};

type StageDef = { stage: number; label: string; site: number; remote: number | null };

type ReportData = {
  date_from: string;
  date_to: string;
  total: number;
  escalated_count: number;
  stages: StageDef[];
  rows: ReportRow[];
};

const SERVICE_LABEL: Record<string, string> = {
  SITE_VISIT: "Site visit",
  REMOTE_SUPPORT: "Remote",
};

// YYYY-MM-DD for a date N days before today (local — admin is in IST).
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fmtOverage(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ReportsPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  const [dateFrom, setDateFrom] = useState(() => isoDaysAgo(29));
  const [dateTo, setDateTo] = useState(() => isoDaysAgo(0));
  const [escalation, setEscalation] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (user.role !== "ADMIN" && user.role !== "MANAGER") router.replace("/admin/tickets");
  }, [ready, user, router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/v1/admin/reports/tickets?date_from=${dateFrom}&date_to=${dateTo}`
      );
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        let msg = `Server ${res.status}`;
        try {
          const j = await res.json();
          if (typeof j.detail === "string") msg = j.detail;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      setData((await res.json()) as ReportData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [authFetch, dateFrom, dateTo, router]);

  useEffect(() => {
    if (user?.role === "ADMIN") fetchReport();
  }, [user, fetchReport]);

  const stageLabel = useMemo(() => {
    const m = new Map<number, string>();
    data?.stages.forEach((s) => m.set(s.stage, s.label));
    return m;
  }, [data]);

  // Escalation ON → server order (breached first). OFF → newest-created first.
  const rows = useMemo(() => {
    if (!data) return [];
    if (escalation) return data.rows;
    return [...data.rows].sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
  }, [data, escalation]);

  const toggleRow = (ref: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(ref) ? next.delete(ref) : next.add(ref);
      return next;
    });

  const downloadCsv = () => {
    if (!data) return;
    const base = [
      "reference", "status", "service_type", "business_name", "contact_name",
      "phone", "city", "state", "pincode", "product_category", "serial_number",
      "issue_category", "severity", "warranty_status", "assigned_engineer",
      "created_at", "acknowledged_at", "assigned_at", "accepted_at",
      "resolving_started_at", "resolved_at", "closed_at", "resolution_hours",
      "resolution_summary",
    ];
    const headers = escalation
      ? [...base, "escalated", "earliest_breach_stage", "breaches"]
      : base;

    const ts = (v: string | null) => (v ? fmtIst(v) : "");
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const breachText = (r: ReportRow) =>
      r.breaches
        .map(
          (b) =>
            `S${b.stage} ${b.label} ${Math.round(b.elapsed_min)}/${b.threshold_min}m` +
            `${b.pending ? " (ongoing)" : ""}${b.responsible_name ? ` [${b.responsible_name}]` : ""}`
        )
        .join(" | ");

    const lines = [headers.join(",")];
    for (const r of rows) {
      const cells = [
        r.reference, r.status, SERVICE_LABEL[r.service_type] ?? r.service_type,
        r.business_name, r.contact_name, r.phone, r.city, r.state, r.pincode,
        r.product_category, r.serial_number, r.issue_category, r.severity,
        r.warranty_status, r.assigned_engineer, ts(r.created_at),
        ts(r.acknowledged_at), ts(r.assigned_at), ts(r.accepted_at),
        ts(r.resolving_started_at), ts(r.resolved_at), ts(r.closed_at),
        r.resolution_hours, r.resolution_summary,
      ];
      if (escalation) {
        cells.push(r.escalated ? "yes" : "no", r.earliest_breach_stage ?? "", breachText(r));
      }
      lines.push(cells.map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets_${dateFrom}_${dateTo}${escalation ? "_escalation" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready || !user || user.role !== "ADMIN") return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Reports</p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
              Ticket report
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              Tickets created in the selected range · times shown in IST
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={isoDaysAgo(0)}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!data || data.total === 0}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink hover:border-ink disabled:opacity-40"
            >
              <Download size={14} /> Download CSV
            </button>
          </div>
        </div>

        {/* Escalation toggle + summary */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={escalation}
            onClick={() => setEscalation((v) => !v)}
            className="group flex items-center gap-3"
          >
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                escalation ? "bg-ink" : "bg-line-strong"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  escalation ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
            <span className="text-left">
              <span className="block text-[13.5px] font-medium text-ink">Escalation matrix</span>
              <span className="block text-[11.5px] text-ink-subtle">
                Sort SLA breaches to the top, grouped by stage
              </span>
            </span>
          </button>

          {data && (
            <p className="text-[13px] text-ink-muted">
              <span className="font-medium text-ink">{data.total}</span> tickets
              {escalation && (
                <>
                  {" · "}
                  <span className="font-medium text-red-600">{data.escalated_count}</span> escalated
                </>
              )}
            </p>
          )}
        </div>

        {loading && !data ? (
          <div className="mt-8 h-64 animate-pulse rounded-xl2 border border-line bg-surface-raised" />
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-[13.5px] text-red-700">
            {error}
          </div>
        ) : data && data.total === 0 ? (
          <p className="mt-10 text-center text-[14px] text-ink-muted">
            No tickets were created in this range.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl2 border border-line">
            <table className="w-full min-w-[1100px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-raised text-left text-[11.5px] uppercase tracking-wide text-ink-subtle">
                  {escalation && <th className="px-3 py-2.5 font-medium">Escalation</th>}
                  <th className="px-3 py-2.5 font-medium">Reference</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Service</th>
                  <th className="px-3 py-2.5 font-medium">Business</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">Severity</th>
                  <th className="px-3 py-2.5 font-medium">Engineer</th>
                  <th className="px-3 py-2.5 font-medium">Created (IST)</th>
                  <th className="px-3 py-2.5 font-medium">Res. (h)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = expanded.has(r.reference);
                  const cols = escalation ? 10 : 9;
                  return (
                    <FragmentRow
                      key={r.reference}
                      r={r}
                      escalation={escalation}
                      isOpen={isOpen}
                      colSpan={cols}
                      stageLabel={stageLabel}
                      onToggle={() => toggleRow(r.reference)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function StageBadge({ stage }: { stage: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 px-1.5 text-[11px] font-semibold text-red-700">
      S{stage}
    </span>
  );
}

function FragmentRow({
  r,
  escalation,
  isOpen,
  colSpan,
  stageLabel,
  onToggle,
}: {
  r: ReportRow;
  escalation: boolean;
  isOpen: boolean;
  colSpan: number;
  stageLabel: Map<number, string>;
  onToggle: () => void;
}) {
  const canExpand = escalation && r.breaches.length > 0;
  return (
    <>
      <tr
        className={`border-b border-line ${canExpand ? "cursor-pointer hover:bg-surface-raised" : ""}`}
        onClick={canExpand ? onToggle : undefined}
      >
        {escalation && (
          <td className="px-3 py-2.5">
            {r.escalated ? (
              <span className="flex items-center gap-1.5">
                {canExpand &&
                  (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                <StageBadge stage={r.earliest_breach_stage!} />
                <span className="text-[11.5px] text-ink-muted">
                  {r.breaches.length} stage{r.breaches.length > 1 ? "s" : ""}
                </span>
              </span>
            ) : (
              <span className="text-[11.5px] text-emerald-600">Within SLA</span>
            )}
          </td>
        )}
        <td className="px-3 py-2.5 font-mono text-[12.5px] text-ink">{r.reference}</td>
        <td className="px-3 py-2.5 text-ink-muted">{r.status}</td>
        <td className="px-3 py-2.5 text-ink-muted">
          {SERVICE_LABEL[r.service_type] ?? r.service_type}
        </td>
        <td className="px-3 py-2.5 text-ink">{r.business_name}</td>
        <td className="px-3 py-2.5 text-ink-muted">{r.product_category}</td>
        <td className="px-3 py-2.5 text-ink-muted">{r.severity}</td>
        <td className="px-3 py-2.5 text-ink-muted">{r.assigned_engineer ?? "—"}</td>
        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">
          {r.created_at ? fmtIst(r.created_at) : "—"}
        </td>
        <td className="px-3 py-2.5 text-ink-muted">
          {r.resolution_hours ?? "—"}
        </td>
      </tr>

      {canExpand && isOpen && (
        <tr className="border-b border-line bg-surface-raised/60">
          <td colSpan={colSpan} className="px-4 py-3">
            <p className="mb-2 text-[11.5px] uppercase tracking-wide text-ink-subtle">
              SLA breaches
            </p>
            <ul className="space-y-1.5">
              {r.breaches.map((b) => (
                <li key={b.stage} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <StageBadge stage={b.stage} />
                  <span className="font-medium text-ink">{stageLabel.get(b.stage) ?? b.label}</span>
                  <span className="text-ink-muted">
                    {fmtOverage(b.elapsed_min)} / {b.threshold_min}m
                  </span>
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                    +{fmtOverage(b.overage_min)} over
                  </span>
                  {b.pending && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                      ongoing
                    </span>
                  )}
                  <span className="text-ink-subtle">
                    {b.responsible_name
                      ? `${b.responsible_name}${b.responsible_role ? ` (${b.responsible_role.toLowerCase()})` : ""}`
                      : "Triage / unassigned"}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

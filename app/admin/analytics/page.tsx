"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth, API_BASE_URL, isAdminLevel } from "@/lib/auth";
import { fmtIstDateShort } from "@/lib/format-date";

type Analytics = {
  window_days: number;
  kpis: {
    total_tickets: number;
    open_tickets: number;
    // Held jobs are excluded from open_tickets and counted here instead.
    on_hold_tickets?: number;
    resolved_tickets: number;
    closed_tickets: number;
    window_tickets: number;
    window_resolved: number;
    avg_resolution_hours: number;
  };
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  tickets_per_day: { date: string; created: number; resolved: number }[];
  resolution_trend: { date: string; avg_hours: number | null; count: number }[];
  issue_breakdown: { issue_category: string; avg_hours: number; resolved_count: number }[];
  product_breakdown: {
    product_category: string;
    total: number;
    resolved: number;
    avg_hours: number;
    // Warranty split per product (added with the revenue block; optional so an
    // older backend payload still renders).
    under_warranty?: number;
    out_of_warranty?: number;
  }[];
  engineer_performance: {
    engineer_id: number;
    name: string;
    assigned: number;
    resolved: number;
    // Installation workload (optional: older backend payloads lack it).
    installs_assigned?: number;
    installs_completed?: number;
    avg_hours: number;
    completion_rate: number;
  }[];
  // Revenue & warranty block — optional so the page renders against an older
  // backend that doesn't send it yet.
  revenue?: {
    billed_inr: number;
    collected_inr: number;
    outstanding_inr: number;
    collection_rate: number;
    awaiting_verification: number;
    tracked_tickets: number;
    untracked_tickets: number;
  };
  warranty_mix?: Record<string, number>;
  service_type_mix?: Record<string, number>;
  // Deep-analytics blocks (all optional — page renders against older payloads).
  sla_stages?: {
    stage: number;
    label: string;
    avg_min: number | null;
    breach_rate: number | null;
    measured: number;
  }[];
  backlog_aging?: Record<string, number>;
  holds?: {
    reference: string;
    business_name: string;
    status: string;
    reason: string | null;
    days_on_hold: number;
  }[];
  installations?: {
    window_created: number;
    window_completed: number;
    open_now: number;
    on_hold: number;
    avg_assign_to_complete_hours: number;
  };
  repeat_businesses?: {
    business_name: string;
    tickets: number;
    open_now: number;
    top_product: string;
  }[];
};

const AGING_ORDER = ["0-2d", "3-7d", "8-14d", "15d+"];

/** Minutes → a compact human figure ("42 min" / "7.6 h"). */
const fmtMin = (m: number | null) =>
  m === null ? "—" : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`;

const WARRANTY_LABELS: Record<string, string> = {
  UNDER_WARRANTY: "Under warranty",
  OUT_OF_WARRANTY: "Out of warranty",
  AMC: "AMC",
  UNKNOWN: "Unknown (untriaged)",
};
const WARRANTY_ORDER = ["UNDER_WARRANTY", "OUT_OF_WARRANTY", "AMC", "UNKNOWN"];

const SERVICE_TYPE_LABELS: Record<string, string> = {
  SITE_VISIT: "Site visit",
  REMOTE_SUPPORT: "Remote support",
  THIRD_PARTY_SUPPORT: "Third-party",
};

/** ₹ with Indian digit grouping (1,23,456). */
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  RESOLVING: "Resolving",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const STATUS_ORDER = ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "ACCEPTED", "RESOLVING", "RESOLVED", "CLOSED"];

export default function AnalyticsPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
    else if (!isAdminLevel(user.role) && user.role !== "MANAGER") router.replace("/admin/tickets");
  }, [ready, user, router]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/analytics?days=${days}`);
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setData((await res.json()) as Analytics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [authFetch, days, router]);

  useEffect(() => {
    if (isAdminLevel(user?.role) || user?.role === "MANAGER") fetchAnalytics();
  }, [user, fetchAnalytics]);

  if (!ready || !user || (!isAdminLevel(user.role) && user.role !== "MANAGER")) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">Analytics</p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
              Service performance
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              Trends across the last {days} days · open count is a live snapshot
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  days === d
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink hover:border-ink-soft"
                }`}
              >
                {d === 365 ? "1y" : `${d}d`}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl2 border border-line bg-surface-raised" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-[13.5px] text-red-700">
            {error}
          </div>
        ) : data ? (
          <>
            {/* KPI cards */}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label={`Tickets · ${days}d`} value={data.kpis.window_tickets} hint="Created within the window" />
              <KpiCard label="Currently open" value={data.kpis.open_tickets} hint="Live · Open/Acked/Assigned/Resolving · excludes held" />
              <KpiCard label="On hold" value={data.kpis.on_hold_tickets ?? 0} hint="Parked — frozen and off the open count" />
              <KpiCard label={`Resolved · ${days}d`} value={data.kpis.window_resolved} hint="Of tickets created in window" />
              <KpiCard
                label="Avg resolution"
                value={`${data.kpis.avg_resolution_hours.toFixed(1)} h`}
                hint="Resolving → Resolved"
              />
            </div>

            {/* Revenue & warranty — money scoped to payment-tracked tickets so
                legacy pre-tracking tickets can't fake a low collection rate. */}
            {data.revenue && (
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <KpiCard
                  label={`Billed · ${days}d`}
                  value={inr(data.revenue.billed_inr)}
                  hint={
                    data.revenue.untracked_tickets > 0
                      ? `${data.revenue.tracked_tickets} payment-tracked tickets · ${data.revenue.untracked_tickets} legacy excluded`
                      : `${data.revenue.tracked_tickets} payment-tracked tickets`
                  }
                />
                <KpiCard
                  label="Collected"
                  value={inr(data.revenue.collected_inr)}
                  hint={`${data.revenue.collection_rate.toFixed(1)}% of billed`}
                />
                <KpiCard
                  label="Outstanding"
                  value={inr(data.revenue.outstanding_inr)}
                  hint="Balance still due across the window's tickets"
                />
                <KpiCard
                  label="Awaiting verification"
                  value={data.revenue.awaiting_verification}
                  hint="Collected in full — needs an Admin to verify"
                />
              </div>
            )}

            {(data.warranty_mix || data.service_type_mix) && (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.warranty_mix && (
                  <ChartCard title="Warranty mix" subtitle={`Tickets created · last ${days}d`}>
                    <HorizontalBars
                      rows={WARRANTY_ORDER.filter((k) => (data.warranty_mix?.[k] ?? 0) > 0).map((k) => ({
                        label: WARRANTY_LABELS[k] ?? k,
                        value: data.warranty_mix?.[k] ?? 0,
                        meta: "",
                        valueLabel: String(data.warranty_mix?.[k] ?? 0),
                      }))}
                    />
                  </ChartCard>
                )}
                {data.service_type_mix && (
                  <ChartCard
                    title="Site visit vs remote"
                    subtitle={`Tickets created · last ${days}d — remote resolutions are the cheapest`}
                  >
                    <HorizontalBars
                      rows={Object.entries(data.service_type_mix)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => ({
                          label: SERVICE_TYPE_LABELS[k] ?? k,
                          value: v,
                          meta: "",
                          valueLabel: String(v),
                        }))}
                    />
                  </ChartCard>
                )}
              </div>
            )}

            {/* Response time & SLA + backlog aging */}
            {(data.sla_stages || data.backlog_aging) && (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.sla_stages && (
                  <ChartCard
                    title="Response time & SLA"
                    subtitle={`Created · last ${days}d — thresholds match the Reports page; hold time not subtracted here`}
                  >
                    <table className="w-full text-left text-[12.5px]">
                      <thead>
                        <tr className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
                          <th className="py-2 font-medium">Stage</th>
                          <th className="py-2 text-right font-medium">Avg</th>
                          <th className="py-2 text-right font-medium">Breached</th>
                          <th className="py-2 text-right font-medium">Measured</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data.sla_stages.map((s) => (
                          <tr key={s.stage}>
                            <td className="py-2.5 text-ink">{s.label}</td>
                            <td className="py-2.5 text-right tabular-nums">{fmtMin(s.avg_min)}</td>
                            <td className="py-2.5 text-right">
                              {s.breach_rate === null ? (
                                <span className="text-ink-subtle">—</span>
                              ) : (
                                <span
                                  className={`tabular-nums ${
                                    s.breach_rate >= 40
                                      ? "text-accent-danger"
                                      : s.breach_rate >= 20
                                        ? "text-amber-700"
                                        : "text-emerald-700"
                                  }`}
                                >
                                  {s.breach_rate.toFixed(1)}%
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-ink-subtle">{s.measured}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ChartCard>
                )}
                {data.backlog_aging && (
                  <ChartCard
                    title="Backlog aging"
                    subtitle="Live open tickets by age — right now, not the window"
                  >
                    <HorizontalBars
                      rows={AGING_ORDER.map((k) => ({
                        label: k,
                        value: data.backlog_aging?.[k] ?? 0,
                        meta: "",
                        valueLabel: String(data.backlog_aging?.[k] ?? 0),
                      }))}
                    />
                  </ChartCard>
                )}
              </div>
            )}

            {/* Current holds + installations */}
            {(data.holds || data.installations) && (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.holds && (
                  <ChartCard title="On hold right now" subtitle="Longest parked first">
                    {data.holds.length === 0 ? (
                      <div className="py-6 text-center text-[13px] text-ink-subtle">Nothing is on hold.</div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {data.holds.map((h) => (
                          <li key={h.reference} className="flex items-baseline justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <span className="font-mono text-[12px] text-ink">{h.reference}</span>
                              <span className="ml-2 text-[12.5px] text-ink-muted">{h.business_name}</span>
                              <div className="truncate text-[12px] font-medium text-amber-700">
                                {h.reason ?? "No reason given"}
                              </div>
                            </div>
                            <span className="shrink-0 tabular-nums text-[12.5px] text-ink-subtle">
                              {h.days_on_hold.toFixed(1)}d
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </ChartCard>
                )}
                {data.installations && (
                  <ChartCard title="Installations" subtitle={`Same ${days}d window · completion measured Assign → Complete`}>
                    <div className="grid grid-cols-2 gap-4">
                      <MiniStat label={`Created · ${days}d`} value={data.installations.window_created} />
                      <MiniStat label={`Completed · ${days}d`} value={data.installations.window_completed} />
                      <MiniStat label="Open now" value={data.installations.open_now} />
                      <MiniStat label="On hold" value={data.installations.on_hold} />
                    </div>
                    <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-muted">
                      Avg assign → complete:{" "}
                      <span className="font-semibold tabular-nums text-ink">
                        {data.installations.avg_assign_to_complete_hours.toFixed(1)} h
                      </span>
                    </p>
                  </ChartCard>
                )}
              </div>
            )}

            {/* Repeat businesses */}
            {data.repeat_businesses && data.repeat_businesses.length > 0 && (
              <div className="mt-6">
                <ChartCard
                  title="Repeat businesses"
                  subtitle={`2+ tickets · last ${days}d — several tickets from one site is rarely coincidence`}
                >
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
                        <th className="py-2 font-medium">Business</th>
                        <th className="py-2 font-medium">Most-ticketed product</th>
                        <th className="py-2 text-right font-medium">Tickets</th>
                        <th className="py-2 text-right font-medium">Open now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.repeat_businesses.map((b) => (
                        <tr key={b.business_name}>
                          <td className="py-2.5 text-ink">{b.business_name}</td>
                          <td className="py-2.5 text-ink-muted">{b.top_product}</td>
                          <td className="py-2.5 text-right tabular-nums">{b.tickets}</td>
                          <td className="py-2.5 text-right tabular-nums">
                            {b.open_now > 0 ? (
                              <span className="text-amber-700">{b.open_now}</span>
                            ) : (
                              <span className="text-ink-subtle">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ChartCard>
              </div>
            )}

            {/* Tickets per day + Status breakdown */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Tickets per day" subtitle="Created vs. Resolved" className="lg:col-span-2">
                <DualLineChart series={data.tickets_per_day} />
              </ChartCard>

              <ChartCard title="Status breakdown" subtitle={`Created · last ${days}d`}>
                <StatusBars buckets={data.by_status} />
              </ChartCard>
            </div>

            {/* Resolution trend */}
            <div className="mt-6">
              <ChartCard
                title="Average resolution time trend"
                subtitle={`Hours · ${days} day window · only days with resolutions appear in the curve`}
              >
                <TrendChart points={data.resolution_trend} />
              </ChartCard>
            </div>

            {/* Issue + Engineer breakdowns */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Avg resolution time by issue category" subtitle={`Hours · created · last ${days}d`}>
                <HorizontalBars
                  rows={data.issue_breakdown.map((r) => ({
                    label: r.issue_category,
                    value: r.avg_hours,
                    meta: `${r.resolved_count} resolved`,
                    valueLabel: `${r.avg_hours.toFixed(1)} h`,
                  }))}
                />
              </ChartCard>

              <ChartCard title="Engineer performance" subtitle={`Assigned vs. resolved · avg hours · last ${days}d`}>
                <EngineerTable rows={data.engineer_performance} />
              </ChartCard>
            </div>

            {/* Product mix */}
            <div className="mt-6">
              <ChartCard title="Tickets by product category" subtitle={`Total · warranty split · avg resolution hours · last ${days}d`}>
                <ProductTable rows={data.product_breakdown} />
              </ChartCard>
            </div>
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}

/* -------------------------- Layout helpers ---------------------------- */

function KpiCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-5 shadow-soft">
      <p className="text-[11.5px] uppercase tracking-[0.14em] text-ink-subtle">{label}</p>
      {/* Sans (Inter) with lining tabular figures — the display serif's
          old-style numerals read slowly on stat cards. Headings keep the serif;
          numbers don't. */}
      <p className="mt-1.5 text-[26px] font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-ink-subtle">{hint}</p>}
    </div>
  );
}

/** Small stat used inside a ChartCard (the KPI cards are full tiles). */
function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl2 border border-line bg-white p-5 shadow-soft ${className ?? ""}`}>
      <div className="mb-4">
        <h3 className="text-[14.5px] font-medium text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12px] text-ink-subtle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* -------------------------- Charts (inline SVG) ----------------------- */

function DualLineChart({ series }: { series: { date: string; created: number; resolved: number }[] }) {
  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 32 };

  const maxY = Math.max(1, ...series.flatMap((d) => [d.created, d.resolved]));
  const xStep = (width - padding.left - padding.right) / Math.max(1, series.length - 1);
  const yScale = (v: number) => height - padding.bottom - (v / maxY) * (height - padding.top - padding.bottom);
  const xAt = (i: number) => padding.left + xStep * i;

  const buildPath = (key: "created" | "resolved") =>
    series
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yScale(d[key]).toFixed(1)}`)
      .join(" ");

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = Math.round((maxY * i) / yTicks);
    return { v, y: yScale(v) };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={g.y}
              y2={g.y}
              stroke="#EAEAEA"
              strokeWidth={1}
            />
            <text x={padding.left - 6} y={g.y + 3} textAnchor="end" fontSize={10} fill="#737373">
              {g.v}
            </text>
          </g>
        ))}
        <path d={buildPath("created")} fill="none" stroke="#0A0A0A" strokeWidth={1.6} />
        <path d={buildPath("resolved")} fill="none" stroke="#10B981" strokeWidth={1.6} strokeDasharray="3 3" />

        {series.map((d, i) =>
          i % Math.ceil(series.length / 8) === 0 ? (
            <text
              key={d.date}
              x={xAt(i)}
              y={height - padding.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#737373"
            >
              {shortDate(d.date)}
            </text>
          ) : null
        )}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[12px] text-ink-muted">
        <LegendDot color="#0A0A0A" /> Created
        <LegendDot color="#10B981" dashed /> Resolved
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: { date: string; avg_hours: number | null; count: number }[] }) {
  const width = 1080;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };

  const valued = points.filter((p) => p.avg_hours !== null) as { date: string; avg_hours: number; count: number }[];
  const maxY = Math.max(1, ...valued.map((p) => p.avg_hours));
  const xStep = (width - padding.left - padding.right) / Math.max(1, points.length - 1);
  const yScale = (v: number) => height - padding.bottom - (v / maxY) * (height - padding.top - padding.bottom);
  const xAt = (i: number) => padding.left + xStep * i;

  const path = points
    .map((p, i) =>
      p.avg_hours === null ? null : `${xAt(i).toFixed(1)},${yScale(p.avg_hours).toFixed(1)}`
    )
    .filter(Boolean)
    .reduce((acc: string, point, i) => (i === 0 ? `M ${point}` : `${acc} L ${point}`), "");

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = (maxY * i) / yTicks;
    return { v, y: yScale(v) };
  });

  if (valued.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] text-ink-subtle">
        No resolutions in this window yet.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={g.y}
              y2={g.y}
              stroke="#EAEAEA"
              strokeWidth={1}
            />
            <text x={padding.left - 6} y={g.y + 3} textAnchor="end" fontSize={10} fill="#737373">
              {g.v.toFixed(1)}h
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#3B82F6" strokeWidth={1.8} />
        {points.map((p, i) =>
          p.avg_hours !== null ? (
            <circle
              key={p.date}
              cx={xAt(i)}
              cy={yScale(p.avg_hours)}
              r={2.2}
              fill="#3B82F6"
            >
              <title>
                {shortDate(p.date)}: {p.avg_hours.toFixed(2)}h avg · {p.count} resolved
              </title>
            </circle>
          ) : null
        )}
        {points.map((p, i) =>
          i % Math.ceil(points.length / 10) === 0 ? (
            <text
              key={p.date}
              x={xAt(i)}
              y={height - padding.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#737373"
            >
              {shortDate(p.date)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function StatusBars({ buckets }: { buckets: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(buckets));
  return (
    <div className="space-y-2">
      {STATUS_ORDER.map((s) => {
        const v = buckets[s] ?? 0;
        const pct = (v / max) * 100;
        return (
          <div key={s} className="flex items-center gap-3">
            <span className="w-24 text-[12px] text-ink-muted">{STATUS_LABELS[s] ?? s}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-ink"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-[12.5px] font-medium text-ink">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBars({
  rows,
}: {
  rows: { label: string; value: number; valueLabel: string; meta?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <div className="py-6 text-center text-[13px] text-ink-subtle">No resolved tickets yet.</div>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-ink">{r.label}</span>
              <span className="text-ink-muted">
                {r.valueLabel}
                {r.meta && <span className="ml-2 text-ink-subtle">{r.meta}</span>}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EngineerTable({
  rows,
}: {
  rows: {
    engineer_id: number;
    name: string;
    assigned: number;
    resolved: number;
    installs_assigned?: number;
    installs_completed?: number;
    avg_hours: number;
    completion_rate: number;
  }[];
}) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-[13px] text-ink-subtle">No engineers yet.</div>;
  }
  // Older backend payloads lack install counts — hide the column then.
  const hasInstalls = rows.some((r) => r.installs_assigned !== undefined);
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
          <th className="py-2 font-medium">Engineer</th>
          <th className="py-2 text-right font-medium">Assigned</th>
          <th className="py-2 text-right font-medium">Resolved</th>
          {hasInstalls && (
            <th className="py-2 text-right font-medium" title="Installations assigned · completed">
              Installs
            </th>
          )}
          <th className="py-2 text-right font-medium">Avg hrs</th>
          <th className="py-2 text-right font-medium">Completion</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.engineer_id}>
            <td className="py-2.5 text-ink">{r.name}</td>
            <td className="py-2.5 text-right tabular-nums">{r.assigned}</td>
            <td className="py-2.5 text-right tabular-nums">{r.resolved}</td>
            {hasInstalls && (
              <td className="py-2.5 text-right tabular-nums">
                {r.installs_assigned ?? 0} · {r.installs_completed ?? 0}
              </td>
            )}
            <td className="py-2.5 text-right tabular-nums">{r.avg_hours.toFixed(1)}</td>
            <td className="py-2.5 text-right">
              <CompletionBadge pct={r.completion_rate} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductTable({
  rows,
}: {
  rows: {
    product_category: string;
    total: number;
    resolved: number;
    avg_hours: number;
    under_warranty?: number;
    out_of_warranty?: number;
  }[];
}) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-[13px] text-ink-subtle">No products tracked yet.</div>;
  }
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  // Older backend payloads lack the warranty split — hide the columns then.
  const hasWarranty = rows.some((r) => r.under_warranty !== undefined);
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
          <th className="py-2 font-medium">Product</th>
          <th className="py-2 font-medium">Volume</th>
          <th className="py-2 text-right font-medium">Total</th>
          {hasWarranty && (
            <>
              <th className="py-2 text-right font-medium" title="Under warranty / AMC excluded">In war.</th>
              <th className="py-2 text-right font-medium">Out war.</th>
            </>
          )}
          <th className="py-2 text-right font-medium">Resolved</th>
          <th className="py-2 text-right font-medium">Avg hrs</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.product_category}>
            <td className="py-2.5 text-ink">{r.product_category}</td>
            <td className="py-2.5">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${(r.total / maxTotal) * 100}%` }}
                />
              </div>
            </td>
            <td className="py-2.5 text-right tabular-nums">{r.total}</td>
            {hasWarranty && (
              <>
                <td className="py-2.5 text-right tabular-nums text-emerald-700">{r.under_warranty ?? 0}</td>
                <td className="py-2.5 text-right tabular-nums text-amber-700">{r.out_of_warranty ?? 0}</td>
              </>
            )}
            <td className="py-2.5 text-right tabular-nums">{r.resolved}</td>
            <td className="py-2.5 text-right tabular-nums">{r.avg_hours.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompletionBadge({ pct }: { pct: number }) {
  const tone =
    pct >= 80 ? "bg-emerald-50 text-emerald-700"
    : pct >= 50 ? "bg-amber-50 text-amber-700"
    : "bg-neutral-100 text-neutral-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] tabular-nums ${tone}`}>
      {pct.toFixed(0)}%
    </span>
  );
}

function LegendDot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6">
        <line
          x1="0"
          y1="3"
          x2="18"
          y2="3"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? "3 3" : undefined}
        />
      </svg>
    </span>
  );
}

function shortDate(iso: string): string {
  return fmtIstDateShort(iso);
}

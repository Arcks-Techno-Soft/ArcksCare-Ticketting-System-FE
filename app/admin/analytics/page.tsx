"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { useAuth, API_BASE_URL } from "@/lib/auth";
import { fmtIstDateShort } from "@/lib/format-date";

type Analytics = {
  window_days: number;
  kpis: {
    total_tickets: number;
    open_tickets: number;
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
  product_breakdown: { product_category: string; total: number; resolved: number; avg_hours: number }[];
  engineer_performance: {
    engineer_id: number;
    name: string;
    assigned: number;
    resolved: number;
    avg_hours: number;
    completion_rate: number;
  }[];
};

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
    else if (user.role !== "ADMIN" && user.role !== "MANAGER") router.replace("/admin/tickets");
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
    if (user?.role === "ADMIN" || user?.role === "MANAGER") fetchAnalytics();
  }, [user, fetchAnalytics]);

  if (!ready || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) return null;

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
              Trends across the last {days} days · totals reflect lifetime data
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
              <KpiCard label="Total tickets" value={data.kpis.total_tickets} hint="All time" />
              <KpiCard label="Currently open" value={data.kpis.open_tickets} hint="Open/Acked/Assigned/Resolving" />
              <KpiCard label={`Resolved · ${days}d`} value={data.kpis.window_resolved} hint="Within the window" />
              <KpiCard
                label="Avg resolution"
                value={`${data.kpis.avg_resolution_hours.toFixed(1)} h`}
                hint="Resolving → Resolved"
              />
            </div>

            {/* Tickets per day + Status breakdown */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Tickets per day" subtitle="Created vs. Resolved" className="lg:col-span-2">
                <DualLineChart series={data.tickets_per_day} />
              </ChartCard>

              <ChartCard title="Status breakdown" subtitle="All-time">
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
              <ChartCard title="Avg resolution time by issue category" subtitle="Hours · all-time">
                <HorizontalBars
                  rows={data.issue_breakdown.map((r) => ({
                    label: r.issue_category,
                    value: r.avg_hours,
                    meta: `${r.resolved_count} resolved`,
                    valueLabel: `${r.avg_hours.toFixed(1)} h`,
                  }))}
                />
              </ChartCard>

              <ChartCard title="Engineer performance" subtitle="Assigned vs. resolved · avg hours">
                <EngineerTable rows={data.engineer_performance} />
              </ChartCard>
            </div>

            {/* Product mix */}
            <div className="mt-6">
              <ChartCard title="Tickets by product category" subtitle="Total tickets · avg resolution hours">
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
      <p className="mt-1.5 font-display text-3xl font-medium text-ink">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-ink-subtle">{hint}</p>}
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
    avg_hours: number;
    completion_rate: number;
  }[];
}) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-[13px] text-ink-subtle">No engineers yet.</div>;
  }
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
          <th className="py-2 font-medium">Engineer</th>
          <th className="py-2 text-right font-medium">Assigned</th>
          <th className="py-2 text-right font-medium">Resolved</th>
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
  rows: { product_category: string; total: number; resolved: number; avg_hours: number }[];
}) {
  if (rows.length === 0) {
    return <div className="py-6 text-center text-[13px] text-ink-subtle">No products tracked yet.</div>;
  }
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-[0.12em] text-ink-subtle">
          <th className="py-2 font-medium">Product</th>
          <th className="py-2 font-medium">Volume</th>
          <th className="py-2 text-right font-medium">Total</th>
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

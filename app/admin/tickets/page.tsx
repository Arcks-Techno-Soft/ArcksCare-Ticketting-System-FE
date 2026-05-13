"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { StatusBadge, SeverityBadge, WarrantyBadge } from "@/components/admin/status-badge";
import { Input, Select } from "@/components/ui/Field";

type AdminTicket = {
  id: number;
  reference: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  product_category: string;
  serial_number: string;
  issue_category: string;
  severity: string;
  status: string;
  warranty_status: string;
  created_at: string;
  attachments: { id: number; filename: string }[];
};

const STATUSES = ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "ACCEPTED", "RESOLVING", "RESOLVED", "CLOSED"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const REFRESH_INTERVAL_MS = 30_000;

export default function AdminTicketsPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [search, setSearch] = useState("");

  // Gate: redirect to login if not authed
  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  const fetchTickets = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (severityFilter) qs.set("severity", severityFilter);
    if (search.trim()) qs.set("search", search.trim());
    qs.set("limit", "100");

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/tickets?${qs.toString()}`);
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server ${res.status}: ${text.slice(0, 120)}`);
      }
      const data = (await res.json()) as AdminTicket[];
      setTickets(data);
      setError(null);
      setLastRefreshAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [authFetch, router, statusFilter, severityFilter, search]);

  // Initial load + refresh on filter change
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchTickets();
  }, [user, fetchTickets]);

  // Auto-refresh interval (only when authed and tab is visible-ish)
  useEffect(() => {
    if (!user) return;
    const i = setInterval(fetchTickets, REFRESH_INTERVAL_MS);
    return () => clearInterval(i);
  }, [user, fetchTickets]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tickets) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tickets]);

  if (!ready || !user) return null;

  return (
    <div className="min-h-screen bg-white">
      <AdminNav />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
              {user.role === "ENGINEER" ? "My work" : "Tickets"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
              {user.role === "ENGINEER" ? "Assigned to me" : "Inbox"}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
              {lastRefreshAt && (
                <>
                  {" "}· auto-refreshed at {lastRefreshAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </>
              )}
            </p>
          </div>

          {/* Status pill counts */}
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(active ? "" : s)}
                  className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink-soft"
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()} {counts[s] ? `· ${counts[s]}` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto]">
          <Input
            placeholder="Search by reference, business name, or serial number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            options={SEVERITIES}
            placeholder="All severities"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          />
          <button
            type="button"
            onClick={() => fetchTickets()}
            className="rounded-xl2 border border-line bg-white px-5 py-3.5 text-[13.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
          >
            Refresh now
          </button>
        </div>

        {/* Table */}
        <div className="mt-8 overflow-hidden rounded-xl2 border border-line shadow-soft">
          <table className="w-full text-left text-[13.5px]">
            <thead className="bg-surface-raised">
              <tr className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                <Th>Reference</Th>
                <Th>Business</Th>
                <Th>Product · Serial</Th>
                <Th>Issue</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Warranty</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && tickets.length === 0 ? (
                <SkeletonRows />
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-ink-subtle">
                    {error ? error : "No tickets match these filters."}
                  </td>
                </tr>
              ) : (
                tickets.map((t, i) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.012, 0.2) }}
                    className="cursor-pointer transition-colors hover:bg-surface-raised"
                    onClick={() => router.push(`/admin/tickets/${t.reference}`)}
                  >
                    <Td>
                      <span className="font-mono text-[13px] text-ink">{t.reference}</span>
                    </Td>
                    <Td>
                      <div className="text-ink">{t.business_name}</div>
                      <div className="text-[12px] text-ink-subtle">
                        {t.city}, {t.state}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-ink">{t.product_category}</div>
                      <div className="font-mono text-[12px] text-ink-subtle">{t.serial_number}</div>
                    </Td>
                    <Td>
                      <span className="text-ink">{t.issue_category}</span>
                    </Td>
                    <Td><SeverityBadge severity={t.severity} /></Td>
                    <Td><StatusBadge status={t.status} /></Td>
                    <Td><WarrantyBadge status={t.warranty_status} /></Td>
                    <Td>
                      <span className="text-ink-muted" title={new Date(t.created_at).toLocaleString()}>
                        {timeAgo(t.created_at)}
                      </span>
                    </Td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* -------------------------- Layout helpers ---------------------------- */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-top">{children}</td>;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-3 w-3/4 rounded bg-line" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

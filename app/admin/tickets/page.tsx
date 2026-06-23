"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { DashboardViewTabs } from "@/components/admin/dashboard-tabs";
import { StatusBadge, SeverityBadge, WarrantyBadge } from "@/components/admin/status-badge";
import { Input, Select } from "@/components/ui/Field";
import { fmtIst, fmtIstTime, fmtIstDate, fmtIstDateDMY } from "@/lib/format-date";
import { CloseTicketDialog } from "@/components/admin/close-ticket-dialog";
import { DeleteTicketDialog } from "@/components/admin/delete-ticket-dialog";
import { LatestNotePopover } from "@/components/admin/latest-note-popover";

type AdminTicket = {
  id: number;
  reference: string;
  business_name: string;
  city: string;
  state: string;
  product_category: string;
  serial_number: string;
  issue_category: string;
  severity: string;
  status: string;
  warranty_status: string;
  raised_by?: { id: number; name: string; role?: string } | null;
  assigned_engineer?: { id: number; name: string } | null;
  created_at: string;
};

const STATUSES = ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "ACCEPTED", "RESOLVING", "RESOLVED", "CLOSED"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const DATE_RANGES: { label: string; days: number | null }[] = [
  { label: "Any time", days: null },
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 365 days", days: 365 },
];
const REFRESH_INTERVAL_MS = 30_000;
const PAGE_SIZES = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

type TicketListResponse = {
  items: AdminTicket[];
  total: number;
  limit: number;
  offset: number;
};

export default function AdminTicketsPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();
  const isAdmin = user?.role === "ADMIN"; // OWNER is normalized to ADMIN at login
  // Quick close/delete (Admin/Owner) — actionRef is the row being acted on.
  const [actionRef, setActionRef] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"close" | "delete" | null>(null);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [total, setTotal] = useState(0);
  // Per-status counts come from a dedicated aggregate endpoint, NOT from the
  // currently-fetched page — otherwise selecting one status would zero out the
  // counts on every other pill.
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState(0);
  // True once the aggregate endpoint answers successfully. While false (e.g.
  // backend not yet deployed) we fall back to counts derived from the loaded
  // page so the pills never regress to blank/zero.
  const [countsAvailable, setCountsAvailable] = useState(false);
  // First-load skeleton is distinct from background refetch — never flicker
  // skeletons over existing rows when filters change or auto-refresh fires.
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createdWithinDays, setCreatedWithinDays] = useState<number | null>(null);

  // Pagination
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(0);

  // Debounce the search input so typing doesn't fire a fetch per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 0 whenever the filter set changes, otherwise we might be
  // sitting on a page that no longer exists.
  useEffect(() => {
    setPage(0);
  }, [statusFilter, severityFilter, debouncedSearch, createdWithinDays, pageSize]);

  // Gate: redirect to login if not authed
  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  const fetchTickets = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (severityFilter) qs.set("severity", severityFilter);
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    if (createdWithinDays) qs.set("created_within_days", String(createdWithinDays));
    qs.set("limit", String(pageSize));
    qs.set("offset", String(page * pageSize));

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
      const data = (await res.json()) as TicketListResponse;
      setTickets(data.items);
      setTotal(data.total);
      setError(null);
      setLastRefreshAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setInitialLoading(false);
    }
  }, [authFetch, router, statusFilter, severityFilter, debouncedSearch, createdWithinDays, page, pageSize]);

  // Aggregate counts for the status pills. Note: the status filter is
  // intentionally NOT sent — every pill must show its count regardless of which
  // status is currently selected.
  const fetchCounts = useCallback(async () => {
    const qs = new URLSearchParams();
    if (severityFilter) qs.set("severity", severityFilter);
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    if (createdWithinDays) qs.set("created_within_days", String(createdWithinDays));

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/tickets/counts?${qs.toString()}`);
      if (!res.ok) {
        // Endpoint missing/unavailable — keep the client-side fallback active.
        setCountsAvailable(false);
        return;
      }
      const data = (await res.json()) as { by_status: Record<string, number>; total: number };
      setStatusCounts(data.by_status ?? {});
      setGrandTotal(data.total ?? 0);
      setCountsAvailable(true);
    } catch {
      // Non-fatal: fall back to client-side counts. The list fetch surfaces errors.
      setCountsAvailable(false);
    }
  }, [authFetch, severityFilter, debouncedSearch, createdWithinDays]);

  // Refetch on filter or page change. Skeleton only shows during the FIRST
  // load — subsequent fetches leave the current rows in place while loading.
  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user, fetchTickets]);

  // Counts refresh whenever the non-status filters change (independent of the
  // selected status and pagination).
  useEffect(() => {
    if (!user) return;
    fetchCounts();
  }, [user, fetchCounts]);

  // Auto-refresh interval (only when authed and tab is visible-ish)
  useEffect(() => {
    if (!user) return;
    const i = setInterval(() => {
      fetchTickets();
      fetchCounts();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(i);
  }, [user, fetchTickets, fetchCounts]);

  // Prefer the aggregate endpoint. If it isn't available, derive counts from the
  // loaded page (matches the pre-fix behaviour) rather than showing zeros.
  const clientCounts: Record<string, number> = {};
  for (const t of tickets) clientCounts[t.status] = (clientCounts[t.status] ?? 0) + 1;
  const counts = countsAvailable ? statusCounts : clientCounts;
  const allCount = countsAvailable ? grandTotal : total;

  if (!ready || !user) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6">
          <DashboardViewTabs />
        </div>
        <div className="flex items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
              {user.role === "ENGINEER" ? "My work" : "Tickets"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
              {user.role === "ENGINEER" ? "Assigned to me" : "Inbox"}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              {total} ticket{total === 1 ? "" : "s"}
              {lastRefreshAt && (
                <>
                  {" "}· auto-refreshed at {fmtIstTime(lastRefreshAt, { withSeconds: true })}
                </>
              )}
            </p>
          </div>

          {/* Status pill counts */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                statusFilter === ""
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-ink-soft"
              }`}
            >
              All · {allCount}
            </button>
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
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_200px_auto]">
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
          <div className="relative">
            <select
              value={createdWithinDays ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCreatedWithinDays(v === "" ? null : Number(v));
              }}
              className="w-full appearance-none rounded-xl2 border border-line bg-white px-4 py-3.5 pr-10 text-[13.5px] text-ink hover:border-ink-soft focus:border-ink focus:outline-none transition-colors"
              aria-label="Opened within"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.label} value={r.days ?? ""}>
                  {r.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
              width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchTickets();
              fetchCounts();
            }}
            className="rounded-xl2 border border-line bg-white px-5 py-3.5 text-[13.5px] text-ink hover:border-ink hover:bg-surface-raised transition-colors"
          >
            Refresh now
          </button>
        </div>

        {/* Table */}
        <div className="mt-8 overflow-x-auto rounded-xl2 border border-line shadow-soft">
          <table className="w-full min-w-[760px] text-left text-[13.5px]">
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
                {isAdmin && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialLoading && tickets.length === 0 ? (
                <SkeletonRows />
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-5 py-12 text-center text-ink-subtle">
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
                      <div className="mt-0.5 text-[11px] text-ink-subtle">
                        {fmtIstDateDMY(t.created_at)}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-ink">{t.business_name}</div>
                      <div className="text-[12px] text-ink-subtle">
                        {t.city}, {t.state}
                      </div>
                      {t.raised_by && (
                        <div className="mt-1 inline-flex items-center rounded-full border border-line bg-surface-raised px-2 py-0.5 text-[11px] text-ink-muted">
                          Created by {t.raised_by.name}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="text-ink">{t.product_category}</div>
                      <div className="font-mono text-[12px] text-ink-subtle">{t.serial_number}</div>
                    </Td>
                    <Td>
                      <span className="text-ink">{t.issue_category}</span>
                    </Td>
                    <Td><SeverityBadge severity={t.severity} /></Td>
                    <Td>
                      <StatusBadge status={t.status} />
                      {t.assigned_engineer && (
                        <div
                          className="mt-1 max-w-[150px] truncate text-[12px] text-ink-subtle"
                          title={`Assigned to ${t.assigned_engineer.name}`}
                        >
                          {t.assigned_engineer.name}
                        </div>
                      )}
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <LatestNotePopover
                          notesUrl={`${API_BASE_URL}/api/v1/admin/tickets/${t.reference}/notes`}
                          authFetch={authFetch}
                        />
                      </div>
                    </Td>
                    <Td><WarrantyBadge status={t.warranty_status} /></Td>
                    <Td>
                      <span className="text-ink-muted" title={fmtIst(t.created_at)}>
                        {timeAgo(t.created_at)}
                      </span>
                    </Td>
                    {isAdmin && (
                      <Td>
                        <div className="flex items-center gap-3">
                          {t.status !== "CLOSED" && (
                            <button
                              type="button"
                              className="text-[12.5px] font-medium text-red-600 hover:text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionRef(t.reference);
                                setActionMode("close");
                              }}
                            >
                              Close
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-[12.5px] font-medium text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionRef(t.reference);
                              setActionMode("delete");
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    )}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => setPageSize(n)}
        />
      </section>

      {isAdmin && actionRef && (
        <>
          <CloseTicketDialog
            open={actionMode === "close"}
            reference={actionRef}
            authFetch={authFetch}
            onClose={() => setActionMode(null)}
            onClosed={() => {
              setActionMode(null);
              fetchTickets();
              fetchCounts();
            }}
          />
          <DeleteTicketDialog
            open={actionMode === "delete"}
            reference={actionRef}
            authFetch={authFetch}
            onClose={() => setActionMode(null)}
            onDeleted={() => {
              setActionMode(null);
              fetchTickets();
              fetchCounts();
            }}
          />
        </>
      )}
    </AdminShell>
  );
}

/* -------------------------- Pagination ------------------------------- */

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: PageSize) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="rounded-md border border-line bg-white px-2 py-1 text-[12.5px] text-ink hover:border-ink-soft focus:border-ink focus:outline-none"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="rounded-md border border-line bg-white px-3 py-1 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-white transition-colors"
          >
            Previous
          </button>
          <span className="px-2 text-[12.5px] tabular-nums">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-line bg-white px-3 py-1 text-[12.5px] text-ink hover:border-ink hover:bg-surface-raised disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-white transition-colors"
          >
            Next
          </button>
        </div>
      </div>
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
  return fmtIstDate(iso);
}

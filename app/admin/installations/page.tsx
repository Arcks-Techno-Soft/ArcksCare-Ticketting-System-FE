"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { fmtIst, fmtIstDate } from "@/lib/format-date";

type InstallationRow = {
  id: number;
  reference: string;
  business_name: string;
  business_category: string;
  contact_name: string;
  phone: string;
  invoice_number: string;
  status: string;
  created_by?: { id: number; name: string; role: string } | null;
  assigned_engineer?: { id: number; name: string; role: string } | null;
  created_at: string;
};

type ListResponse = {
  items: InstallationRow[];
  total: number;
  limit: number;
  offset: number;
};

const STATUSES = ["NEW", "ASSIGNED", "COMPLETED", "CLOSED"] as const;

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-amber-50 text-amber-800 border-amber-200",
  ASSIGNED: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-violet-50 text-violet-800 border-violet-200",
  CLOSED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export default function InstallationsListPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  const [rows, setRows] = useState<InstallationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Owners and managers only — engineers see their assigned installs in tickets
  // dashboard equivalent; we still allow them to view but the page is most
  // useful to Owner/Manager.
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login");
  }, [ready, user, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchRows = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    qs.set("limit", "50");

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/admin/installations?${qs.toString()}`);
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = (await res.json()) as ListResponse;
      setRows(data.items);
      setTotal(data.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load installations");
    } finally {
      setLoading(false);
    }
  }, [authFetch, router, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!user) return;
    fetchRows();
  }, [user, fetchRows]);

  if (!ready || !user) return null;

  // Any staff member can open an installation; engineer-opened ones land in the
  // admin queue tagged with who opened them.
  const canCreate = true;

  return (
    <AdminShell>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
              {user.role === "ENGINEER" ? "My work" : "Installations"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
              {user.role === "ENGINEER" ? "Assigned to me" : "New installations"}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              {total} installation{total === 1 ? "" : "s"}
            </p>
          </div>

          {canCreate && (
            <Link href="/admin/installations/new">
              <Button type="button" variant="primary" size="md">
                + Start new installation
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              statusFilter === ""
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink hover:border-ink-soft"
            }`}
          >
            All
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
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            );
          })}
          <div className="ml-auto w-full md:w-80">
            <Input
              placeholder="Search by reference, business, invoice…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl2 border border-line shadow-soft">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead className="bg-surface-raised">
              <tr className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
                <Th>Reference</Th>
                <Th>Business</Th>
                <Th>Contact</Th>
                <Th>Invoice #</Th>
                <Th>Assigned</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && rows.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 w-3/4 rounded bg-line" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-ink-subtle">
                    {error ?? "No installations yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.012, 0.2) }}
                    className="cursor-pointer transition-colors hover:bg-surface-raised"
                    onClick={() => router.push(`/admin/installations/${r.reference}`)}
                  >
                    <Td>
                      <span className="font-mono text-[13px] text-ink">{r.reference}</span>
                    </Td>
                    <Td>
                      <div className="text-ink">{r.business_name}</div>
                      <div className="text-[12px] text-ink-subtle">{r.business_category}</div>
                      {r.created_by && (
                        <div className="mt-1 inline-flex items-center rounded-full border border-line bg-surface-raised px-2 py-0.5 text-[11px] text-ink-muted">
                          Opened by {r.created_by.name}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="text-ink">{r.contact_name}</div>
                      <div className="text-[12px] text-ink-subtle">{r.phone}</div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[13px] text-ink">{r.invoice_number}</span>
                    </Td>
                    <Td>
                      <span className="text-ink">
                        {r.assigned_engineer?.name ?? <span className="text-ink-subtle">—</span>}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[r.status] ?? "bg-neutral-50 text-neutral-700 border-neutral-200"
                        }`}
                      >
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-ink-muted" title={fmtIst(r.created_at)}>
                        {timeAgo(r.created_at)}
                      </span>
                    </Td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 align-top">{children}</td>;
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

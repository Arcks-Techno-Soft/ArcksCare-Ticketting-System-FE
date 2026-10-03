"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth, API_BASE_URL } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { TicketForm } from "@/components/ticket-form";
import { fetchBusinessNameSuggestions, submitTicket } from "@/lib/api";
import { ticketToCloneDefaults, type CloneSource } from "@/lib/clone-ticket";
import type { TicketFormValues } from "@/lib/schema";

/**
 * Staff-facing ticket creation. Any signed-in staff member (Admin / Manager /
 * Engineer) can open a ticket here. Because it submits with the staff member's
 * JWT, the backend records them as `raised_by`, so the ticket surfaces in the
 * admin inbox tagged "Opened by <name>" for an Admin/Manager to assign.
 *
 * `?clone=<reference>` pre-fills the form from that ticket (customer, address,
 * product, issue, description) for another device at the same customer. The
 * serial number is left blank on purpose and must be typed.
 */
export default function AdminNewTicketPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  // Read from window.location rather than useSearchParams so the page doesn't
  // need a Suspense boundary at build time.
  const [cloneRef, setCloneRef] = useState<string | null>(null);
  const [cloneDefaults, setCloneDefaults] = useState<Partial<TicketFormValues> | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("clone");
    if (ref) setCloneRef(ref.trim().toUpperCase());
  }, []);

  useEffect(() => {
    if (!user || !cloneRef) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/v1/admin/tickets/${encodeURIComponent(cloneRef)}`
        );
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Ticket not found" : `Server ${res.status}`);
        }
        const t = (await res.json()) as CloneSource;
        if (!cancelled) setCloneDefaults(ticketToCloneDefaults(t));
      } catch (e) {
        if (!cancelled) {
          setCloneError(e instanceof Error ? e.message : "Could not load the ticket to clone");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cloneRef, authFetch]);

  if (!ready || !user) return null;

  const cloning = cloneRef !== null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <Link
            href={cloning ? `/admin/tickets/${cloneRef}` : "/admin/tickets"}
            className="text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            {cloning ? `← Back to ${cloneRef}` : "← Back to inbox"}
          </Link>
          <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Tickets
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            {cloning ? "Clone ticket" : "Open a new ticket"}
          </h1>
          {cloning ? (
            <p className="mt-1 text-[13.5px] text-ink-muted">
              Customer, address, product and issue are copied from{" "}
              <span className="font-mono">{cloneRef}</span>. Enter the{" "}
              <span className="font-medium text-ink">serial number</span> of this device, check
              the details, then open the new ticket.
            </p>
          ) : (
            <p className="mt-1 text-[13.5px] text-ink-muted">
              This ticket will appear in the admin inbox tagged “Created by {user.name}”,
              ready for an owner or admin to assign.
            </p>
          )}
        </div>

        <div className="mt-8">
          {cloning && cloneError ? (
            <p className="rounded-xl2 border border-line px-5 py-8 text-center text-[13.5px] text-ink-muted">
              Couldn’t load {cloneRef} to clone: {cloneError}.
            </p>
          ) : cloning && !cloneDefaults ? (
            <div className="h-[420px] w-full animate-pulse rounded-xl2 border border-line bg-surface-raised" />
          ) : (
            <TicketForm
              key={cloneRef ?? "new"}
              defaultValues={cloneDefaults ?? undefined}
              submit={(values, files) => submitTicket(values, files, authFetch)}
              submitLabel="Open ticket"
              onCreated={(ticket) => router.push(`/admin/tickets/${ticket.reference}`)}
              suggestBusinessNames={(q) => fetchBusinessNameSuggestions(q, authFetch)}
            />
          )}
        </div>
      </section>
    </AdminShell>
  );
}

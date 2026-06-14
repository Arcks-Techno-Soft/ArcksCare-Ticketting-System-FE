"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { TicketForm } from "@/components/ticket-form";
import { submitTicket } from "@/lib/api";

/**
 * Staff-facing ticket creation. Any signed-in staff member (Admin / Manager /
 * Engineer) can open a ticket here. Because it submits with the staff member's
 * JWT, the backend records them as `raised_by`, so the ticket surfaces in the
 * admin inbox tagged "Opened by <name>" for an Admin/Manager to assign.
 */
export default function AdminNewTicketPage() {
  const router = useRouter();
  const { ready, user, authFetch } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <AdminShell>
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <Link
            href="/admin/tickets"
            className="text-[13px] text-ink-muted hover:text-ink transition-colors"
          >
            ← Back to inbox
          </Link>
          <p className="mt-4 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Tickets
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest text-ink">
            Open a new ticket
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            This ticket will appear in the admin inbox tagged “Opened by {user.name}”,
            ready for an owner or admin to assign.
          </p>
        </div>

        <div className="mt-8">
          <TicketForm
            submit={(values, files) => submitTicket(values, files, authFetch)}
            submitLabel="Open ticket"
            onCreated={(ticket) => router.push(`/admin/tickets/${ticket.reference}`)}
          />
        </div>
      </section>
    </AdminShell>
  );
}

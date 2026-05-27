import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PublicUser {
  name: string;
}

interface PublicTicket {
  reference: string;
  business_name: string;
  contact_name: string;
  city: string;
  state: string;
  product_category: string;
  serial_number: string;
  issue_category: string;
  description?: string | null;
  severity: string;
  status: string;
  created_at: string;
  acknowledged_by: PublicUser | null;
  acknowledged_at: string | null;
  assigned_engineer: PublicUser | null;
  assigned_at: string | null;
  resolving_started_at: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
}

async function fetchTicket(reference: string): Promise<PublicTicket | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/tickets/${encodeURIComponent(reference)}`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as PublicTicket;
  } catch {
    return null;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type StepKey = "opened" | "acknowledged" | "assigned" | "working" | "closed";

interface Step {
  key: StepKey;
  title: string;
  subtitle: string;
  when: string | null;
  done: boolean;
}

function buildSteps(t: PublicTicket): Step[] {
  return [
    {
      key: "opened",
      title: "Opened",
      subtitle: "We received your ticket.",
      when: t.created_at,
      done: true,
    },
    {
      key: "acknowledged",
      title: "Acknowledged",
      subtitle: t.acknowledged_by
        ? `Reviewed by ${t.acknowledged_by.name}.`
        : "Our team has it on their radar.",
      when: t.acknowledged_at,
      done: !!t.acknowledged_at,
    },
    {
      key: "assigned",
      title: "Assigned",
      subtitle: t.assigned_engineer
        ? `Assigned to ${t.assigned_engineer.name}.`
        : "A specialist will pick this up shortly.",
      when: t.assigned_at,
      done: !!t.assigned_at,
    },
    {
      key: "working",
      title: "Working",
      subtitle: t.assigned_engineer
        ? `${t.assigned_engineer.name} is on it.`
        : "Work is in progress.",
      when: t.resolving_started_at,
      done: !!t.resolving_started_at,
    },
    {
      key: "closed",
      title: "Closed",
      subtitle:
        t.resolution_summary && t.resolution_summary.trim().length > 0
          ? t.resolution_summary.trim()
          : "Resolved — thanks for your patience.",
      when: t.resolved_at,
      done: t.status === "RESOLVED" || t.status === "CLOSED",
    },
  ];
}

function currentStepLabel(t: PublicTicket): string {
  if (t.status === "CLOSED") return "Closed";
  if (t.status === "RESOLVED") return "Resolved";
  if (t.status === "RESOLVING") return "Working on it";
  if (t.status === "ACCEPTED") return "Engineer accepted";
  if (t.status === "ASSIGNED") return "Assigned to an engineer";
  if (t.status === "ACKNOWLEDGED") return "Acknowledged";
  return "Open";
}

function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-[22px] font-semibold tracking-tight text-ink">
            SK-POS Support
          </span>
        </Link>
        <Link
          href="/track"
          className="hidden sm:inline-block text-[13px] text-ink-muted hover:text-ink transition-colors"
        >
          Track another ticket
        </Link>
      </div>
    </header>
  );
}

export default async function TrackedTicketPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const cleaned = decodeURIComponent(reference).toUpperCase();
  const ticket = await fetchTicket(cleaned);

  if (!ticket) {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <section className="mx-auto max-w-xl px-6 pt-24 pb-32">
          <p className="mb-5 text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
            Ticket not found
          </p>
          <h1 className="font-display text-4xl font-medium leading-tight tracking-tightest text-ink">
            We couldn&apos;t find{" "}
            <span className="font-mono text-3xl">{cleaned}</span>
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Double-check the reference and try again. They look like{" "}
            <span className="font-mono text-ink">AC-2026-00042</span>.
          </p>
          <div className="mt-10">
            <Link
              href="/track"
              className="inline-flex items-center gap-1 rounded-xl2 border border-ink bg-ink px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-ink-soft"
            >
              Try another reference →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const steps = buildSteps(ticket);

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="mx-auto max-w-2xl px-6 pt-16 pb-24 md:pt-20">
        <p className="mb-3 font-mono text-[13px] uppercase tracking-wider text-ink-subtle">
          {ticket.reference}
        </p>
        <h1 className="font-display text-3xl font-medium leading-tight tracking-tightest text-ink md:text-4xl">
          {ticket.business_name}
        </h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          {ticket.city}
          {ticket.state ? `, ${ticket.state}` : ""}
        </p>

        <div className="mt-8 rounded-xl2 border border-line bg-surface-raised p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[12px] uppercase tracking-[0.16em] text-ink-subtle">
              Current status
            </p>
            <p className="text-[12px] text-ink-subtle">
              Updated {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <p className="mt-2 font-display text-2xl font-medium text-ink">
            {currentStepLabel(ticket)}
          </p>
          <div className="mt-4 grid gap-3 text-[14px] text-ink-soft sm:grid-cols-2">
            <div>
              <span className="text-ink-subtle">Product:</span>{" "}
              {ticket.product_category}
            </div>
            <div>
              <span className="text-ink-subtle">Serial:</span>{" "}
              <span className="font-mono">{ticket.serial_number}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-ink-subtle">Issue:</span>{" "}
              {ticket.issue_category}
            </div>
          </div>
        </div>

        <ol className="mt-12 space-y-0">
          {steps.map((step, i) => {
            const last = i === steps.length - 1;
            return (
              <li key={step.key} className="relative flex gap-4">
                {/* dot + connector line */}
                <div className="flex flex-col items-center">
                  <span
                    className={
                      "mt-1 grid h-4 w-4 place-items-center rounded-full border-2 " +
                      (step.done
                        ? "border-ink bg-ink"
                        : "border-line-strong bg-white")
                    }
                    aria-hidden
                  >
                    {step.done && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  {!last && (
                    <span
                      className={
                        "mt-1 w-0.5 flex-1 " +
                        (step.done && steps[i + 1].done
                          ? "bg-ink"
                          : step.done
                          ? "bg-line-strong"
                          : "bg-line")
                      }
                      aria-hidden
                    />
                  )}
                </div>

                {/* step content */}
                <div className="flex-1 pb-10">
                  <p
                    className={
                      "text-[15px] font-semibold " +
                      (step.done ? "text-ink" : "text-ink-subtle")
                    }
                  >
                    {step.title}
                  </p>
                  <p
                    className={
                      "mt-1 text-[14px] " +
                      (step.done ? "text-ink-muted" : "text-ink-subtle")
                    }
                  >
                    {step.subtitle}
                  </p>
                  {step.when && step.done && (
                    <p className="mt-1 text-[12px] text-ink-subtle">
                      {formatDateTime(step.when)}
                    </p>
                  )}
                  {!step.done && (
                    <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-ink-subtle">
                      Pending
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {ticket.description && (
          <div className="mt-4 rounded-xl2 border border-line bg-white p-5">
            <p className="text-[12px] uppercase tracking-[0.16em] text-ink-subtle">
              What you reported
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              {ticket.description}
            </p>
          </div>
        )}

        <p className="mt-12 text-[13px] text-ink-subtle">
          Need anything else? Reply to the confirmation email — we&apos;ll get
          back to you on the same thread.
        </p>
      </section>
    </main>
  );
}
